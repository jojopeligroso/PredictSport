/**
 * Behavioural + engagement pressure tag assignment engine.
 *
 * Takes metrics from compute_reputation_stats RPC and assigns at most
 * one behavioural tag per member, respecting priority tiers, z-score
 * tiebreaking, and density caps.
 */
import type { BehaviouralTagMetrics } from "@/types/database";
import {
  BEHAVIOURAL_TAGS,
  ENGAGEMENT_TAGS,
  type TagDefinition,
} from "./tag-catalogue";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface TagAssignment {
  userId: string;
  tagName: string;
  tagCategory: "behavioural" | "engagement_pressure";
  stats: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

export function computeZScore(value: number, allValues: number[]): number {
  if (allValues.length < 2) return 0;
  const m = computeGroupMean(allValues);
  const variance =
    allValues.reduce((sum, v) => sum + (v - m) ** 2, 0) / allValues.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (value - m) / sd;
}

export function computeGroupMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeGroupMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Core assignment function
// ---------------------------------------------------------------------------

/**
 * Assign behavioural + engagement pressure tags for a competition round.
 *
 * @param metrics - Array of per-member metrics from compute_reputation_stats
 * @param totalFixtures - Total number of fixtures in the competition (used for engagement thresholds)
 * @param competitionCompletionPct - Percentage of competition completed (0-100)
 * @returns Array of tag assignments
 */
export function assignBehaviouralTags(
  metrics: BehaviouralTagMetrics[],
  totalFixtures: number,
  competitionCompletionPct: number,
): TagAssignment[] {
  if (metrics.length === 0) return [];

  const assignments: TagAssignment[] = [];

  // -----------------------------------------------------------------------
  // 1. Engagement pressure tags (independent of density cap)
  // -----------------------------------------------------------------------
  for (const member of metrics) {
    const fixturesMissed = member.events_available - member.total_predictions;

    for (const engTag of ENGAGEMENT_TAGS) {
      if (engTag.qualifies(member, metrics)) {
        // Ghost: no rejection, no chat
        // NPT: no rejection, HAS chat
        // Still in the Fight: rejectable
        assignments.push({
          userId: member.user_id,
          tagName: engTag.name,
          tagCategory: "engagement_pressure",
          stats: {
            engagement_rate: member.engagement_rate,
            fixtures_missed: fixturesMissed,
            total_fixtures: totalFixtures,
            competition_completion_pct: competitionCompletionPct,
          },
        });
        // One engagement tag per member max
        break;
      }
    }
  }

  // Track which users already have an engagement tag
  const usersWithEngagementTag = new Set(
    assignments.map((a) => a.userId),
  );

  // -----------------------------------------------------------------------
  // 2. Behavioural tags — one per member, highest priority wins
  // -----------------------------------------------------------------------

  interface Candidate {
    userId: string;
    tag: TagDefinition;
    zScoreValue: number;
    stats: Record<string, unknown>;
  }

  const candidates: Candidate[] = [];

  for (const member of metrics) {
    // Skip members with engagement pressure tags — they don't also get
    // behavioural tags (Ghost/NPT are more important signals)
    if (usersWithEngagementTag.has(member.user_id)) continue;

    // Find all qualifying tags for this member
    const qualifyingTags: Array<{
      tag: TagDefinition;
      zScoreValue: number;
    }> = [];

    for (const tag of BEHAVIOURAL_TAGS) {
      try {
        if (tag.qualifies(member, metrics)) {
          qualifyingTags.push({
            tag,
            zScoreValue: tag.zScore(member, metrics),
          });
        }
      } catch {
        // Skip tags that error during qualification (e.g., division by zero)
        continue;
      }
    }

    if (qualifyingTags.length === 0) continue;

    // Select highest priority tier; tiebreak by z-score within tier
    qualifyingTags.sort((a, b) => {
      if (a.tag.priorityTier !== b.tag.priorityTier) {
        return a.tag.priorityTier - b.tag.priorityTier;
      }
      return Math.abs(b.zScoreValue) - Math.abs(a.zScoreValue);
    });

    const best = qualifyingTags[0];
    candidates.push({
      userId: member.user_id,
      tag: best.tag,
      zScoreValue: best.zScoreValue,
      stats: buildStats(member, best.tag),
    });
  }

  // -----------------------------------------------------------------------
  // 3. Density control: target 20-40% of members tagged
  // -----------------------------------------------------------------------
  const totalMembers = metrics.length;
  const maxTagged = Math.ceil(totalMembers * 0.4);
  const hardCap = Math.ceil(totalMembers * 0.5);

  // Sort candidates: highest priority (lowest tier number) first,
  // then by z-score magnitude within tier
  candidates.sort((a, b) => {
    if (a.tag.priorityTier !== b.tag.priorityTier) {
      return a.tag.priorityTier - b.tag.priorityTier;
    }
    return Math.abs(b.zScoreValue) - Math.abs(a.zScoreValue);
  });

  // If candidates > 40%, trim from the bottom
  let selectedCandidates = candidates;
  if (candidates.length > maxTagged) {
    selectedCandidates = candidates.slice(0, maxTagged);
  }
  // Hard cap: never exceed 50%
  if (selectedCandidates.length > hardCap) {
    selectedCandidates = selectedCandidates.slice(0, hardCap);
  }

  // If candidates < 20%, that's fine — don't force tags

  // Convert to assignments
  for (const c of selectedCandidates) {
    assignments.push({
      userId: c.userId,
      tagName: c.tag.name,
      tagCategory: "behavioural",
      stats: c.stats,
    });
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Resolve the {stat} template variable per tag
// ---------------------------------------------------------------------------

function resolveStatForTag(
  tag: TagDefinition,
  member: BehaviouralTagMetrics,
): unknown {
  switch (tag.name) {
    case "Broken Clock":
      return member.most_repeated_score;
    case "One-Trick Pony":
      return member.unique_scores_used;
    case "All-Square":
      return member.draws_predicted;
    case "Not a Chance":
      return member.blowouts_predicted;
    case "The Tinkerer":
    case "Fire and Forget":
      return member.prediction_changes;
    case "Defence Wins Championships":
    case "Are You Not Entertained":
      return member.avg_total_goals?.toFixed(1);
    case "Ghost":
    case "No Participation Trophies":
      return member.events_available - member.total_predictions;
    case "Still in the Fight":
      return member.events_available - member.total_predictions;
    case "Ice Cold":
      return member.winner_total > 0
        ? Math.round((member.winner_correct / member.winner_total) * 100)
        : 0;
    case "Scattergun":
      return member.winner_total > 0
        ? Math.round((member.winner_correct / member.winner_total) * 100)
        : 0;
    case "Dead Centre":
      return "all";
    default:
      return undefined;
  }
}

// Build stats object for a tag assignment
// ---------------------------------------------------------------------------

function buildStats(
  member: BehaviouralTagMetrics,
  tag: TagDefinition,
): Record<string, unknown> {
  const majorityPct =
    member.majority_picks + member.minority_picks > 0
      ? Math.round(
          (member.majority_picks /
            (member.majority_picks + member.minority_picks)) *
            100,
        )
      : 0;

  // Resolve {pct} based on which metric the tag measures
  const memberAccuracy =
    member.winner_total > 0
      ? Math.round((member.winner_correct / member.winner_total) * 100)
      : 0;
  const pct =
    tag.metric === "majority_pct"
      ? majorityPct
      : tag.metric === "winner_accuracy"
        ? memberAccuracy
        : tag.metric === "engagement_rate" || tag.category === "engagement_pressure"
          ? Math.round(member.engagement_rate * 100)
          : Math.round(member.contrarian_pct);

  return {
    pct,
    score:
      tag.name === "Broken Clock"
        ? member.most_repeated_score
        : tag.metric.includes("avg_total_goals")
          ? member.avg_total_goals?.toFixed(1)
          : tag.metric.includes("earliest_submission")
            ? member.earliest_submission_lead_hrs
            : tag.metric.includes("latest_submission")
              ? Math.round(member.latest_submission_lead_mins)
              : undefined,
    stat: resolveStatForTag(tag, member),
    total: member.events_available,
    majority_pct: majorityPct,
    engagement_rate: member.engagement_rate,
    winner_correct: member.winner_correct,
    winner_total: member.winner_total,
    exact_correct: member.exact_correct,
    exact_total: member.exact_total,
    repeat_score_count: member.repeat_score_count,
    most_repeated_score: member.most_repeated_score,
    prediction_changes: member.prediction_changes,
    contrarian_pct: member.contrarian_pct,
    avg_total_goals: member.avg_total_goals,
  };
}
