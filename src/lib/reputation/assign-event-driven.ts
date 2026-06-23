/**
 * Event-driven tag assignment engine.
 *
 * Checks each member's performance on a single event and assigns
 * event-driven tags (Nailed It, Crystal Ball, Giant Killer, etc.).
 * No density cap for event-driven tags.
 */
import type { EventTagMetric, MemberTag } from "@/types/database";

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

/** Submission within 5 min of lock for "The Sweater" */
const SWEATER_SECONDS = 300;

/** Submission 24h+ before lock for "The Professor" */
const PROFESSOR_SECONDS = 86400;

/** Solo threshold: <= 5% of group picked the same winner */
const SOLO_PCT_THRESHOLD = 5;

/** Flat Track Bully: >= 75% of group picked the same winner */
const FLAT_TRACK_PCT = 75;

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

  // Count exact correct for Crystal Ball rarity check
  const exactCorrectUsers = eventMetrics.filter((m) => m.exact_correct);

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
        tagName: "Solo",
        eventId,
        stats: {
          display_name: metric.display_name,
          pct_with_same_pick: metric.pct_with_same_pick,
        },
      });
    }

    // --- The Flat Track Bully: overwhelming majority + winner correct ---
    if (
      metric.winner_correct &&
      metric.pct_with_same_pick >= FLAT_TRACK_PCT
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "The Flat Track Bully",
        eventId,
        stats: {
          display_name: metric.display_name,
          pct_with_same_pick: metric.pct_with_same_pick,
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
        },
      });
    }

    // --- The Sweater: submitted within 5 min of lock AND winner correct ---
    if (
      metric.winner_correct &&
      metric.submission_seconds_before_lock > 0 &&
      metric.submission_seconds_before_lock <= SWEATER_SECONDS
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "The Sweater",
        eventId,
        stats: {
          display_name: metric.display_name,
          seconds_before_lock: Math.round(
            metric.submission_seconds_before_lock,
          ),
        },
      });
    }

    // --- The Professor: submitted 24h+ before lock AND exact score correct ---
    if (
      metric.exact_correct &&
      metric.submission_seconds_before_lock >= PROFESSOR_SECONDS
    ) {
      assignments.push({
        userId: metric.user_id,
        tagName: "The Professor",
        eventId,
        stats: {
          display_name: metric.display_name,
          hours_before_lock: Math.round(
            metric.submission_seconds_before_lock / 3600,
          ),
        },
      });
    }

    // --- Clean Sheet: predicted 0 goals for one side AND exact score correct ---
    if (metric.exact_correct && metric.exact_score_prediction_data) {
      const data = metric.exact_score_prediction_data;
      const home = Number(data.home_score ?? -1);
      const away = Number(data.away_score ?? -1);
      if (home === 0 || away === 0) {
        assignments.push({
          userId: metric.user_id,
          tagName: "Clean Sheet",
          eventId,
          stats: {
            display_name: metric.display_name,
            score: `${home}-${away}`,
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
        },
      });
    }

    // --- Last Gasp: last confirmed event, winner correct ---
    if (metric.is_last_confirmed_event && metric.winner_correct) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Last Gasp",
        eventId,
        stats: {
          display_name: metric.display_name,
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
        },
      });
    }
  }

  return assignments;
}
