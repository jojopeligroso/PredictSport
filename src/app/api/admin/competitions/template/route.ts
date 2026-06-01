import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  WC2026_TEMPLATE,
  WC2026_GROUP_FIXTURES,
  computeWC2026DailyLockTimes,
} from "@/lib/wc/wc2026-template";
import { requireDisplayName } from "@/lib/require-display-name";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/competitions/template
 *
 * Create a competition from a template. Currently supports "world_cup_2026".
 * Creates: competition + 8 rounds + 72 group events + 144 event_prediction_types.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  let body: { template: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.template !== "world_cup_2026") {
    return NextResponse.json(
      { error: `Unknown template: ${body.template}` },
      { status: 400 },
    );
  }

  const tmpl = WC2026_TEMPLATE;
  const compName = body.name?.trim() || tmpl.competition.name;

  // 1. Create competition
  const { data: competition, error: compErr } = await supabase
    .from("competitions")
    .insert({
      name: compName,
      type: tmpl.competition.type,
      visibility: tmpl.competition.visibility,
      status: "active",
      scoring_rules: tmpl.competition.scoring_rules,
      lock_default_minutes: tmpl.competition.lock_default_minutes,
      allow_prediction_updates: tmpl.competition.allow_prediction_updates,
      created_by: user.id,
    })
    .select("id, name, invite_code")
    .single();

  if (compErr) {
    return NextResponse.json(
      { error: "Failed to create competition", details: compErr.message },
      { status: 500 },
    );
  }

  // 2. Add creator as admin
  const { error: memberErr } = await supabase
    .from("competition_members")
    .insert({
      competition_id: competition.id,
      user_id: user.id,
      role: "admin",
    });

  if (memberErr) {
    await supabase.from("competitions").delete().eq("id", competition.id);
    return NextResponse.json(
      { error: "Failed to set up admin membership", details: memberErr.message },
      { status: 500 },
    );
  }

  // 3. Create 8 rounds
  const roundRows = tmpl.rounds.map((r) => ({
    competition_id: competition.id,
    round_number: r.round_number,
    name: r.name,
    status: r.status,
  }));

  const { data: rounds, error: roundErr } = await supabase
    .from("rounds")
    .insert(roundRows)
    .select("id, round_number");

  if (roundErr) {
    await supabase.from("competitions").delete().eq("id", competition.id);
    return NextResponse.json(
      { error: "Failed to create rounds", details: roundErr.message },
      { status: 500 },
    );
  }

  const roundByNumber = new Map<number, string>();
  for (const r of rounds ?? []) roundByNumber.set(r.round_number, r.id);

  // 4. Compute daily lock times
  const dailyLocks = computeWC2026DailyLockTimes(
    WC2026_GROUP_FIXTURES,
    tmpl.lockOffsetMinutes,
  );

  // 5. Create 72 group events
  const eventRows = WC2026_GROUP_FIXTURES.map((f) => {
    const start = new Date(f.kickoffUtc);
    const iso = start.toISOString().slice(0, 10);
    const lockKey = `${f.matchday}-${iso}`;
    const lockTime = dailyLocks.get(lockKey) ?? new Date(start.getTime() - 10 * 60_000);

    return {
      competition_id: competition.id,
      round_id: roundByNumber.get(f.matchday)!,
      event_name: `${f.home} vs ${f.away}`,
      sport: "soccer",
      start_time: start.toISOString(),
      lock_time: lockTime.toISOString(),
      status: "upcoming",
      external_event_id: `manual:wc2026-grp-${f.group}-md${f.matchday}-${f.matchInGroup}`,
      provider_league: "FIFA World Cup 2026",
    };
  });

  const { data: events, error: eventErr } = await supabase
    .from("events")
    .insert(eventRows)
    .select("id, external_event_id");

  if (eventErr) {
    await supabase.from("competitions").delete().eq("id", competition.id);
    return NextResponse.json(
      { error: "Failed to create events", details: eventErr.message },
      { status: 500 },
    );
  }

  // 6. Create event_prediction_types (winner + exact_score per event)
  const idByExternal = new Map<string, string>();
  for (const e of events ?? []) idByExternal.set(e.external_event_id, e.id);

  const eptRows: Array<{
    event_id: string;
    prediction_type: string;
    points: number;
    partial_points: number;
    config: Record<string, unknown> | null;
  }> = [];

  for (const f of WC2026_GROUP_FIXTURES) {
    const extId = `manual:wc2026-grp-${f.group}-md${f.matchday}-${f.matchInGroup}`;
    const eventId = idByExternal.get(extId);
    if (!eventId) continue;

    eptRows.push({
      event_id: eventId,
      prediction_type: "winner",
      points: tmpl.pointsWinner,
      partial_points: 0,
      config: { options: [f.home, f.away] },
    });
    eptRows.push({
      event_id: eventId,
      prediction_type: "exact_score",
      points: tmpl.pointsExactScore,
      partial_points: 0,
      config: null,
    });
  }

  const { error: eptErr } = await supabase
    .from("event_prediction_types")
    .insert(eptRows);

  if (eptErr) {
    await supabase.from("competitions").delete().eq("id", competition.id);
    return NextResponse.json(
      { error: "Failed to create prediction types", details: eptErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      competition: {
        id: competition.id,
        name: competition.name,
        invite_code: competition.invite_code,
      },
      rounds: (rounds ?? []).length,
      events: (events ?? []).length,
      prediction_types: eptRows.length,
    },
    { status: 201 },
  );
}
