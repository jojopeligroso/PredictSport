/**
 * Shared standings / rank computation.
 *
 * The rank a participant holds in a competition is NOT stored — it is
 * computed live from `predictions`. This module is the single source of
 * truth for that computation: both `/leaderboard` (the authoritative live
 * recompute) and the `competition_standings` cache call `computeStandings`.
 *
 * See `docs/DESIGN-F1-ALL-COMPETITIONS-DASHBOARD.md` §3.6 and
 * `docs/adr/0010-cached-non-authoritative-standings.md`.
 *
 * INTERFACE FROZEN — see commit "freeze data-layer interface". Session B
 * builds the dashboard UI against the types exported here. The optional
 * trailing `supabase` parameter on the functions is additive and does not
 * break the frozen one-argument call signature.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * One participant's standing in a single competition.
 *
 * Note: the live `/leaderboard` ranks on a *percentage* model with round
 * qualification and tiebreaker distance. `total_points` here is the raw
 * points sum; `rank` and `qualified` already reflect the percentage/round
 * model. Percentage and tiebreaker distance are leaderboard *display*
 * concerns and are intentionally NOT part of this cache-facing shape
 * (design doc §3.6 — "prefer leaving display concerns in the page").
 */
export interface Standing {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  /** Competition rank. 0 means unqualified (displayed as "—"). */
  rank: number;
  total_points: number;
  /** Predictions called correctly (resolved + is_correct === true). */
  correct_count: number;
  /** Predictions with a result in (is_correct !== null). */
  resolved_count: number;
  /** Whether the user met the round-participation threshold to be ranked. */
  qualified: boolean;
}

/**
 * Aggregate hit rate across ALL of a user's competitions — group AND
 * personal combined (design doc §3.7 / F3). Not competition-scoped.
 */
export interface GlobalHitRate {
  correct: number;
  resolved: number;
  /** correct / resolved, or null when resolved === 0. */
  hit_rate: number | null;
}

/**
 * Compute the ranked standings for a single competition.
 *
 * Authoritative live computation, lifted verbatim from
 * `src/app/leaderboard/page.tsx`: loads every prediction in the
 * competition, applies the percentage / round-qualification scoring
 * model, sorts (percentage desc, then tiebreaker distance asc), and
 * assigns ranks among qualified entries. Unqualified entries follow,
 * sorted the same way, with `rank = 0`.
 *
 * Used by `/leaderboard` (display) and by `recomputeStandings` (cache).
 *
 * The returned array is ordered exactly as `/leaderboard` renders it:
 * qualified entries first (ranked), then unqualified.
 *
 * @param competitionId  the competition to rank
 * @param supabase       optional client. Defaults to the cookie-scoped
 *                       server client (RLS, user session). The dormant
 *                       recompute cron passes a service-role client.
 */
