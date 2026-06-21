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

// ---------------------------------------------------------------------------
// Core assignment function
// ---------------------------------------------------------------------------

/**
 * Assign event-driven tags after a single event result is confirmed.
 *
 * @param eventMetrics - Rows from compute_event_tag_metrics RPC
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
  const exactCorrectUsers = eventMetrics.filter(
    (m) => m.exact_correct,
  );
  const totalPredictors = eventMetrics.filter((m) => m.predicted).length;

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

    // --- Crystal Ball: exact correct AND rare (only 1-2 got it, or minority pick) ---
    if (metric.exact_correct && exactCorrectUsers.length <= 2) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Crystal Ball",
        eventId,
        stats: {
          display_name: metric.display_name,
          exact_correct: true,
          total_who_got_exact: exactCorrectUsers.length,
          total_predictors: totalPredictors,
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
          was_minority: true,
          winner_correct: true,
        },
      });
    }

    // --- On a Roll: streak >= 3 ---
    if (metric.current_streak >= ON_A_ROLL_STREAK) {
      assignments.push({
        userId: metric.user_id,
        tagName: "On a Roll",
        eventId,
        stats: {
          display_name: metric.display_name,
          streak: metric.current_streak,
        },
      });
    }

    // --- On Fire: streak >= 5 ---
    if (metric.current_streak >= ON_FIRE_STREAK) {
      assignments.push({
        userId: metric.user_id,
        tagName: "On Fire",
        eventId,
        stats: {
          display_name: metric.display_name,
          streak: metric.current_streak,
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

    // --- Cold Streak: wrong streak >= 3 ---
    // Note: current_streak is correct streak, so we check if it's 0
    // and infer wrong streak from context. For simplicity, we track this
    // via the points_awarded: if 0 points on this event AND current_streak is 0,
    // we'd need a wrong_streak counter. Since the RPC doesn't return wrong_streak,
    // we skip this for now — it would need an RPC enhancement.

    // --- First Blood: first event of competition, winner correct (one-time) ---
    if (metric.is_first_event && metric.winner_correct && !hasFirstBlood) {
      assignments.push({
        userId: metric.user_id,
        tagName: "First Blood",
        eventId,
        stats: {
          display_name: metric.display_name,
          is_first_event: true,
          winner_correct: true,
        },
      });
    }

    // --- Last Gasp: last event, winner correct ---
    if (metric.is_last_event && metric.winner_correct) {
      assignments.push({
        userId: metric.user_id,
        tagName: "Last Gasp",
        eventId,
        stats: {
          display_name: metric.display_name,
          is_last_event: true,
          winner_correct: true,
        },
      });
    }
  }

  // --- The Whistle: last event of competition (one-time, applies to all) ---
  const isLastEvent = eventMetrics.some((m) => m.is_last_event);
  if (isLastEvent && !hasWhistle) {
    // Assign to the top scorer or first member as the "recipient"
    const topScorer = eventMetrics
      .filter((m) => m.predicted)
      .sort((a, b) => b.points_awarded - a.points_awarded)[0];
    if (topScorer) {
      assignments.push({
        userId: topScorer.user_id,
        tagName: "The Whistle",
        eventId,
        stats: {
          display_name: topScorer.display_name,
          is_last_event: true,
        },
      });
    }
  }

  // --- Clean Sheet: predicted 0 goals for one side + exact score correct ---
  // This requires access to prediction_data which isn't in EventTagMetric.
  // Will be checked via the caller if prediction data is available.

  return assignments;
}
