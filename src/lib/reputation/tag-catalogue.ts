/**
 * Tag Catalogue — all tag definitions for the reputation system.
 *
 * Phase 1 safe copy only. No edgier variants.
 */
import type { BehaviouralTagMetrics } from "@/types/database";

// ---------------------------------------------------------------------------
// Tag definition shape
// ---------------------------------------------------------------------------

export interface TagDefinition {
  name: string;
  category: "behavioural" | "event_driven" | "engagement_pressure";
  priorityTier: 1 | 2 | 3 | 4;
  metric: string;
  /** Returns true if the member qualifies based on their metrics and the group */
  qualifies: (
    member: BehaviouralTagMetrics,
    allMembers: BehaviouralTagMetrics[],
  ) => boolean;
  /** Returns the z-score deviation for tiebreaking within priority tier */
  zScore: (
    member: BehaviouralTagMetrics,
    allMembers: BehaviouralTagMetrics[],
  ) => number;
  /** Layer 1: Tag name (2-4 words) */
  layer1: string;
  /** Layer 2: Second-person subtitle template */
  layer2: string;
  /** Layer 3: Third-person chat announcement template */
  layer3: string;
  /** Data fact card content */
  factCard: {
    fact: string;
    statTemplate: string;
    contextTemplate: string;
  };
  /** Visual treatment */
  visual: {
    borderColor: string;
    opacity?: number;
    gold?: boolean;
  };
  /** Whether this tag can be rejected by the user */
  rejectable: boolean;
  /** Whether this tag gets a chat announcement */
  announced: boolean;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function zScore(value: number, values: number[]): number {
  const sd = stdDev(values);
  if (sd === 0) return 0;
  return (value - mean(values)) / sd;
}

function isHighest(value: number, allValues: number[]): boolean {
  if (allValues.length === 0) return false;
  const max = Math.max(...allValues);
  return value === max && value > 0;
}

function isLowest(value: number, allValues: number[]): boolean {
  if (allValues.length === 0) return false;
  const min = Math.min(...allValues);
  return value === min;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function extract(
  members: BehaviouralTagMetrics[],
  field: keyof BehaviouralTagMetrics,
): number[] {
  return members.map((m) => Number(m[field]));
}

// ---------------------------------------------------------------------------
// Behavioural tags
// ---------------------------------------------------------------------------

const maverick: TagDefinition = {
  name: "Maverick",
  category: "behavioural",
  priorityTier: 1,
  metric: "contrarian_pct+winner_correct",
  qualifies: (member, all) => {
    // Top contrarian AND above-average accuracy
    const contrarians = extract(all, "contrarian_pct");
    const accuracies = all.map((m) =>
      m.winner_total > 0 ? m.winner_correct / m.winner_total : 0,
    );
    const memberAccuracy =
      member.winner_total > 0 ? member.winner_correct / member.winner_total : 0;
    return (
      isHighest(member.contrarian_pct, contrarians) &&
      member.contrarian_pct > 30 &&
      memberAccuracy > mean(accuracies) &&
      member.winner_total >= 3
    );
  },
  zScore: (member, all) => {
    const contrarians = extract(all, "contrarian_pct");
    return zScore(member.contrarian_pct, contrarians);
  },
  layer1: "Maverick",
  layer2: "You went against the group {pct}% of the time and still got it right.",
  layer3: "{name} went against the group {pct}% of the time and still got it right.",
  factCard: {
    fact: "Picked against the majority more than anyone else, and was accurate.",
    statTemplate: "{pct}% contrarian picks",
    contextTemplate: "Group average: {stat}%",
  },
  visual: { borderColor: "#f59e0b", gold: true },
  rejectable: true,
  announced: true,
};

const theAnorak: TagDefinition = {
  name: "The Anorak",
  category: "behavioural",
  priorityTier: 2,
  metric: "earliest_submission_lead_hrs+minority_picks",
  qualifies: (member, all) => {
    // Earliest submitter AND has minority accuracy
    const leadTimes = extract(all, "earliest_submission_lead_hrs");
    const memberMinorityRate =
      member.minority_picks + member.majority_picks > 0
        ? member.minority_picks / (member.minority_picks + member.majority_picks)
        : 0;
    return (
      isHighest(member.earliest_submission_lead_hrs, leadTimes) &&
      member.earliest_submission_lead_hrs > 2 &&
      memberMinorityRate > 0.2 &&
      member.total_predictions >= 3
    );
  },
  zScore: (member, all) => {
    const leadTimes = extract(all, "earliest_submission_lead_hrs");
    return zScore(member.earliest_submission_lead_hrs, leadTimes);
  },
  layer1: "The Anorak",
  layer2: "First to predict, {score} hours before anyone else, with a mind of your own.",
  layer3: "{name} predicted first, {score} hours ahead, with a mind of their own.",
  factCard: {
    fact: "Earliest predictions in the group, with independent picks.",
    statTemplate: "{score}h average lead time",
    contextTemplate: "Group average: {stat}h",
  },
  visual: { borderColor: "#f59e0b", gold: true },
  rejectable: true,
  announced: true,
};

const darkHorse: TagDefinition = {
  name: "Dark Horse",
  category: "behavioural",
  priorityTier: 3,
  metric: "contrarian_pct",
  qualifies: (member, all) => {
    const vals = extract(all, "contrarian_pct");
    return isHighest(member.contrarian_pct, vals) && member.contrarian_pct > 20;
  },
  zScore: (member, all) => zScore(member.contrarian_pct, extract(all, "contrarian_pct")),
  layer1: "Dark Horse",
  layer2: "You went against the group on {pct}% of your picks.",
  layer3: "{name} went against the group on {pct}% of picks.",
  factCard: {
    fact: "Highest percentage of minority picks in the group.",
    statTemplate: "{pct}% contrarian",
    contextTemplate: "Group average: {stat}%",
  },
  visual: { borderColor: "#6366f1" },
  rejectable: true,
  announced: true,
};

const defenceWinsChampionships: TagDefinition = {
  name: "Defence Wins Championships",
  category: "behavioural",
  priorityTier: 3,
  metric: "avg_total_goals",
  qualifies: (member, all) => {
    const vals = extract(all, "avg_total_goals");
    return (
      isLowest(member.avg_total_goals, vals) &&
      member.exact_total >= 3
    );
  },
  zScore: (member, all) => {
    // Lower is "more extreme" — negate so higher z = more extreme low
    return -zScore(member.avg_total_goals, extract(all, "avg_total_goals"));
  },
  layer1: "Defence Wins Championships",
  layer2: "Your predicted scorelines averaged just {score} total goals.",
  layer3: "{name} predicted an average of just {score} total goals per match.",
  factCard: {
    fact: "Lowest average total goals in predicted scorelines.",
    statTemplate: "{score} avg total goals",
    contextTemplate: "Group average: {stat}",
  },
  visual: { borderColor: "#0ea5e9" },
  rejectable: true,
  announced: true,
};

const areYouNotEntertained: TagDefinition = {
  name: "Are You Not Entertained",
  category: "behavioural",
  priorityTier: 3,
  metric: "avg_total_goals",
  qualifies: (member, all) => {
    const vals = extract(all, "avg_total_goals");
    return isHighest(member.avg_total_goals, vals) && member.exact_total >= 3;
  },
  zScore: (member, all) =>
    zScore(member.avg_total_goals, extract(all, "avg_total_goals")),
  layer1: "Are You Not Entertained",
  layer2: "Your predicted scorelines averaged {score} total goals.",
  layer3: "{name} predicted an average of {score} total goals per match.",
  factCard: {
    fact: "Highest average total goals in predicted scorelines.",
    statTemplate: "{score} avg total goals",
    contextTemplate: "Group average: {stat}",
  },
  visual: { borderColor: "#ef4444" },
  rejectable: true,
  announced: true,
};

const allSquare: TagDefinition = {
  name: "All-Square",
  category: "behavioural",
  priorityTier: 3,
  metric: "draws_predicted",
  qualifies: (member, all) => {
    const vals = extract(all, "draws_predicted");
    return isHighest(member.draws_predicted, vals) && member.draws_predicted >= 2;
  },
  zScore: (member, all) =>
    zScore(member.draws_predicted, extract(all, "draws_predicted")),
  layer1: "All-Square",
  layer2: "You predicted {stat} draws, more than anyone else in the group.",
  layer3: "{name} predicted {stat} draws, more than anyone else.",
  factCard: {
    fact: "Most draw predictions in the group.",
    statTemplate: "{stat} draws predicted",
    contextTemplate: "Group average: {stat}",
  },
  visual: { borderColor: "#8b5cf6" },
  rejectable: true,
  announced: true,
};

const brokenClock: TagDefinition = {
  name: "Broken Clock",
  category: "behavioural",
  priorityTier: 3,
  metric: "repeat_score_count",
  qualifies: (member, all) => {
    const vals = extract(all, "repeat_score_count");
    return (
      isHighest(member.repeat_score_count, vals) &&
      member.repeat_score_count >= 3
    );
  },
  zScore: (member, all) =>
    zScore(member.repeat_score_count, extract(all, "repeat_score_count")),
  layer1: "Broken Clock",
  layer2: "You predicted {score} {stat} times. Commit to the bit.",
  layer3: "{name} predicted {score} {stat} times. Committed to the bit.",
  factCard: {
    fact: "Most repeated single scoreline prediction.",
    statTemplate: "{score} predicted {stat} times",
    contextTemplate: "Group average: {stat} repeats",
  },
  visual: { borderColor: "#f97316" },
  rejectable: true,
  announced: true,
};

const oneTrickPony: TagDefinition = {
  name: "One-Trick Pony",
  category: "behavioural",
  priorityTier: 3,
  metric: "unique_scores_used",
  qualifies: (member, all) => {
    const vals = extract(all, "unique_scores_used");
    return (
      isLowest(member.unique_scores_used, vals) &&
      member.exact_total >= 3 &&
      member.unique_scores_used >= 1
    );
  },
  zScore: (member, all) =>
    -zScore(member.unique_scores_used, extract(all, "unique_scores_used")),
  layer1: "One-Trick Pony",
  layer2: "You only used {stat} different scorelines across all your predictions.",
  layer3: "{name} only used {stat} different scorelines.",
  factCard: {
    fact: "Fewest unique scoreline predictions in the group.",
    statTemplate: "{stat} unique scores",
    contextTemplate: "Group average: {stat} unique",
  },
  visual: { borderColor: "#ec4899" },
  rejectable: true,
  announced: true,
};

const notAChance: TagDefinition = {
  name: "Not a Chance",
  category: "behavioural",
  priorityTier: 3,
  metric: "blowouts_predicted",
  qualifies: (member, all) => {
    const vals = extract(all, "blowouts_predicted");
    return (
      isHighest(member.blowouts_predicted, vals) &&
      member.blowouts_predicted >= 2
    );
  },
  zScore: (member, all) =>
    zScore(member.blowouts_predicted, extract(all, "blowouts_predicted")),
  layer1: "Not a Chance",
  layer2: "You predicted {stat} blowout scorelines (3+ goal difference).",
  layer3: "{name} predicted {stat} blowout scorelines.",
  factCard: {
    fact: "Most blowout predictions (3+ goal margin) in the group.",
    statTemplate: "{stat} blowouts",
    contextTemplate: "Group average: {stat}",
  },
  visual: { borderColor: "#dc2626" },
  rejectable: true,
  announced: true,
};

const theSureThing: TagDefinition = {
  name: "The Sure Thing",
  category: "behavioural",
  priorityTier: 3,
  metric: "majority_pct",
  qualifies: (member, all) => {
    const memberMajPct =
      member.majority_picks + member.minority_picks > 0
        ? (member.majority_picks /
            (member.majority_picks + member.minority_picks)) *
          100
        : 0;
    const allMajPcts = all.map((m) =>
      m.majority_picks + m.minority_picks > 0
        ? (m.majority_picks / (m.majority_picks + m.minority_picks)) * 100
        : 0,
    );
    return isHighest(memberMajPct, allMajPcts) && memberMajPct > 60;
  },
  zScore: (member, all) => {
    const memberMajPct =
      member.majority_picks + member.minority_picks > 0
        ? (member.majority_picks /
            (member.majority_picks + member.minority_picks)) *
          100
        : 0;
    const allMajPcts = all.map((m) =>
      m.majority_picks + m.minority_picks > 0
        ? (m.majority_picks / (m.majority_picks + m.minority_picks)) * 100
        : 0,
    );
    return zScore(memberMajPct, allMajPcts);
  },
  layer1: "The Sure Thing",
  layer2: "You went with the majority on {pct}% of your picks.",
  layer3: "{name} went with the majority on {pct}% of picks.",
  factCard: {
    fact: "Highest percentage of majority-aligned picks.",
    statTemplate: "{pct}% with majority",
    contextTemplate: "Group average: {stat}%",
  },
  visual: { borderColor: "#22c55e" },
  rejectable: true,
  announced: true,
};

const theTinkerer: TagDefinition = {
  name: "The Tinkerer",
  category: "behavioural",
  priorityTier: 3,
  metric: "prediction_changes",
  qualifies: (member, all) => {
    const vals = extract(all, "prediction_changes");
    return (
      isHighest(member.prediction_changes, vals) &&
      member.prediction_changes >= 3
    );
  },
  zScore: (member, all) =>
    zScore(member.prediction_changes, extract(all, "prediction_changes")),
  layer1: "The Tinkerer",
  layer2: "You changed your predictions {stat} times.",
  layer3: "{name} changed their predictions {stat} times.",
  factCard: {
    fact: "Most prediction changes in the group.",
    statTemplate: "{stat} changes",
    contextTemplate: "Group average: {stat} changes",
  },
  visual: { borderColor: "#14b8a6" },
  rejectable: true,
  announced: true,
};

const fireAndForget: TagDefinition = {
  name: "Fire and Forget",
  category: "behavioural",
  priorityTier: 3,
  metric: "prediction_changes",
  qualifies: (member, all) => {
    const vals = extract(all, "prediction_changes");
    return (
      isLowest(member.prediction_changes, vals) &&
      member.prediction_changes === 0 &&
      member.engagement_rate >= 50
    );
  },
  zScore: (member, all) =>
    -zScore(member.prediction_changes, extract(all, "prediction_changes")),
  layer1: "Fire and Forget",
  layer2: "You never changed a single prediction. Locked in from the start.",
  layer3: "{name} never changed a single prediction.",
  factCard: {
    fact: "Zero prediction changes with high engagement.",
    statTemplate: "0 changes",
    contextTemplate: "Group average: {stat} changes",
  },
  visual: { borderColor: "#0891b2" },
  rejectable: true,
  announced: true,
};

const vibesOnly: TagDefinition = {
  name: "Vibes Only",
  category: "behavioural",
  priorityTier: 3,
  metric: "latest_submission_lead_mins+majority_pct",
  qualifies: (member, all) => {
    // Latest submitter + follows majority
    const latestLeads = extract(all, "latest_submission_lead_mins");
    const memberMajPct =
      member.majority_picks + member.minority_picks > 0
        ? (member.majority_picks /
            (member.majority_picks + member.minority_picks)) *
          100
        : 0;
    return (
      isLowest(member.latest_submission_lead_mins, latestLeads) &&
      member.latest_submission_lead_mins < 60 &&
      memberMajPct > 50 &&
      member.total_predictions >= 3
    );
  },
  zScore: (member, all) =>
    -zScore(
      member.latest_submission_lead_mins,
      extract(all, "latest_submission_lead_mins"),
    ),
  layer1: "Vibes Only",
  layer2: "Last to predict, going with the crowd. No overthinking here.",
  layer3: "{name} predicted last, going with the crowd. No overthinking there.",
  factCard: {
    fact: "Latest submissions with majority-aligned picks.",
    statTemplate: "{score}min average lead time",
    contextTemplate: "Group average: {stat}min",
  },
  visual: { borderColor: "#a855f7" },
  rejectable: true,
  announced: true,
};

const deadCentre: TagDefinition = {
  name: "Dead Centre",
  category: "behavioural",
  priorityTier: 4,
  metric: "composite_median_distance",
  qualifies: (member, all) => {
    if (all.length < 4) return false;
    // Closest to group median across multiple metrics
    const metrics: (keyof BehaviouralTagMetrics)[] = [
      "engagement_rate",
      "contrarian_pct",
      "avg_total_goals",
      "prediction_changes",
    ];
    const distances = all.map((m) => {
      let totalDist = 0;
      for (const metric of metrics) {
        const vals = extract(all, metric);
        const med = median(vals);
        const sd = stdDev(vals);
        if (sd > 0) {
          totalDist += Math.abs((Number(m[metric]) - med) / sd);
        }
      }
      return { userId: m.user_id, dist: totalDist };
    });
    distances.sort((a, b) => a.dist - b.dist);
    return distances[0].userId === member.user_id;
  },
  zScore: (member, all) => {
    const metrics: (keyof BehaviouralTagMetrics)[] = [
      "engagement_rate",
      "contrarian_pct",
      "avg_total_goals",
      "prediction_changes",
    ];
    let totalDist = 0;
    for (const metric of metrics) {
      const vals = extract(all, metric);
      const med = median(vals);
      const sd = stdDev(vals);
      if (sd > 0) {
        totalDist += Math.abs((Number(member[metric]) - med) / sd);
      }
    }
    // Negate: closer to median = higher priority
    return -totalDist;
  },
  layer1: "Dead Centre",
  layer2: "You are the statistical middle of this group. Perfectly average.",
  layer3: "{name} is the statistical middle of the group. Perfectly average.",
  factCard: {
    fact: "Closest to the group median across all metrics.",
    statTemplate: "Median distance: {score}",
    contextTemplate: "Across {stat} metrics",
  },
  visual: { borderColor: "#78716c" },
  rejectable: true,
  announced: true,
};

// ---------------------------------------------------------------------------
// Engagement pressure tags
// ---------------------------------------------------------------------------

const ghost: TagDefinition = {
  name: "Ghost",
  category: "engagement_pressure",
  priorityTier: 3,
  metric: "engagement_rate",
  qualifies: (member) => {
    return member.engagement_rate < 20 && member.events_available >= 8;
  },
  zScore: (member, all) =>
    -zScore(member.engagement_rate, extract(all, "engagement_rate")),
  layer1: "Ghost",
  layer2: "You predicted on less than 20% of available fixtures.",
  layer3: "{name} has gone quiet. Less than 20% engagement.",
  factCard: {
    fact: "Engagement dropped below 20% of available fixtures.",
    statTemplate: "{pct}% engagement",
    contextTemplate: "{stat} fixtures missed",
  },
  visual: { borderColor: "#9ca3af", opacity: 0.6 },
  rejectable: false,
  announced: false,
};

const noParticipationTrophies: TagDefinition = {
  name: "No Participation Trophies",
  category: "engagement_pressure",
  priorityTier: 3,
  metric: "engagement_rate",
  qualifies: (member) => {
    return (
      member.engagement_rate >= 20 &&
      member.engagement_rate < 40 &&
      member.events_available - member.total_predictions >= 5
    );
  },
  zScore: (member, all) =>
    -zScore(member.engagement_rate, extract(all, "engagement_rate")),
  layer1: "No Participation Trophies",
  layer2: "You have missed {stat} fixtures. The group needs more from you.",
  layer3: "{name} has missed {stat} fixtures but is still in the chat.",
  factCard: {
    fact: "Between 20-40% engagement with fixtures missed.",
    statTemplate: "{pct}% engagement",
    contextTemplate: "{stat} fixtures missed",
  },
  visual: { borderColor: "#d97706" },
  rejectable: false,
  announced: true,
};

const stillInTheFight: TagDefinition = {
  name: "Still in the Fight",
  category: "engagement_pressure",
  priorityTier: 3,
  metric: "engagement_rate+position",
  qualifies: (member, all) => {
    // Bottom 25% by engagement, less than 60% complete
    const sorted = [...all].sort(
      (a, b) => a.engagement_rate - b.engagement_rate,
    );
    const cutoff = Math.ceil(all.length * 0.25);
    const bottom25 = sorted.slice(0, cutoff);
    return (
      bottom25.some((m) => m.user_id === member.user_id) &&
      member.engagement_rate < 60 &&
      member.engagement_rate >= 20
    );
  },
  zScore: (member, all) =>
    -zScore(member.engagement_rate, extract(all, "engagement_rate")),
  layer1: "Still in the Fight",
  layer2: "You are in the bottom 25% but still mathematically alive.",
  layer3: "{name} is in the bottom 25% but still mathematically alive.",
  factCard: {
    fact: "Low engagement but still in contention.",
    statTemplate: "{pct}% engagement",
    contextTemplate: "Bottom 25% of group",
  },
  visual: { borderColor: "#eab308" },
  rejectable: true,
  announced: true,
};

// ---------------------------------------------------------------------------
// Event-driven tags (catalogue entries — qualifies/zScore are no-ops for these)
// ---------------------------------------------------------------------------

function eventNoOp(): boolean {
  return false;
}
function eventZScoreNoOp(): number {
  return 0;
}

const nailedIt: TagDefinition = {
  name: "Nailed It",
  category: "event_driven",
  priorityTier: 3,
  metric: "exact_correct",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Nailed It",
  layer2: "You got the exact score right.",
  layer3: "{name} nailed the exact score.",
  factCard: {
    fact: "Predicted the exact scoreline correctly.",
    statTemplate: "Exact: {score}",
    contextTemplate: "{stat} others got it right",
  },
  visual: { borderColor: "#0aa86d" },
  rejectable: false,
  announced: true,
};

const crystalBall: TagDefinition = {
  name: "Crystal Ball",
  category: "event_driven",
  priorityTier: 2,
  metric: "exact_correct+minority",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Crystal Ball",
  layer2: "You nailed the exact score when nobody else saw it coming.",
  layer3: "{name} nailed the exact score when nobody else saw it coming.",
  factCard: {
    fact: "Exact score correct as the only one (or one of few) to predict it.",
    statTemplate: "Exact: {score}",
    contextTemplate: "Only {stat} predicted this",
  },
  visual: { borderColor: "#f59e0b", gold: true },
  rejectable: false,
  announced: true,
};

const onARoll: TagDefinition = {
  name: "On a Roll",
  category: "event_driven",
  priorityTier: 3,
  metric: "current_streak",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "On a Roll",
  layer2: "That is {stat} correct predictions in a row.",
  layer3: "{name} is on a roll: {stat} correct in a row.",
  factCard: {
    fact: "Consecutive correct predictions streak.",
    statTemplate: "{stat} in a row",
    contextTemplate: "Best in group: {stat}",
  },
  visual: { borderColor: "#0aa86d" },
  rejectable: false,
  announced: true,
};

const onFire: TagDefinition = {
  name: "On Fire",
  category: "event_driven",
  priorityTier: 2,
  metric: "current_streak",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "On Fire",
  layer2: "That is {stat} correct predictions in a row. Unstoppable.",
  layer3: "{name} is on fire: {stat} correct in a row.",
  factCard: {
    fact: "Extended correct prediction streak.",
    statTemplate: "{stat} in a row",
    contextTemplate: "Group record: {stat}",
  },
  visual: { borderColor: "#ef4444" },
  rejectable: false,
  announced: true,
};

const giantKiller: TagDefinition = {
  name: "Giant Killer",
  category: "event_driven",
  priorityTier: 3,
  metric: "minority+winner_correct",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Giant Killer",
  layer2: "You picked the upset and got it right.",
  layer3: "{name} picked the upset and got it right.",
  factCard: {
    fact: "Correctly predicted an upset when the majority disagreed.",
    statTemplate: "Against {stat}% of the group",
    contextTemplate: "And got it right",
  },
  visual: { borderColor: "#6366f1" },
  rejectable: false,
  announced: true,
};

const perfectWindow: TagDefinition = {
  name: "Perfect Window",
  category: "event_driven",
  priorityTier: 2,
  metric: "all_correct_in_round",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Perfect Window",
  layer2: "Every single prediction correct this window.",
  layer3: "{name} went perfect this prediction window.",
  factCard: {
    fact: "100% accuracy across all fixtures in the prediction window.",
    statTemplate: "{stat}/{total} correct",
    contextTemplate: "Only {stat} achieved this",
  },
  visual: { borderColor: "#f59e0b", gold: true },
  rejectable: false,
  announced: true,
};

const lastGasp: TagDefinition = {
  name: "Last Gasp",
  category: "event_driven",
  priorityTier: 3,
  metric: "is_last_event+winner_correct",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Last Gasp",
  layer2: "Got the final event right when it mattered most.",
  layer3: "{name} got the final event right. Last gasp.",
  factCard: {
    fact: "Correctly predicted the final event of the competition.",
    statTemplate: "Final event: correct",
    contextTemplate: "{stat} others got it right",
  },
  visual: { borderColor: "#e23d4f" },
  rejectable: false,
  announced: true,
};

const firstBlood: TagDefinition = {
  name: "First Blood",
  category: "event_driven",
  priorityTier: 3,
  metric: "is_first_event+winner_correct",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "First Blood",
  layer2: "Got the opening event right. Strong start.",
  layer3: "{name} got the opening event right. First blood.",
  factCard: {
    fact: "Correctly predicted the first event of the competition.",
    statTemplate: "Opening event: correct",
    contextTemplate: "{stat} others got it right",
  },
  visual: { borderColor: "#0aa86d" },
  rejectable: false,
  announced: true,
};

const hatTrick: TagDefinition = {
  name: "Hat Trick",
  category: "event_driven",
  priorityTier: 3,
  metric: "exact_correct_count",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Hat Trick",
  layer2: "Three exact scores right. Seriously.",
  layer3: "{name} has nailed three exact scores.",
  factCard: {
    fact: "Third exact score prediction correct.",
    statTemplate: "3 exact scores",
    contextTemplate: "Group average: {stat}",
  },
  visual: { borderColor: "#f59e0b" },
  rejectable: false,
  announced: true,
};

const heartbreaker: TagDefinition = {
  name: "Heartbreaker",
  category: "event_driven",
  priorityTier: 3,
  metric: "position_drop",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Heartbreaker",
  layer2: "You dropped {stat} places after that result.",
  layer3: "{name} dropped {stat} places. Heartbreaker.",
  factCard: {
    fact: "Significant position drop after a single event.",
    statTemplate: "Dropped {stat} places",
    contextTemplate: "From #{stat} to #{stat}",
  },
  visual: { borderColor: "#e23d4f" },
  rejectable: false,
  announced: true,
};

const upsetMerchant: TagDefinition = {
  name: "Upset Merchant",
  category: "event_driven",
  priorityTier: 3,
  metric: "minority_correct_streak",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Upset Merchant",
  layer2: "Multiple minority picks correct in a row.",
  layer3: "{name} keeps picking upsets and getting them right.",
  factCard: {
    fact: "Consecutive correct minority picks.",
    statTemplate: "{stat} minority picks correct",
    contextTemplate: "In a row",
  },
  visual: { borderColor: "#6366f1" },
  rejectable: false,
  announced: true,
};

const coldStreak: TagDefinition = {
  name: "Cold Streak",
  category: "event_driven",
  priorityTier: 3,
  metric: "wrong_streak",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Cold Streak",
  layer2: "That is {stat} wrong in a row. It will turn around.",
  layer3: "{name} has gotten {stat} wrong in a row.",
  factCard: {
    fact: "Consecutive incorrect predictions.",
    statTemplate: "{stat} wrong in a row",
    contextTemplate: "Group worst: {stat}",
  },
  visual: { borderColor: "#64748b" },
  rejectable: false,
  announced: true,
};

const theReverse: TagDefinition = {
  name: "The Reverse",
  category: "event_driven",
  priorityTier: 3,
  metric: "position_gain",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "The Reverse",
  layer2: "You climbed {stat} places after that result.",
  layer3: "{name} climbed {stat} places. The Reverse.",
  factCard: {
    fact: "Significant position climb after a single event.",
    statTemplate: "Climbed {stat} places",
    contextTemplate: "From #{stat} to #{stat}",
  },
  visual: { borderColor: "#0aa86d" },
  rejectable: false,
  announced: true,
};

const cleanSheet: TagDefinition = {
  name: "Clean Sheet",
  category: "event_driven",
  priorityTier: 3,
  metric: "predicted_clean_sheet+correct",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "Clean Sheet",
  layer2: "You predicted a clean sheet and it happened.",
  layer3: "{name} predicted a clean sheet and it happened.",
  factCard: {
    fact: "Predicted 0 goals for one side and was correct.",
    statTemplate: "Clean sheet: {score}",
    contextTemplate: "{stat} others predicted this",
  },
  visual: { borderColor: "#0ea5e9" },
  rejectable: false,
  announced: true,
};

const theWhistle: TagDefinition = {
  name: "The Whistle",
  category: "event_driven",
  priorityTier: 3,
  metric: "is_last_event",
  qualifies: eventNoOp,
  zScore: eventZScoreNoOp,
  layer1: "The Whistle",
  layer2: "The final whistle has blown. Competition complete.",
  layer3: "The final whistle has blown. {name}'s competition is over.",
  factCard: {
    fact: "The last event of the competition has been decided.",
    statTemplate: "Final event",
    contextTemplate: "Competition complete",
  },
  visual: { borderColor: "#78716c" },
  rejectable: false,
  announced: true,
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** All behavioural tags, ordered by priority tier */
export const BEHAVIOURAL_TAGS: TagDefinition[] = [
  maverick,
  theAnorak,
  darkHorse,
  defenceWinsChampionships,
  areYouNotEntertained,
  allSquare,
  brokenClock,
  oneTrickPony,
  notAChance,
  theSureThing,
  theTinkerer,
  fireAndForget,
  vibesOnly,
  deadCentre,
];

/** Engagement pressure tags */
export const ENGAGEMENT_TAGS: TagDefinition[] = [
  ghost,
  noParticipationTrophies,
  stillInTheFight,
];

/** Event-driven tags */
export const EVENT_DRIVEN_TAGS: TagDefinition[] = [
  nailedIt,
  crystalBall,
  onARoll,
  onFire,
  giantKiller,
  perfectWindow,
  lastGasp,
  firstBlood,
  hatTrick,
  heartbreaker,
  upsetMerchant,
  coldStreak,
  theReverse,
  cleanSheet,
  theWhistle,
];

/** All tags in one flat list */
export const ALL_TAGS: TagDefinition[] = [
  ...BEHAVIOURAL_TAGS,
  ...ENGAGEMENT_TAGS,
  ...EVENT_DRIVEN_TAGS,
];

/** Look up a tag definition by name */
export function getTagDefinition(name: string): TagDefinition | undefined {
  return ALL_TAGS.find((t) => t.name === name);
}

/** Rejection one-liners (Phase 1 safe copy from spec section 3.1) */
export const REJECTION_ONELINERS: string[] = [
  "Nobody Puts Baby in the Corner: {name} declares they are NOT {tag}.",
  "Nobody Puts Baby in the Corner: {name} refuses the title of {tag}.",
  "{name} has seen their tag. {name} has rejected their tag. The data stands.",
  "{name} would like it on record: they are NOT {tag}. The stats say otherwise.",
  "Denial, they say, is the first stage. {name} rejects {tag}.",
  "{name} vs. The Algorithm. {name} says no to {tag}. The numbers shrug.",
  "Objection noted. {name} does not consider themselves {tag}. Motion overruled by the data.",
  "{name} has declined the honour of {tag}. The leaderboard has no comment.",
];
