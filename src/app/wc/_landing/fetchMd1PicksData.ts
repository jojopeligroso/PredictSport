import { createClient } from "@/lib/supabase/server";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

type EventRowWithExternal = WindowEvent & { external_event_id: string | null };

/**
 * Fetch all data needed to render the MD1 picks-first landing.
 *
 * Shared between /wc and /wc/picks so they render identically
 * even if /wc changes in the future.
 */
export async function fetchMd1PicksData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, status")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"])
    .limit(1)
    .maybeSingle();

  if (!competition) return { ready: false as const };

  const { data: md1Round } = await supabase
    .from("rounds")
    .select("id, status")
    .eq("competition_id", competition.id)
    .eq("round_number", 1)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!md1Round) return { ready: false as const };

  const { data: eventsRaw } = await supabase
    .from("events")
    .select(
      `id, event_name, sport, start_time, lock_time, status, result_confirmed, external_event_id,
       event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
    )
    .eq("round_id", md1Round.id)
    .order("start_time", { ascending: true });

  const eventRows = (eventsRaw ?? []) as EventRowWithExternal[];
  const events: WindowEvent[] = eventRows.map((row) => ({
    id: row.id,
    event_name: row.event_name,
    sport: row.sport,
    start_time: row.start_time,
    lock_time: row.lock_time,
    status: row.status,
    result_confirmed: row.result_confirmed,
    event_prediction_types: row.event_prediction_types,
  }));

  let isMember = false;
  let predictions: Prediction[] = [];
  if (user) {
    const { data: membership } = await supabase
      .from("competition_members")
      .select("id")
      .eq("competition_id", competition.id)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = Boolean(membership);

    if (isMember && events.length > 0) {
      const eventIds = events.map((e) => e.id);
      const { data: predRows } = await supabase
        .from("predictions")
        .select(
          "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at",
        )
        .eq("user_id", user.id)
        .in("event_id", eventIds);
      predictions = (predRows ?? []) as Prediction[];
    }
  }

  const fixtureByExternalId = new Map<string, WcFixture>();
  for (const f of WC2026_FIXTURES) fixtureByExternalId.set(f.externalId, f);

  const fixtureByEventId = new Map<string, WcFixture>();
  for (const row of eventRows) {
    if (!row.external_event_id) continue;
    const fixture = fixtureByExternalId.get(row.external_event_id);
    if (fixture) fixtureByEventId.set(row.id, fixture);
  }

  const windowLocked =
    md1Round.status === "locked" || md1Round.status === "scored";

  return {
    ready: true as const,
    competitionId: competition.id,
    events,
    predictions,
    fixtureByEventId,
    isMember,
    isAuthenticated: Boolean(user),
    windowLocked,
  };
}
