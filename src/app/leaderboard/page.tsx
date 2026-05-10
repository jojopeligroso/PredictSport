import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CompetitionSelector } from "./CompetitionSelector";
import {
  LeaderboardTable,
  type LeaderboardEntry,
  type EventPrediction,
  type TiebreakerInfo,
} from "./LeaderboardTable";

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
    .select("competition_id, competitions(id, name, status)")
    .eq("user_id", user.id);

  const competitions = (memberships ?? [])
    .map((m) => {
      const comp = m.competitions as unknown as {
        id: string;
        name: string;
        status: string;
      } | null;
      return comp ? { id: comp.id, name: comp.name, status: comp.status } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (competitions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ps-text-sec">PredictSport</p>
        <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
          THE TABLE
        </h1>
        <div className="mt-8 rounded-2xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
          No competitions joined yet
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
        <p className="text-[11px] font-bold uppercase tracking-widest text-ps-text-sec">PredictSport</p>
        <h1 className="mt-0.5 font-display text-[32px] leading-none tracking-wider text-ps-text">
          THE TABLE
        </h1>
        <div className="mt-8 rounded-2xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
          No competitions joined yet
        </div>
      </div>
    );
  }

  const selectedCompetition = competitions.find((c) => c.id === selectedId);

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

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = memberList.map((m) => {
    const userObj = m.users as unknown as {
      id: string;
      display_name: string;
      avatar_url: string | null;
    } | null;

    const userId = userObj?.id ?? m.user_id;
    const displayName = userObj?.display_name ?? "Unknown";
    const avatarUrl = userObj?.avatar_url ?? null;

    // Display predictions (resulted events only)
    const preds = predictionsByUser.get(userId) ?? [];
    // All predictions (for round participation)
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

    // --- Percentage scoring ---
    // Determine which scored rounds this user participated in
    // (submitted at least 1 prediction for any event in that round)
    const userRoundsParticipated = new Set<string | null>();
    for (const p of allUserPreds) {
      const roundKey = eventToRound.get(p.event_id);
      if (roundKey !== undefined && scoredRoundKeys.has(roundKey)) {
        userRoundsParticipated.add(roundKey);
      }
    }

    // Max possible points across participated rounds
    const maxPossible = Array.from(userRoundsParticipated).reduce(
      (sum, rk) => sum + (maxPointsByRound.get(rk) ?? 0),
      0
    );

    const percentage = maxPossible > 0 ? (totalPoints / maxPossible) * 100 : 0;
    const roundsParticipated = userRoundsParticipated.size;

    // Qualification: participated in at least 1/3 of all scored rounds
    const qualified =
      totalScoredRounds === 0
        ? false
        : roundsParticipated >= Math.ceil(totalScoredRounds / 3);

    return {
      user_id: userId,
      display_name: displayName,
      avatar_url: avatarUrl,
      rank: 0, // assigned below
      total_points: totalPoints,
      correct_count: correctCount,
      partial_count: partialCount,
      wrong_count: wrongCount,
      total_predictions: preds.length,
      accuracy,
      streak,
      percentage,
      rounds_participated: roundsParticipated,
      total_rounds: totalScoredRounds,
      qualified,
      tiebreaker: tiebreakerByUser.get(userId) ?? null,
      predictions: preds,
    };
  });

  // Sort qualified entries by percentage desc, then tiebreaker distance asc
  // Unqualified entries are sorted the same way but placed after
  function sortKey(a: LeaderboardEntry, b: LeaderboardEntry): number {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    const aDist = a.tiebreaker?.distance ?? Infinity;
    const bDist = b.tiebreaker?.distance ?? Infinity;
    return aDist - bDist;
  }

  const qualifiedEntries = entries.filter((e) => e.qualified).sort(sortKey);
  const unqualifiedEntries = entries.filter((e) => !e.qualified).sort(sortKey);

  const sortedEntries = [...qualifiedEntries, ...unqualifiedEntries];

  // Assign ranks only among qualified entries (tied users share the same rank)
  let currentRank = 1;
  for (let i = 0; i < qualifiedEntries.length; i++) {
    if (i === 0) {
      qualifiedEntries[i]!.rank = 1;
    } else {
      const prev = qualifiedEntries[i - 1]!;
      const curr = qualifiedEntries[i]!;
      const samePct = curr.percentage === prev.percentage;
      const sameTiebreaker =
        (curr.tiebreaker?.distance ?? Infinity) ===
        (prev.tiebreaker?.distance ?? Infinity);

      if (samePct && sameTiebreaker) {
        curr.rank = prev.rank;
      } else {
        currentRank = i + 1;
        curr.rank = currentRank;
      }
    }
  }

  // Unqualified entries get rank 0 (displayed as "—" in the table)
  for (const e of unqualifiedEntries) {
    e.rank = 0;
  }

  const entries_final = sortedEntries;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-ps-text-sec">
            PredictSport
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
        <LeaderboardTable entries={entries_final} />
      </div>
    </div>
  );
}
