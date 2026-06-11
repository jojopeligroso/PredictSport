import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tournament/accuracy?competitionId=xxx
 *
 * Returns accuracy stats for the current user and competition-wide averages.
 * Only considers winner predictions on result-confirmed events.
 *
 * Response:
 *   { user: { correct, total, pct }, competition: { avgPoints, avgCorrectPct } }
 *   or { user: null, competition: null } if no confirmed results yet.
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

  // Get the tournament_id for this competition (events may be shared via tournament)
  const { data: comp } = await supabase
    .from("competitions")
    .select("tournament_id")
    .eq("id", competitionId)
    .single();

  // Fetch all scored predictions on confirmed events for this competition.
  // We need both winner (for accuracy) and all types (for avg points).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let predsQuery: any;
  if (comp?.tournament_id) {
    predsQuery = supabase
      .from("predictions")
      .select("user_id, prediction_type, is_correct, points_awarded, events!inner(tournament_id, result_confirmed)")
      .eq("events.tournament_id", comp.tournament_id)
      .eq("events.result_confirmed", true);
  } else {
    predsQuery = supabase
      .from("predictions")
      .select("user_id, prediction_type, is_correct, points_awarded, events!inner(competition_id, result_confirmed)")
      .eq("events.competition_id", competitionId)
      .eq("events.result_confirmed", true);
  }

  const { data: predictions } = await predsQuery;

  if (!predictions?.length) {
    return NextResponse.json({ user: null, competition: null });
  }

  // Per-user aggregation: winner accuracy, score accuracy, total points
  const userStats = new Map<string, {
    winnerCorrect: number; winnerTotal: number;
    scoreCorrect: number; scoreTotal: number;
    points: number;
  }>();
  for (const p of predictions) {
    const stats = userStats.get(p.user_id) ?? {
      winnerCorrect: 0, winnerTotal: 0,
      scoreCorrect: 0, scoreTotal: 0,
      points: 0,
    };
    stats.points += p.points_awarded ?? 0;
    if (p.prediction_type === "winner") {
      stats.winnerTotal++;
      if (p.is_correct) stats.winnerCorrect++;
    } else if (p.prediction_type === "exact_score") {
      stats.scoreTotal++;
      if (p.is_correct) stats.scoreCorrect++;
    }
    userStats.set(p.user_id, stats);
  }

  // Current user's accuracy (split by type)
  const self = userStats.get(user.id);
  const userAccuracy = self && self.winnerTotal > 0
    ? {
        correct: self.winnerCorrect,
        total: self.winnerTotal,
        pct: Math.round((self.winnerCorrect / self.winnerTotal) * 100),
      }
    : null;
  const userScoreAccuracy = self && self.scoreTotal > 0
    ? {
        correct: self.scoreCorrect,
        total: self.scoreTotal,
        pct: Math.round((self.scoreCorrect / self.scoreTotal) * 100),
      }
    : null;

  // Competition-wide averages
  const playerCount = userStats.size;
  const totalCorrectPct = [...userStats.values()].reduce(
    (sum, s) => sum + (s.winnerTotal > 0 ? s.winnerCorrect / s.winnerTotal : 0),
    0,
  );
  const totalPoints = [...userStats.values()].reduce((sum, s) => sum + s.points, 0);

  const competitionStats = {
    avgPoints: playerCount > 0 ? Math.round((totalPoints / playerCount) * 10) / 10 : 0,
    avgCorrectPct: playerCount > 0 ? Math.round((totalCorrectPct / playerCount) * 100) : 0,
  };

  return NextResponse.json({
    user: userAccuracy,
    userScore: userScoreAccuracy,
    competition: competitionStats,
  });
}
