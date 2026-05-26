import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CompetitionSelector } from "./CompetitionSelector";
import {
  LeaderboardTable,
  type LeaderboardEntry,
  type EventPrediction,
  type TiebreakerInfo,
} from "./LeaderboardTable";
import { getClassificationsForCompetition } from "@/lib/tournament/classification-engine";
import { ClassificationTabs } from "@/components/tournament/ClassificationTabs";
import { computeStandings } from "@/lib/leaderboard";

interface PageProps {
  searchParams: Promise<{ competition?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch competitions the user belongs to
  const { data: memberships } = await supabase
    .from("competition_members")
    .select("competition_id, competitions(id, name, status, type, product_mode)")
    .eq("user_id", user.id);

  const competitions = (memberships ?? [])
    .map((m) => {
      const comp = m.competitions as unknown as {
        id: string;
        name: string;
        status: string;
        type: string;
        product_mode: string | null;
      } | null;
      return comp ? { id: comp.id, name: comp.name, status: comp.status, type: comp.type, product_mode: comp.product_mode } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.type !== "personal");

  if (competitions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-[11px] font-extrabold lowercase tracking-tight text-ps-text">sports<span className="text-ps-amber">predict.</span></p>
        <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
          THE TABLE
        </h1>
        <div className="mt-8 rounded-2xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
          No competitions yet — join one to start calling it
        </div>
      </div>
    );
  }

  // Determine selected competition
  const selectedId =
    params.competition && competitions.some((c) => c.id === params.competition)
      ? params.competition
      : competitions[0]?.id ?? null;

  if (!selectedId) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-[11px] font-extrabold lowercase tracking-tight text-ps-text">sports<span className="text-ps-amber">predict.</span></p>
        <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
          THE TABLE
        </h1>
        <div className="mt-8 rounded-2xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
          No competitions yet — join one to start calling it
        </div>
      </div>
    );
  }

  const selectedCompetition = competitions.find((c) => c.id === selectedId);

  // Only show tournament classification tabs for WC shell competitions — not standard ones
  const isTournamentShell = selectedCompetition?.product_mode === "world_cup_2026_shell";
  const classifications = isTournamentShell
    ? await getClassificationsForCompetition(supabase, selectedId)
    : [];

  if (classifications.length > 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold lowercase tracking-tight text-ps-text">
              sports<span className="text-ps-amber">predict.</span>
            </p>
            <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
              THE TABLE
            </h1>
          </div>
          <CompetitionSelector
            competitions={competitions.map((c) => ({ id: c.id, name: c.name }))}
            selectedId={selectedId}
          />
        </div>
        <div className="mt-4">
          <ClassificationTabs
            classifications={classifications}
            competitionId={selectedId}
            currentUserId={user.id}
          />
        </div>
      </div>
    );
  }

  // Fetch all data in parallel
  const [
    { data: members },
    { data: allEvents },
    { data: tiebreakers },
  ] = await Promise.all([
    supabase
      .from("competition_members")
      .select("user_id, users(id, display_name, avatar_url)")
      .eq("competition_id", selectedId),
    // Fetch ALL events (not just resulted) so we can determine round participation
    supabase
      .from("events")
      .select("id, event_name, sport, status, result_data, round_id")
      .eq("competition_id", selectedId),
    supabase
      .from("tiebreakers")
      .select("id, question_text, correct_value")
      .eq("competition_id", selectedId),
  ]);

  const memberList = members ?? [];
  const allEventList = allEvents ?? [];
  const tiebreakerList = tiebreakers ?? [];

  // Resulted events only — for scoring display
  const resultedEventList = allEventList.filter((e) => e.status === "resulted");
  const allEventIds = allEventList.map((e) => e.id);

  // Fetch event_prediction_types for ALL events (needed for max possible points)
  // and ALL predictions (needed for round participation detection)
  let eventPredictionTypeList: Array<{
    event_id: string;
    points: number;
  }> = [];
  let predictionList: Array<{
    id: string;
    event_id: string;
    user_id: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    is_partial: boolean;
    points_awarded: number;
    submitted_at: string;
  }> = [];

  if (allEventIds.length > 0) {
    const [{ data: epts }, { data: predictions }] = await Promise.all([
      supabase
        .from("event_prediction_types")
        .select("event_id, points")
        .in("event_id", allEventIds),
      supabase
        .from("predictions")
        .select(
          "id, event_id, user_id, prediction_data, is_correct, is_partial, points_awarded, submitted_at"
        )
        .in("event_id", allEventIds),
    ]);
    eventPredictionTypeList = epts ?? [];
    predictionList = predictions ?? [];
  }

  // Fetch tiebreaker answers
  const tiebreakerIds = tiebreakerList.map((t) => t.id);
  let tiebreakerAnswerList: Array<{
    tiebreaker_id: string;
    user_id: string;
    value: number;
  }> = [];

  if (tiebreakerIds.length > 0) {
    const { data: tbAnswers } = await supabase
      .from("tiebreaker_answers")
      .select("tiebreaker_id, user_id, value")
      .in("tiebreaker_id", tiebreakerIds);
    tiebreakerAnswerList = tbAnswers ?? [];
  }

  // --- Round-based scoring setup ---

  // Group all events by round_id (null round_id events go into a "null" bucket)
  const eventsByRound = new Map<string | null, typeof allEventList>();
  for (const ev of allEventList) {
    const roundKey = ev.round_id ?? null;
    const bucket = eventsByRound.get(roundKey) ?? [];
    bucket.push(ev);
    eventsByRound.set(roundKey, bucket);
  }

  // Max possible points per round: sum of event_prediction_types.points for events in that round
  const eptByEvent = new Map<string, number>();
  for (const ept of eventPredictionTypeList) {
    eptByEvent.set(ept.event_id, (eptByEvent.get(ept.event_id) ?? 0) + ept.points);
  }

  const maxPointsByRound = new Map<string | null, number>();
  for (const [roundKey, evs] of eventsByRound) {
    const max = evs.reduce((sum, ev) => sum + (eptByEvent.get(ev.id) ?? 0), 0);
    maxPointsByRound.set(roundKey, max);
  }

  // Count "scored" rounds — rounds that have at least one resulted event
  const resultedEventIdSet = new Set(resultedEventList.map((e) => e.id));
  const scoredRoundKeys = new Set<string | null>();
  for (const [roundKey, evs] of eventsByRound) {
    if (evs.some((ev) => resultedEventIdSet.has(ev.id))) {
      scoredRoundKeys.add(roundKey);
    }
  }
  const totalScoredRounds = scoredRoundKeys.size;

  // Map each event_id -> round_id (null if no round)
  const eventToRound = new Map<string, string | null>();
  for (const ev of allEventList) {
    eventToRound.set(ev.id, ev.round_id ?? null);
  }

  // Build a map of event_id -> resulted event details (for the scored predictions display)
  const resultedEventMap = new Map(
    resultedEventList.map((e) => [
      e.id,
      {
        event_name: e.event_name,
        sport: e.sport,
        result_data: e.result_data as Record<string, unknown> | null,
      },
    ])
  );

  // Build predictions grouped by user — only resulted events feed the display predictions
  const predictionsByUser = new Map<string, EventPrediction[]>();
  // Also track all predictions by user for round participation (includes non-resulted events)
  const allPredsByUser = new Map<string, typeof predictionList>();

  for (const p of predictionList) {
    // All preds for round participation
    const allList = allPredsByUser.get(p.user_id) ?? [];
    allList.push(p);
    allPredsByUser.set(p.user_id, allList);

    // Only resulted event preds go into the display list
    const ev = resultedEventMap.get(p.event_id);
    if (!ev) continue;
    const list = predictionsByUser.get(p.user_id) ?? [];
    list.push({
      event_id: p.event_id,
      event_name: ev.event_name,
      sport: ev.sport,
      prediction_data: p.prediction_data,
      result_data: ev.result_data,
      is_correct: p.is_correct,
      is_partial: p.is_partial,
      points_awarded: p.points_awarded,
    });
    predictionsByUser.set(p.user_id, list);
  }

  // Build tiebreaker info per user (use the first tiebreaker if multiple)
  const primaryTiebreaker = tiebreakerList[0] ?? null;
  const tiebreakerByUser = new Map<string, TiebreakerInfo>();
  if (primaryTiebreaker) {
    // Index answers by user
    const answersByUser = new Map<string, number>();
    for (const a of tiebreakerAnswerList) {
      if (a.tiebreaker_id === primaryTiebreaker.id) {
        answersByUser.set(a.user_id, a.value);
      }
    }

    for (const m of memberList) {
      const userObj = m.users as unknown as {
        id: string;
        display_name: string;
        avatar_url: string | null;
      } | null;
      if (!userObj) continue;
      const answer = answersByUser.get(userObj.id) ?? null;
      const distance =
        primaryTiebreaker.correct_value !== null && answer !== null
          ? Math.abs(answer - primaryTiebreaker.correct_value)
          : null;

      tiebreakerByUser.set(userObj.id, {
        question_text: primaryTiebreaker.question_text,
        correct_value: primaryTiebreaker.correct_value,
        user_answer: answer,
        distance,
      });
    }
  }

  // Calculate streak: consecutive correct predictions from the most recent
  function calculateStreak(predictions: EventPrediction[]): number {
    // Sort by event name as a proxy (ideally would sort by event date)
    // We reverse so most recent is first
    const sorted = [...predictions]
      .filter((p) => p.is_correct !== null)
      .reverse();
    let streak = 0;
    for (const p of sorted) {
      if (p.is_correct === true) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  // --- Display-only per-user computation ---
  // The standings/rank computation (qualification, percentage, sort, rank)
  // is shared with the standings cache via computeStandings(). The page
  // still computes display-only fields here: accuracy, streak, partial /
  // wrong counts, the predictions list, rounds participated and tiebreaker.
  interface DisplayStats {
    partial_count: number;
    wrong_count: number;
    total_predictions: number;
    accuracy: number;
    streak: number;
    percentage: number;
    rounds_participated: number;
    predictions: EventPrediction[];
  }

  const displayStatsByUser = new Map<string, DisplayStats>();
  for (const m of memberList) {
    const userObj = m.users as unknown as { id: string } | null;
    const userId = userObj?.id ?? m.user_id;

    const preds = predictionsByUser.get(userId) ?? [];
    const allUserPreds = allPredsByUser.get(userId) ?? [];

    const totalPoints = preds.reduce((sum, p) => sum + p.points_awarded, 0);
    const correctCount = preds.filter((p) => p.is_correct === true).length;
    const partialCount = preds.filter(
      (p) => p.is_correct === false && p.is_partial === true
    ).length;
    const resultedPreds = preds.filter((p) => p.is_correct !== null);
    const wrongCount = resultedPreds.length - correctCount - partialCount;
    const accuracy =
      resultedPreds.length > 0
        ? (correctCount / resultedPreds.length) * 100
        : 0;
    const streak = calculateStreak(preds);

    // Percentage scoring — scored rounds the user participated in.
    const userRoundsParticipated = new Set<string | null>();
    for (const p of allUserPreds) {
      const roundKey = eventToRound.get(p.event_id);
      if (roundKey !== undefined && scoredRoundKeys.has(roundKey)) {
        userRoundsParticipated.add(roundKey);
      }
    }
    const maxPossible = Array.from(userRoundsParticipated).reduce(
      (sum, rk) => sum + (maxPointsByRound.get(rk) ?? 0),
      0
    );
    const percentage = maxPossible > 0 ? (totalPoints / maxPossible) * 100 : 0;

    displayStatsByUser.set(userId, {
      partial_count: partialCount,
      wrong_count: wrongCount,
      total_predictions: preds.length,
      accuracy,
      streak,
      percentage,
      rounds_participated: userRoundsParticipated.size,
      predictions: preds,
    });
  }

  // Authoritative standings/rank — shared with the standings cache.
  // Returns entries already sorted (qualified ranked, then unqualified)
  // exactly as this page renders them.
  const standings = await computeStandings(selectedId, supabase);

  const entries_final: LeaderboardEntry[] = standings.map((s) => {
    const display = displayStatsByUser.get(s.user_id);
    return {
      user_id: s.user_id,
      display_name: s.display_name,
      avatar_url: s.avatar_url,
      rank: s.rank,
      total_points: s.total_points,
      correct_count: s.correct_count,
      partial_count: display?.partial_count ?? 0,
      wrong_count: display?.wrong_count ?? 0,
      total_predictions: display?.total_predictions ?? 0,
      accuracy: display?.accuracy ?? 0,
      streak: display?.streak ?? 0,
      percentage: display?.percentage ?? 0,
      rounds_participated: display?.rounds_participated ?? 0,
      total_rounds: totalScoredRounds,
      qualified: s.qualified,
      tiebreaker: tiebreakerByUser.get(s.user_id) ?? null,
      predictions: display?.predictions ?? [],
    };
  });

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold lowercase tracking-tight text-ps-text">
            sports<span className="text-ps-amber">predict.</span>
          </p>
          <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
            THE TABLE
          </h1>
          <p className="text-xs text-ps-text-ter font-mono">{memberList.length} players</p>
        </div>
        <CompetitionSelector
          competitions={competitions.map((c) => ({ id: c.id, name: c.name }))}
          selectedId={selectedId}
        />
      </div>

      <div className="mt-4">
        <LeaderboardTable entries={entries_final} />
      </div>
    </div>
  );
}
