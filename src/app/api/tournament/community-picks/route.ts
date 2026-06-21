import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tournament/community-picks?competitionId=xxx
 *
 * Returns aggregated prediction stats for the most recently revealed fixture
 * (where pick_reveal_at < now). Competition-wide, not per-group.
 *
 * Response:
 *   { fixture: { home, away, eventId }, outcomeSplit: { home, draw, away, total },
 *     topScores: [{ home, away, count, pct }] }
 *   or { fixture: null } if no fixture is revealed yet.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json(
      { error: "competitionId is required" },
      { status: 400 },
    );
  }

  // Find the most recently revealed fixture.
  // pick_reveal_at defaults to lock_time when null, so we fetch all locked
  // events and find the one with the most recent effective reveal time.
  const now = new Date().toISOString();
  const { data: lockedEvents } = await supabase
    .from("events")
    .select("id, event_name, lock_time, pick_reveal_at, external_event_id, sport")
    .eq("competition_id", competitionId)
    .lt("lock_time", now)
    .order("lock_time", { ascending: false })
    .limit(20);

  // Filter to events where effective reveal time (pick_reveal_at ?? lock_time) < now
  const revealed = (lockedEvents ?? []).filter((e) => {
    const revealAt = e.pick_reveal_at ?? e.lock_time;
    return new Date(revealAt) < new Date(now);
  });

  // Sort by effective reveal time descending, pick the most recent
  revealed.sort((a, b) => {
    const aReveal = new Date(a.pick_reveal_at ?? a.lock_time).getTime();
    const bReveal = new Date(b.pick_reveal_at ?? b.lock_time).getTime();
    return bReveal - aReveal;
  });

  const revealedEvent = revealed[0] ?? null;

  if (!revealedEvent) {
    return NextResponse.json({ fixture: null });
  }

  // Parse team names from event_name (format: "Team A vs Team B")
  const parts = revealedEvent.event_name.split(/\s+vs?\s+/i);
  const home = parts[0]?.trim() ?? "Home";
  const away = parts[1]?.trim() ?? "Away";

  // Check if draw is allowed for the winner prediction type on this event
  const { data: eptRows } = await supabase
    .from("event_prediction_types")
    .select("config")
    .eq("event_id", revealedEvent.id)
    .eq("prediction_type", "winner")
    .limit(1);

  const winnerConfig = (eptRows?.[0]?.config ?? {}) as Record<string, unknown>;
  const allowDraw = winnerConfig.allow_draw !== false; // default true for soccer

  // Fetch ALL predictions for this event (competition-wide, all users)
  const { data: predictions } = await supabase
    .from("predictions")
    .select("prediction_type, prediction_data")
    .eq("event_id", revealedEvent.id);

  const preds = predictions ?? [];

  // --- Outcome split (winner predictions) ---
  let homeCount = 0;
  let drawCount = 0;
  let awayCount = 0;

  for (const p of preds) {
    if (p.prediction_type !== "winner") continue;
    const val = (
      (p.prediction_data as Record<string, unknown>)?.selection ??
      (p.prediction_data as Record<string, unknown>)?.value ??
      ""
    ) as string;

    const lower = val.toLowerCase();
    if (lower === "draw") {
      drawCount++;
    } else if (lower === home.toLowerCase()) {
      homeCount++;
    } else if (lower === away.toLowerCase()) {
      awayCount++;
    }
  }

  const totalOutcome = homeCount + drawCount + awayCount;

  // --- Top exact scores ---
  const scoreCounts = new Map<string, number>();

  for (const p of preds) {
    if (p.prediction_type !== "exact_score") continue;
    const d = p.prediction_data as Record<string, unknown>;
    const h = Number(d.home ?? d.home_score);
    const a = Number(d.away ?? d.away_score);
    if (isNaN(h) || isNaN(a)) continue;
    const key = `${h}-${a}`;
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
  }

  const totalScores = [...scoreCounts.values()].reduce((a, b) => a + b, 0);
  const topScores = [...scoreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([score, count]) => {
      const [h, a] = score.split("-").map(Number);
      return {
        home: h,
        away: a,
        count,
        pct: totalScores > 0 ? Math.round((count / totalScores) * 100) : 0,
      };
    });

  return NextResponse.json({
    fixture: {
      home,
      away,
      eventId: revealedEvent.id,
    },
    sport: revealedEvent.sport ?? "soccer",
    allowDraw,
    outcomeSplit: {
      home: homeCount,
      draw: drawCount,
      away: awayCount,
      total: totalOutcome,
    },
    topScores,
  });
}