export async function computeStandings(
  competitionId: string,
  supabase?: SupabaseClient,
): Promise<Standing[]> {
  const db = supabase ?? (await createClient());

  // --- Load: members, all events, tiebreakers (parallel) ---
  const [{ data: members }, { data: allEvents }, { data: tiebreakers }] =
    await Promise.all([
      db
        .from("competition_members")
        .select("user_id, users(id, display_name, avatar_url)")
        .eq("competition_id", competitionId),
      // ALL events (not just resulted) so round participation is correct.
      db
        .from("events")
        .select("id, event_name, sport, status, result_data, round_id")
        .eq("competition_id", competitionId),
      db
        .from("tiebreakers")
        .select("id, question_text, correct_value")
        .eq("competition_id", competitionId),
    ]);

  const memberList = members ?? [];
  const allEventList = allEvents ?? [];
  const tiebreakerList = tiebreakers ?? [];

  const resultedEventList = allEventList.filter((e) => e.status === "resulted");
  const allEventIds = allEventList.map((e) => e.id);

  // event_prediction_types for ALL events (max possible points) and ALL
  // predictions (round participation detection).
  let eventPredictionTypeList: Array<{ event_id: string; points: number }> = [];
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
      db
        .from("event_prediction_types")
        .select("event_id, points")
        .in("event_id", allEventIds),
      db
        .from("predictions")
        .select(
          "id, event_id, user_id, prediction_data, is_correct, is_partial, points_awarded, submitted_at",
        )
        .in("event_id", allEventIds),
    ]);
    eventPredictionTypeList = epts ?? [];
    predictionList = predictions ?? [];
  }

  // Tiebreaker answers
  const tiebreakerIds = tiebreakerList.map((t) => t.id);
  let tiebreakerAnswerList: Array<{
    tiebreaker_id: string;
    user_id: string;
    value: number;
  }> = [];

  if (tiebreakerIds.length > 0) {
    const { data: tbAnswers } = await db
      .from("tiebreaker_answers")
      .select("tiebreaker_id, user_id, value")
      .in("tiebreaker_id", tiebreakerIds);
    tiebreakerAnswerList = tbAnswers ?? [];
  }

  // --- Round-based scoring setup ---

  // Group events by round_id (null round_id -> "null" bucket).
  const eventsByRound = new Map<string | null, typeof allEventList>();
  for (const ev of allEventList) {
    const roundKey = ev.round_id ?? null;
    const bucket = eventsByRound.get(roundKey) ?? [];
    bucket.push(ev);
    eventsByRound.set(roundKey, bucket);
  }

  // Max possible points per round.
  const eptByEvent = new Map<string, number>();
  for (const ept of eventPredictionTypeList) {
    eptByEvent.set(ept.event_id, (eptByEvent.get(ept.event_id) ?? 0) + ept.points);
  }

  const maxPointsByRound = new Map<string | null, number>();
  for (const [roundKey, evs] of eventsByRound) {
    const max = evs.reduce((sum, ev) => sum + (eptByEvent.get(ev.id) ?? 0), 0);
    maxPointsByRound.set(roundKey, max);
  }

  // Scored rounds — rounds with at least one resulted event.
  const resultedEventIdSet = new Set(resultedEventList.map((e) => e.id));
  const scoredRoundKeys = new Set<string | null>();
  for (const [roundKey, evs] of eventsByRound) {
    if (evs.some((ev) => resultedEventIdSet.has(ev.id))) {
      scoredRoundKeys.add(roundKey);
    }
  }
  const totalScoredRounds = scoredRoundKeys.size;

  // event_id -> round_id
  const eventToRound = new Map<string, string | null>();
  for (const ev of allEventList) {
    eventToRound.set(ev.id, ev.round_id ?? null);
  }

  // Resulted-event details — used to scope display predictions.
  const resultedEventMap = new Map(
    resultedEventList.map((e) => [e.id, true as const]),
  );

  // Predictions on resulted events (per user) feed points/correct/resolved.
  // All predictions (per user) feed round participation.
  const resultedPredsByUser = new Map<string, typeof predictionList>();
  const allPredsByUser = new Map<string, typeof predictionList>();

  for (const p of predictionList) {
    const allList = allPredsByUser.get(p.user_id) ?? [];
    allList.push(p);
    allPredsByUser.set(p.user_id, allList);

    if (!resultedEventMap.has(p.event_id)) continue;
    const list = resultedPredsByUser.get(p.user_id) ?? [];
    list.push(p);
    resultedPredsByUser.set(p.user_id, list);
  }

  // Tiebreaker distance per user (ranking input — first tiebreaker wins).
  const primaryTiebreaker = tiebreakerList[0] ?? null;
  const tiebreakerDistanceByUser = new Map<string, number | null>();
  if (primaryTiebreaker) {
    const answersByUser = new Map<string, number>();
    for (const a of tiebreakerAnswerList) {
      if (a.tiebreaker_id === primaryTiebreaker.id) {
        answersByUser.set(a.user_id, a.value);
      }
    }
    for (const m of memberList) {
      const userObj = m.users as unknown as { id: string } | null;
      if (!userObj) continue;
      const answer = answersByUser.get(userObj.id) ?? null;
      const distance =
        primaryTiebreaker.correct_value !== null && answer !== null
          ? Math.abs(answer - primaryTiebreaker.correct_value)
          : null;
      tiebreakerDistanceByUser.set(userObj.id, distance);
    }
  }

  // --- Build standing entries ---
  interface InternalEntry extends Standing {
    percentage: number;
    tiebreakerDistance: number | null;
  }

  const entries: InternalEntry[] = memberList.map((m) => {
    const userObj = m.users as unknown as {
      id: string;
      display_name: string;
      avatar_url: string | null;
    } | null;

    const userId = userObj?.id ?? m.user_id;
    const displayName = userObj?.display_name || "Unknown";
    const avatarUrl = userObj?.avatar_url ?? null;

    const preds = resultedPredsByUser.get(userId) ?? [];
    const allUserPreds = allPredsByUser.get(userId) ?? [];

    const totalPoints = preds.reduce((sum, p) => sum + p.points_awarded, 0);
    const correctCount = preds.filter((p) => p.is_correct === true).length;
    const resolvedPreds = preds.filter((p) => p.is_correct !== null);
    const resolvedCount = resolvedPreds.length;

    // Rounds this user participated in (>= 1 prediction on any event in a
    // scored round).
    const userRoundsParticipated = new Set<string | null>();
    for (const p of allUserPreds) {
      const roundKey = eventToRound.get(p.event_id);
      if (roundKey !== undefined && scoredRoundKeys.has(roundKey)) {
        userRoundsParticipated.add(roundKey);
      }
    }

    const maxPossible = Array.from(userRoundsParticipated).reduce(
      (sum, rk) => sum + (maxPointsByRound.get(rk) ?? 0),
      0,
    );

    const percentage = maxPossible > 0 ? (totalPoints / maxPossible) * 100 : 0;
    const roundsParticipated = userRoundsParticipated.size;

    // Qualification: participated in at least 1/3 of all scored rounds.
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
      resolved_count: resolvedCount,
      qualified,
      percentage,
      tiebreakerDistance: tiebreakerDistanceByUser.get(userId) ?? null,
    };
  });

  // Sort: percentage desc, then tiebreaker distance asc.
  function sortKey(a: InternalEntry, b: InternalEntry): number {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    const aDist = a.tiebreakerDistance ?? Infinity;
    const bDist = b.tiebreakerDistance ?? Infinity;
    return aDist - bDist;
  }

  const qualifiedEntries = entries.filter((e) => e.qualified).sort(sortKey);
  const unqualifiedEntries = entries.filter((e) => !e.qualified).sort(sortKey);

  // Assign ranks among qualified entries (tied users share a rank).
  let currentRank = 1;
  for (let i = 0; i < qualifiedEntries.length; i++) {
    if (i === 0) {
      qualifiedEntries[i]!.rank = 1;
    } else {
      const prev = qualifiedEntries[i - 1]!;
      const curr = qualifiedEntries[i]!;
      const samePct = curr.percentage === prev.percentage;
      const sameTiebreaker =
        (curr.tiebreakerDistance ?? Infinity) ===
        (prev.tiebreakerDistance ?? Infinity);

      if (samePct && sameTiebreaker) {
        curr.rank = prev.rank;
      } else {
        currentRank = i + 1;
        curr.rank = currentRank;
      }
    }
  }

  // Unqualified entries get rank 0 (displayed as "—").
  for (const e of unqualifiedEntries) {
    e.rank = 0;
  }

  // Strip the internal-only fields — return the frozen Standing shape,
  // ordered exactly as /leaderboard renders: qualified then unqualified.
  return [...qualifiedEntries, ...unqualifiedEntries].map((e) => ({
    user_id: e.user_id,
    display_name: e.display_name,
    avatar_url: e.avatar_url,
    rank: e.rank,
    total_points: e.total_points,
    correct_count: e.correct_count,
    resolved_count: e.resolved_count,
    qualified: e.qualified,
  }));
}

/**
 * Compute a user's global hit rate across every competition they belong
 * to (group + personal), counting only resolved predictions (F3, §3.7).
 */
export async function computeGlobalHitRate(
  userId: string,
): Promise<GlobalHitRate> {
  void userId;
  throw new Error("not impl");
}
