import type { SupabaseClient } from "@supabase/supabase-js";
import type { Classification } from "@/types/tournament";
import { generateEliminationCurve, type CurveStep } from "./curve-generator";
import { eliminateEntrant } from "../membership";
import { computeFormatGroupStandings, computeBestThirdRanking } from "./scoring";

export interface ConsequenceRow {
  stage_key: string;
  entrants_before: number;
  target_survivors: number;
  eliminated_count: number;
  survivors_after: number;
}

export interface ConsequenceTable {
  initial_entrants: number;
  rows: ConsequenceRow[];
}

export interface EliminationResult {
  stage_id: string;
  classification_id: string;
  eliminated_user_ids: string[];
  survivors: number;
  target_survivors: number;
  /** Extra survivors beyond target due to ties at the cut line */
  tie_overflow: number;
}

// ============================================================
// Run elimination after a sporting stage is finalised
// ============================================================

export async function eliminateFromFormat(
  supabase: SupabaseClient,
  classificationId: string,
  stageId: string
): Promise<EliminationResult> {
  const { data: cls, error: clsError } = await supabase
    .from("classifications")
    .select("*")
    .eq("id", classificationId)
    .single();

  if (clsError) throw new Error(`Failed to fetch classification: ${clsError.message}`);

  const classification = cls as Classification;
  const curveSteps = getEliminationCurve(classification);

  // Identify which stage key this stageId maps to
  const { data: stage, error: stageError } = await supabase
    .from("sporting_stages")
    .select("slug")
    .eq("id", stageId)
    .single();

  if (stageError) throw new Error(`Failed to fetch sporting stage: ${stageError.message}`);

  const stageKey = stage.slug as string;

  // Map DB slug (e.g. "group-matchday-3") to curve stage name (e.g. "group_stage")
  const curveStage = mapStageToCurveStep(stageKey);
  const curveStep = curveSteps.find((s) => s.stage === curveStage);

  if (!curveStep) {
    throw new Error(
      `No elimination curve step for stage '${stageKey}' (mapped to '${curveStage}') in classification ${classificationId}`
    );
  }

  const targetSurvivors = curveStep.remaining;

  // Fetch all groups with target_size for group-size-aware qualification rules
  const { data: groups, error: groupsError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_number, target_size")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);

  const groupList = (groups ?? []) as { id: string; group_number: number; target_size: number }[];

  // Qualify/eliminate per group based on group size:
  // - 3-player: top 2 qualify, 3rd eliminated (never qualifies)
  // - 4-player: top 2 qualify, 3rd enters best-third pool, 4th eliminated
  // - 5-player: top 2 qualify, 3rd auto-qualifies, 4th-5th eliminated
  //
  // Tie rule: when two entrants are tied on meaningful metrics (points,
  // exact_hits, outcome_hits) at any elimination boundary, both advance.
  // The next stage naturally compensates (same target, more entrants in).
  const qualifyingUserIds = new Set<string>();
  const eliminatedDirectly: string[] = [];
  let tieOverflow = 0;

  for (const group of groupList) {
    const standings = await computeFormatGroupStandings(supabase, group.id, stageId);
    const sorted = standings.sort((a, b) => a.group_position - b.group_position);

    // Auto-qualify boundary: top 2 always, top 3 for 5-player groups
    const autoQualifyUpTo = group.target_size === 5 ? 3 : 2;
    const lastAutoQualifier = autoQualifyUpTo <= sorted.length
      ? sorted[autoQualifyUpTo - 1]
      : null;

    for (let idx = 0; idx < sorted.length; idx++) {
      const userId = sorted[idx].user_id;

      if (idx < autoQualifyUpTo) {
        // Within auto-qualify range — always qualifies
        qualifyingUserIds.add(userId);
      } else if (lastAutoQualifier && areStandingsTied(sorted[idx], lastAutoQualifier)) {
        // Tied with last auto-qualifier on meaningful metrics — promote
        qualifyingUserIds.add(userId);
        tieOverflow++;
      } else if (idx === 2 && group.target_size === 4) {
        // 3rd in 4-player group → best-third pool (handled below)
      } else {
        // Eliminated (not tied with last qualifier)
        eliminatedDirectly.push(userId);
      }
    }
  }

  // Best-third spots: use original auto-qualifiers (before tie promotions)
  // so that within-group overflow doesn't steal best-third slots
  const originalAutoQualifiers = qualifyingUserIds.size - tieOverflow;
  const spotsFromBestThird = Math.max(0, targetSurvivors - originalAutoQualifiers);

  // Rank third-place finishers, excluding any already promoted via within-group ties
  const thirdPlaceRows = await computeBestThirdRanking(supabase, classificationId, stageId);
  const eligibleThirds = thirdPlaceRows.filter((r) => !qualifyingUserIds.has(r.user_id));

  // Extend for ties at the best-third cutoff
  let bestThirdQualifyCount = Math.min(spotsFromBestThird, eligibleThirds.length);

  if (bestThirdQualifyCount > 0 && bestThirdQualifyCount < eligibleThirds.length) {
    const lastIn = eligibleThirds[bestThirdQualifyCount - 1];
    while (bestThirdQualifyCount < eligibleThirds.length) {
      const firstOut = eligibleThirds[bestThirdQualifyCount];
      if (areStandingsTied(lastIn, firstOut)) {
        bestThirdQualifyCount++;
        tieOverflow++;
      } else {
        break;
      }
    }
  }

  const qualifyingThirds = eligibleThirds.slice(0, bestThirdQualifyCount).map((r) => r.user_id);
  const eliminatedThirds = eligibleThirds.slice(bestThirdQualifyCount).map((r) => r.user_id);

  for (const userId of qualifyingThirds) {
    qualifyingUserIds.add(userId);
  }

  // Build final eliminated set
  const toEliminate = [
    ...eliminatedDirectly,
    ...eliminatedThirds,
  ];

  const uniqueToEliminate = [...new Set(toEliminate)];

  // Mark eliminations in DB
  await Promise.all(
    uniqueToEliminate.map((userId) =>
      eliminateEntrant(
        supabase,
        classificationId,
        userId,
        `Eliminated after stage: ${stageKey}`,
        undefined,
        stageId
      )
    )
  );

  // Update format_group_memberships status
  if (uniqueToEliminate.length > 0) {
    await supabase
      .from("format_group_memberships")
      .update({ status: "eliminated" })
      .eq("classification_id", classificationId)
      .in("user_id", uniqueToEliminate);
  }

  // Mark qualified thirds
  if (qualifyingThirds.length > 0) {
    await supabase
      .from("format_group_memberships")
      .update({ status: "qualified_third" })
      .eq("classification_id", classificationId)
      .in("user_id", qualifyingThirds);
  }

  // Mark top qualifiers
  const topQualifiers = [...qualifyingUserIds].filter((id) => !qualifyingThirds.includes(id));
  if (topQualifiers.length > 0) {
    await supabase
      .from("format_group_memberships")
      .update({ status: "qualified_top" })
      .eq("classification_id", classificationId)
      .in("user_id", topQualifiers);
  }

  return {
    stage_id: stageId,
    classification_id: classificationId,
    eliminated_user_ids: uniqueToEliminate,
    survivors: qualifyingUserIds.size,
    target_survivors: targetSurvivors,
    tie_overflow: tieOverflow,
  };
}

// ============================================================
// Read the elimination curve from classification config.
// Auto-scales if actual entrant count differs from configured.
//
// The stored curve uses absolute numbers (e.g. 48 → 32 → 16).
// If actual entrants differ, regenerate the curve via the
// generator to maintain correct elimination ratios. This
// prevents impossible survivor targets (e.g. 32 survivors
// from 37 entrants is mathematically impossible with group
// qualification rules).
// ============================================================

export function getEliminationCurve(
  classification: Classification,
  actualEntrants?: number,
): CurveStep[] {
  const config = classification.config as Record<string, unknown>;
  const curveConfig = config?.elimination_curve as {
    curve?: CurveStep[];
    entrantCount?: number;
  } | undefined;

  if (!curveConfig?.curve || !Array.isArray(curveConfig.curve)) {
    throw new Error(
      `No elimination_curve.curve found in config for classification ${classification.id}`
    );
  }

  // If actual entrants differ from configured count, regenerate
  // the curve to maintain correct proportions
  if (
    actualEntrants &&
    actualEntrants >= 8 &&
    curveConfig.entrantCount &&
    actualEntrants !== curveConfig.entrantCount
  ) {
    return generateEliminationCurve(actualEntrants);
  }

  return curveConfig.curve;
}

// ============================================================
// Preview consequence table for admin before launch
// ============================================================

export function previewEliminationConsequences(
  curveSteps: CurveStep[]
): ConsequenceTable {
  const rows: ConsequenceRow[] = [];

  for (let i = 1; i < curveSteps.length; i++) {
    const prev = curveSteps[i - 1];
    const current = curveSteps[i];
    const eliminated = prev.remaining - current.remaining;

    rows.push({
      stage_key: current.stage,
      entrants_before: prev.remaining,
      target_survivors: current.remaining,
      eliminated_count: eliminated,
      survivors_after: current.remaining,
    });
  }

  return {
    initial_entrants: curveSteps[0]?.remaining ?? 0,
    rows,
  };
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Map a DB sporting stage slug to the corresponding curve step stage name.
 * Group matchdays (group-matchday-1/2/3) all map to "group_stage" since
 * elimination runs once after the final group matchday.
 */
function mapStageToCurveStep(slug: string): string {
  if (slug.startsWith("group-matchday")) return "group_stage";

  // Knockout slugs use dashes in DB, underscores in curve
  const SLUG_TO_CURVE: Record<string, string> = {
    "round-of-32": "round_of_32",
    "round-of-16": "round_of_16",
    "quarter-finals": "quarter_finals",
    "semi-finals": "semi_finals",
    "final": "final",
    "third-place": "final", // third-place bundled into final window
  };

  return SLUG_TO_CURVE[slug] ?? slug.replace(/-/g, "_");
}

function compareEntrantScore(
  a: { points: number; exact_hits: number; outcome_hits: number },
  b: { points: number; exact_hits: number; outcome_hits: number }
): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exact_hits !== a.exact_hits) return b.exact_hits - a.exact_hits;
  if (b.outcome_hits !== a.outcome_hits) return b.outcome_hits - a.outcome_hits;
  return 0;
}

/**
 * Two standings rows are "meaningfully tied" if they share the same
 * points, exact-score hits, and correct-outcome hits. Earliest-submission
 * and seeded-random are display tiebreakers only — they should never
 * decide who survives vs. who gets eliminated.
 */
function areStandingsTied(
  a: { points: number; tie_break_values: Record<string, number> },
  b: { points: number; tie_break_values: Record<string, number> }
): boolean {
  return (
    compareEntrantScore(
      {
        points: a.points,
        exact_hits: a.tie_break_values?.exact_hits ?? 0,
        outcome_hits: a.tie_break_values?.outcome_hits ?? 0,
      },
      {
        points: b.points,
        exact_hits: b.tie_break_values?.exact_hits ?? 0,
        outcome_hits: b.tie_break_values?.outcome_hits ?? 0,
      }
    ) === 0
  );
}
