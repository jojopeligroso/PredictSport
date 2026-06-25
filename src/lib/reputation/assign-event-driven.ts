/**
 * Event-driven tag assignment engine.
 *
 * Checks each member's performance on a single event and assigns
 * event-driven tags (Nailed It, Crystal Ball, Giant Killer, etc.).
 * Capped to ONE tag per user per event — highest priority tier wins.
 */
import type { EventTagMetric, MemberTag } from "@/types/database";
import { getTagDefinition } from "./tag-catalogue";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface EventTagAssignment {
  userId: string;
  tagName: string;
  eventId: string;
  stats: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Minimum streak length for "On a Roll" */
const ON_A_ROLL_STREAK = 3;

/** Minimum streak length for "On Fire" */
const ON_FIRE_STREAK = 5;

/** Minimum wrong streak for "Cold Streak" */
const COLD_STREAK_MIN = 3;

/** Minimum position drop for "Heartbreaker" */
const HEARTBREAKER_DROP = 3;

/** Minimum position gain for "The Reverse" */
const REVERSE_GAIN = 3;

/** Minimum consecutive exact scores for "The Professor" */
const PROFESSOR_EXACT_STREAK = 2;

/** Solo threshold: <= 5% of group picked the same winner */
const SOLO_PCT_THRESHOLD = 5;

/** Max recipients per tag name per event */
const MAX_PER_TAG_PER_EVENT = 2;

// ---------------------------------------------------------------------------
// Core assignment function
// ---------------------------------------------------------------------------

/**
 * Assign event-driven tags after a single event result is confirmed.
 *
 * @param eventMetrics - Rows from compute_event_tag_metrics RPC (one per member)
 * @param competitionId - Competition UUID
 * @param eventId - Event UUID
 * @param existingTags - All existing member_tags for this competition (for one-time checks)
 * @returns Array of event tag assignments
 */
export function assignEventDrivenTags(
  eventMetrics: EventTagMetric[],
  competitionId: string,
  eventId: string,
  existingTags: MemberTag[],
): EventTagAssignment[] {
  const assignments: EventTagAssignment[] = [];

  // Check one-time tags
  const hasFirstBlood = existingTags.some(
    (t) => t.tag_name === "First Blood" && t.competition_id === competitionId,
  );
  const hasWhistle = existingTags.some(
    (t) => t.tag_name === "The Whistle" && t.competition_id === competitionId,
  );

  // Pre-compute group-level aggregates
  const predicted = eventMetrics.filter((m) => m.predicted);
  const exactCorrectUsers = eventMetrics.filter((m) => m.exact_correct);
  const winnersCorrectCount = predicted.filter((m) => m.winner_correct).length;
  const bestCorrectStreak = predicted.length > 0
    ? Math.max(...predicted.map((m) => m.current_correct_streak))
    : 0;
  const worstWrongStreak = predicted.length > 0
    ? Math.max(...predicted.map((m) => m.current_wrong_streak))
    : 0;
  const avgExactScoreCount = predicted.length > 0
    ? (
        predicted.reduce((sum, m) => sum + m.exact_score_count_total, 0) /
        predicted.length
      ).toFixed(1)
    : "0";
  const bestExactStreak = predicted.length > 0
    ? Math.max(...predicted.map((m) => m.current_exact_score_streak))
    : 0;

  for (const metric of eventMetrics) {
    if (!metric.predicted) continue;

    // --- Nailed It: exact score correct ---
    if (metric.exact_correct) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Nailed It",
        eventId,
        stats: {
          display_name: metric.display_name,
          exact_correct: true,
          others_exact: exactCorrectUsers.length - 1,
          stat: exactCorrectUsers.length - 1,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- Crystal Ball: exact correct AND rare (only 1-2 got it) ---
    if (metric.exact_correct && exactCorrectUsers.length <= 2) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Crystal Ball",
        eventId,
        stats: {
          display_name: metric.display_name,
          exact_correct: true,
          total_who_got_exact: exactCorrectUsers.length,
          stat: exactCorrectUsers.length,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- Hat Trick: 3rd exact score correct in the competition ---
    if (metric.exact_correct && metric.exact_score_count_total === 3) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Hat Trick",
        eventId,
        stats: {
          display_name: metric.display_name,
          exact_score_count: metric.exact_score_count_total,
          stat: metric.exact_score_count_total,
          contextStat: avgExactScoreCount,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- Giant Killer: minority pick + winner correct ---
    if (metric.was_minority && metric.winner_correct) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Giant Killer",
        eventId,
        stats: {
          display_name: metric.display_name,
          pct_with_same_pick: metric.pct_with_same_pick,
          stat: Math.round(100 - metric.pct_with_same_pick),
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- Solo: extreme minority (<= 5% of group) + winner correct ---
    if (
      metric.winner_correct &&
      metric.pct_with_same_pick > 0 &&
      metric.pct_with_same_pick <= SOLO_PCT_THRESHOLD
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "A League of Their Own",
        eventId,
        stats: {
          display_name: metric.display_name,
          pct_with_same_pick: metric.pct_with_same_pick,
          stat: Math.round(metric.pct_with_same_pick),
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- On a Roll: correct streak >= 3 ---
    if (metric.current_correct_streak >= ON_A_ROLL_STREAK) {
      assignments.push({
        userId: metric.user_id,
        tagName: "On a Roll",
        eventId,
        stats: {
          display_name: metric.display_name,
          streak: metric.current_correct_streak,
          stat: metric.current_correct_streak,
          contextStat: bestCorrectStreak,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- On Fire: correct streak >= 5 ---
    if (metric.current_correct_streak >= ON_FIRE_STREAK) {
      assignments.push({
        userId: metric.user_id,
        tagName: "On Fire",
        eventId,
        stats: {
          display_name: metric.display_name,
          streak: metric.current_correct_streak,
          stat: metric.current_correct_streak,
          contextStat: bestCorrectStreak,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- Cold Streak: wrong streak >= 3 ---
    if (metric.current_wrong_streak >= COLD_STREAK_MIN) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Cold Streak",
        eventId,
        stats: {
          display_name: metric.display_name,
          streak: metric.current_wrong_streak,
          stat: metric.current_wrong_streak,
          contextStat: worstWrongStreak,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- Heartbreaker: dropped N+ places ---
    if (
      metric.position_before > 0 &&
      metric.position_after > 0 &&
      metric.position_after - metric.position_before >= HEARTBREAKER_DROP
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Heartbreaker",
        eventId,
        stats: {
          display_name: metric.display_name,
          position_before: metric.position_before,
          position_after: metric.position_after,
          drop: metric.position_after - metric.position_before,
          stat: metric.position_after - metric.position_before,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- The Reverse: climbed N+ places ---
    if (
      metric.position_before > 0 &&
      metric.position_after > 0 &&
      metric.position_before - metric.position_after >= REVERSE_GAIN
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "The Reverse",
        eventId,
        stats: {
          display_name: metric.display_name,
          position_before: metric.position_before,
          position_after: metric.position_after,
          gain: metric.position_before - metric.position_after,
          stat: metric.position_before - metric.position_after,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- The Professor: 2+ consecutive exact scores ---
    if (
      metric.exact_correct &&
      metric.current_exact_score_streak >= PROFESSOR_EXACT_STREAK
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "The Professor",
        eventId,
        stats: {
          display_name: metric.display_name,
          exact_streak: metric.current_exact_score_streak,
          stat: metric.current_exact_score_streak,
          contextStat: bestExactStreak,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

    // --- Clean Sheet: predicted 0 goals for one side AND exact score correct ---
    if (metric.exact_correct && metric.exact_score_prediction_data) {
      const data = metric.exact_score_prediction_data;
      const home = Number(data.home ?? -1);
      const away = Number(data.away ?? -1);
      if (home === 0 || away === 0) {
        assignments.push({
          userId: metric.user_id,
          tagName: "Clean Sheet",
          eventId,
          stats: {
            display_name: metric.display_name,
            score: `${home}-${away}`,
            stat: exactCorrectUsers.length - 1,
            totalPointsThisEvent: metric.total_points_this_event,
          },
        });
      }
    }

    // --- First Blood: first confirmed event, winner correct (one-time) ---
    if (
      metric.is_first_confirmed_event &&
      metric.winner_correct &&
      !hasFirstBlood
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "First Blood",
        eventId,
        stats: {
          display_name: metric.display_name,
          stat: winnersCorrectCount - 1,
          totalPointsThisEvent: metric.total_points_this_event,
        },
      });
    }

  }

  // --- The Whistle: last event of competition (one-time, applies to top scorer) ---
  const isLastEvent = eventMetrics.some((m) => m.is_last_confirmed_event);
  if (isLastEvent && !hasWhistle) {
    const topScorer = eventMetrics
      .filter((m) => m.predicted)
      .sort(
        (a, b) => b.total_points_this_event - a.total_points_this_event,
      )[0];
    if (topScorer) {
      assignments.push({
        userId: topScorer.user_id,
        tagName: "The Whistle",
        eventId,
        stats: {
          display_name: topScorer.display_name,
          totalPointsThisEvent: topScorer.total_points_this_event,
        },
      });
    }
  }

  // Deduplicate: one tag per user per event, highest priority tier wins.
  // Lower tier number = higher priority. Within same tier, first assigned wins
  // (catalogue order acts as tiebreaker).
  const bestByUser = new Map<string, EventTagAssignment>();
  const tierByUser = new Map<string, number>();

  for (const a of assignments) {
    const def = getTagDefinition(a.tagName);
    const tier = def?.priorityTier ?? 4;
    const currentTier = tierByUser.get(a.userId) ?? Infinity;

    if (tier < currentTier) {
      bestByUser.set(a.userId, a);
      tierByUser.set(a.userId, tier);
    }
  }

  const perUser = Array.from(bestByUser.values());

  // Cap: at most MAX_PER_TAG_PER_EVENT recipients per tag name
  const byTag = new Map<string, EventTagAssignment[]>();
  for (const a of perUser) {
    const arr = byTag.get(a.tagName) ?? [];
    arr.push(a);
    byTag.set(a.tagName, arr);
  }

  const result: EventTagAssignment[] = [];
  for (const [, group] of byTag) {
    if (group.length <= MAX_PER_TAG_PER_EVENT) {
      result.push(...group);
    } else {
      group.sort(
        (a, b) =>
          ((b.stats.totalPointsThisEvent as number) ?? 0) -
          ((a.stats.totalPointsThisEvent as number) ?? 0),
      );
      result.push(...group.slice(0, MAX_PER_TAG_PER_EVENT));
    }
  }

  return result;
}
