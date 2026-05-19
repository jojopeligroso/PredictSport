import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePersonalCompetition } from "@/lib/personal-competition";

interface PredictionRow {
  id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
  is_correct: boolean | null;
  submitted_at: string;
  events: {
    id: string;
    event_name: string;
    sport: string;
    provider_league: string | null;
    start_time: string;
    result_data: Record<string, unknown> | null;
    result_confirmed: boolean;
    status: string;
  };
}

interface RecentPick {
  prediction_id: string;
  event_name: string;
  sport: string;
  league: string | null;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
  is_correct: boolean | null;
  result_data: Record<string, unknown> | null;
  start_time: string;
}

interface BreakdownEntry {
  total: number;
  correct: number;
  wrong: number;
  pending: number;
  hit_rate: number | null;
}

/**
 * GET /api/personal-predictions/stats
 *
 * Returns aggregated stats for the user's personal predictions:
 * - Lifetime hit rate + current/best streak
 * - By-sport breakdown
 * - By-league breakdown
 * - By-year breakdown
 * - Recent 5 picks with results
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let competitionId: string;
  try {
    competitionId = await getOrCreatePersonalCompetition(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve personal competition", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Fetch all predictions for the user's personal competition, joined with event data
  const { data: rows, error } = await supabase
    .from("predictions")
    .select(
      `
      id,
      prediction_type,
      prediction_data,
      is_correct,
      submitted_at,
      events!inner (
        id,
        event_name,
        sport,
        provider_league,
        start_time,
        result_data,
        result_confirmed,
        status
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("events.competition_id", competitionId)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch predictions", details: error.message },
      { status: 500 },
    );
  }

  const predictions = (rows ?? []) as unknown as PredictionRow[];

  // Only count resolved predictions (is_correct !== null) for hit rate calculations
  const resolved = predictions.filter((p) => p.is_correct !== null);

  // --- Lifetime stats ---
  const totalPicks = predictions.length;
  const resolvedCount = resolved.length;
  const correctCount = resolved.filter((p) => p.is_correct === true).length;
  const lifetimeHitRate = resolvedCount > 0 ? correctCount / resolvedCount : null;

  // --- Streaks (computed on time-ordered resolved predictions) ---
  const resolvedByTime = [...resolved].sort(
    (a, b) => new Date(a.events.start_time).getTime() - new Date(b.events.start_time).getTime(),
  );

  let currentStreak = 0;
  let currentStreakType: "W" | "L" | null = null;
  let bestStreak = 0;
  let runningStreak = 0;
  let runningType: boolean | null = null;

  for (const p of resolvedByTime) {
    // Track longest winning streak
    if (p.is_correct === runningType) {
      runningStreak++;
    } else {
      runningType = p.is_correct;
      runningStreak = 1;
    }
    if (runningType === true && runningStreak > bestStreak) {
      bestStreak = runningStreak;
    }
  }

  // Current streak: walk backwards from most recent
  for (let i = resolvedByTime.length - 1; i >= 0; i--) {
    const p = resolvedByTime[i];
    if (currentStreakType === null) {
      currentStreakType = p.is_correct ? "W" : "L";
      currentStreak = 1;
    } else if ((currentStreakType === "W") === p.is_correct) {
      currentStreak++;
    } else {
      break;
    }
  }

  // --- By-sport breakdown ---
  const bySport = new Map<string, { correct: number; wrong: number; pending: number }>();
  for (const p of predictions) {
    const sport = p.events.sport;
    const entry = bySport.get(sport) ?? { correct: 0, wrong: 0, pending: 0 };
    if (p.is_correct === null) entry.pending++;
    else if (p.is_correct) entry.correct++;
    else entry.wrong++;
    bySport.set(sport, entry);
  }

  const bySportBreakdown: Record<string, BreakdownEntry> = {};
  for (const [sport, counts] of Array.from(bySport)) {
    const total = counts.correct + counts.wrong + counts.pending;
    const resolvedTotal = counts.correct + counts.wrong;
    bySportBreakdown[sport] = {
      total,
      correct: counts.correct,
      wrong: counts.wrong,
      pending: counts.pending,
      hit_rate: resolvedTotal > 0 ? counts.correct / resolvedTotal : null,
    };
  }

  // --- By-league breakdown ---
  const byLeague = new Map<string, { sport: string; correct: number; wrong: number; pending: number }>();
  for (const p of predictions) {
    const league = p.events.provider_league ?? "Unknown";
    const entry = byLeague.get(league) ?? { sport: p.events.sport, correct: 0, wrong: 0, pending: 0 };
    if (p.is_correct === null) entry.pending++;
    else if (p.is_correct) entry.correct++;
    else entry.wrong++;
    byLeague.set(league, entry);
  }

  const byLeagueBreakdown: Record<string, BreakdownEntry & { sport: string }> = {};
  for (const [league, counts] of Array.from(byLeague)) {
    const total = counts.correct + counts.wrong + counts.pending;
    const resolvedTotal = counts.correct + counts.wrong;
    byLeagueBreakdown[league] = {
      sport: counts.sport,
      total,
      correct: counts.correct,
      wrong: counts.wrong,
      pending: counts.pending,
      hit_rate: resolvedTotal > 0 ? counts.correct / resolvedTotal : null,
    };
  }

  // --- By-year breakdown ---
  const byYear = new Map<number, { correct: number; wrong: number; pending: number }>();
  for (const p of predictions) {
    const year = new Date(p.events.start_time).getFullYear();
    const entry = byYear.get(year) ?? { correct: 0, wrong: 0, pending: 0 };
    if (p.is_correct === null) entry.pending++;
    else if (p.is_correct) entry.correct++;
    else entry.wrong++;
    byYear.set(year, entry);
  }

  const byYearBreakdown: Record<number, BreakdownEntry> = {};
  for (const [year, counts] of Array.from(byYear)) {
    const total = counts.correct + counts.wrong + counts.pending;
    const resolvedTotal = counts.correct + counts.wrong;
    byYearBreakdown[year] = {
      total,
      correct: counts.correct,
      wrong: counts.wrong,
      pending: counts.pending,
      hit_rate: resolvedTotal > 0 ? counts.correct / resolvedTotal : null,
    };
  }

  // --- Recent picks (all, UI handles truncation) ---
  const recent: RecentPick[] = predictions.map((p) => ({
    prediction_id: p.id,
    event_name: p.events.event_name,
    sport: p.events.sport,
    league: p.events.provider_league,
    prediction_type: p.prediction_type,
    prediction_data: p.prediction_data,
    is_correct: p.is_correct,
    result_data: p.events.result_data,
    start_time: p.events.start_time,
  }));

  // --- Favourite team ---
  const { data: userRow } = await supabase
    .from("users")
    .select("favourite_team")
    .eq("id", user.id)
    .single();

  const favouriteTeam = (userRow?.favourite_team as { sport: string; team_name: string; provider_id: string | null } | null) ?? null;

  let favouriteTeamPicks: RecentPick[] = [];
  if (favouriteTeam) {
    const teamLower = favouriteTeam.team_name.toLowerCase();
    favouriteTeamPicks = recent
      .filter((p) => p.event_name.toLowerCase().includes(teamLower))
      .slice(0, 10);
  }

  return NextResponse.json({
    summary: {
      total_picks: totalPicks,
      resolved: resolvedCount,
      correct: correctCount,
      hit_rate: lifetimeHitRate,
      current_streak: currentStreak,
      current_streak_type: currentStreakType,
      best_streak: bestStreak,
    },
    by_sport: bySportBreakdown,
    by_league: byLeagueBreakdown,
    by_year: byYearBreakdown,
    recent_picks: recent,
    favourite_team: favouriteTeam,
    favourite_team_picks: favouriteTeamPicks,
  });
}
