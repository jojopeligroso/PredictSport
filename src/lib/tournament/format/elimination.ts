import type { SupabaseClient } from "@supabase/supabase-js";
import type { Classification, StandingRow } from "@/types/tournament";
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
  survivor_user_ids: string[];
  survivors: number;
  target_survivors: number;
  /** Extra survivors beyond target due to ties at the cut line */
  tie_overflow: number;
  /** Ranked standings used for elimination decisions (for snapshot) */
  standings_at_elimination: StandingRow[];
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

  // Identify which stage key and type this stageId maps to
  const { data: stage, error: stageError } = await supabase
    .from("sporting_stages")
    .select("slug, stage_type")
    .eq("id", stageId)
    .single();

  if (stageError) throw new Error(`Failed to fetch sporting stage: ${stageError.message}`);

  const stageKey = stage.slug as string;
  const stageType = stage.stage_type as "group" | "knockout";

  // Map DB slug (e.g. "group-matchday-3") to curve stage name (e.g. "group_stage")
  const curveStage = mapStageToCurveStep(stageKey);
  const curveStep = curveSteps.find((s) => s.stage === curveStage);

  if (!curveStep) {
    throw new Error(
      `No elimination curve step for stage '${stageKey}' (mapped to '${curveStage}') in classification ${classificationId}`
    );
  }

  const targetSurvivors = curveStep.remaining;

  // Branch: group-stage elimination vs knockout-stage elimination
  let result: EliminationResult;

  if (stageType === "group") {
    result = await eliminateGroupStage(
      supabase, classificationId, stageId, stageKey, targetSurvivors
    );
    // B1: After group-stage elimination, consolidate survivors into one knockout group
    await consolidateSurvivorsIntoKnockoutGroup(
      supabase, classificationId, result.survivor_user_ids, curveStage, curveSteps
    );
  } else {
    // B2: Knockout stage — flat leaderboard cut
    result = await eliminateKnockoutStage(
      supabase, classificationId, stageId, stageKey, targetSurvivors
    );
  }

  return result;
}

// ============================================================
// Group-stage elimination (original logic, extracted)
// ============================================================

async function eliminateGroupStage(
  supabase: SupabaseClient,
  classificationId: string,
  stageId: string,
  stageKey: string,
  targetSurvivors: number
): Promise<EliminationResult> {
  // Fetch all active groups with target_size for group-size-aware qualification rules
  const { data: groups, error: groupsError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_number, target_size")
    .eq("classification_id", classificationId)
    .eq("status", "active")
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
  const allStandings: StandingRow[] = [];

  for (const group of groupList) {
    const standings = await computeFormatGroupStandings(supabase, group.id, stageId);
    const sorted = standings.sort((a, b) => a.group_position - b.group_position);
    allStandings.push(...sorted);

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
    survivor_user_ids: [...qualifyingUserIds],
    survivors: qualifyingUserIds.size,
    target_survivors: targetSurvivors,
    tie_overflow: tieOverflow,
    standings_at_elimination: allStandings,
  };
}

// ============================================================
// B1: Consolidate survivors into a single knockout group
// Archives original group-stage groups, creates one new group
// named by the next knockout stage (e.g. "Round of 32").
// ============================================================

async function consolidateSurvivorsIntoKnockoutGroup(
  supabase: SupabaseClient,
  classificationId: string,
  survivorUserIds: string[],
  currentCurveStage: string,
  curveSteps: CurveStep[]
): Promise<void> {
  if (survivorUserIds.length === 0) return;

  // Archive all current active groups
  await supabase
    .from("format_prediction_groups")
    .update({ status: "archived" })
    .eq("classification_id", classificationId)
    .eq("status", "active");

  // Determine the next stage name for the new group
  const currentIdx = curveSteps.findIndex((s) => s.stage === currentCurveStage);
  const nextStep = currentIdx >= 0 && currentIdx < curveSteps.length - 1
    ? curveSteps[currentIdx + 1]
    : null;

  const groupName = nextStep
    ? curveStageToDisplayName(nextStep.stage)
    : `Knockout (${survivorUserIds.length})`;

  // Fetch competition_id from classification
  const { data: cls, error: clsError } = await supabase
    .from("classifications")
    .select("competition_id")
    .eq("id", classificationId)
    .single();

  if (clsError) throw new Error(`Failed to fetch classification for consolidation: ${clsError.message}`);

  // Create one new active group for all survivors
  const { data: newGroup, error: groupError } = await supabase
    .from("format_prediction_groups")
    .insert({
      classification_id: classificationId,
      competition_id: cls.competition_id,
      group_name: groupName,
      group_number: 1,
      target_size: survivorUserIds.length,
      status: "active",
      metadata: { consolidated_from: "group_stage" },
    })
    .select("id")
    .single();

  if (groupError) throw new Error(`Failed to create knockout group: ${groupError.message}`);

  // Create memberships for all survivors
  const membershipInserts = survivorUserIds.map((userId, idx) => ({
    group_id: newGroup.id,
    classification_id: classificationId,
    user_id: userId,
    seed_position: idx + 1,
    status: "active" as const,
  }));

  const { error: mbError } = await supabase
    .from("format_group_memberships")
    .insert(membershipInserts);

  if (mbError) throw new Error(`Failed to insert knockout group memberships: ${mbError.message}`);

  console.log(
    `[consolidate] ${survivorUserIds.length} survivors consolidated into "${groupName}" for classification ${classificationId}`
  );
}

// ============================================================
// B2: Knockout-stage elimination — flat leaderboard cut
// All survivors are in a single group. Rank by stage-local
// points, eliminate bottom N per the curve target.
// ============================================================

async function eliminateKnockoutStage(
  supabase: SupabaseClient,
  classificationId: string,
  stageId: string,
  stageKey: string,
  targetSurvivors: number
): Promise<EliminationResult> {
  // In knockout stages, all survivors are in a single active group
  const { data: groups, error: groupsError } = await supabase
    .from("format_prediction_groups")
    .select("id")
    .eq("classification_id", classificationId)
    .eq("status", "active");

  if (groupsError) throw new Error(`Failed to fetch knockout groups: ${groupsError.message}`);

  const groupIds = (groups ?? []).map((g: { id: string }) => g.id);

  if (groupIds.length === 0) {
    throw new Error(`No active groups found for knockout elimination in classification ${classificationId}`);
  }

  // Fetch all active members across groups (should be one group, but handle edge cases)
  const { data: activeMembers, error: mbError } = await supabase
    .from("format_group_memberships")
    .select("user_id, group_id")
    .eq("classification_id", classificationId)
    .eq("status", "active");

  if (mbError) throw new Error(`Failed to fetch knockout members: ${mbError.message}`);

  const memberList = (activeMembers ?? []) as { user_id: string; group_id: string }[];

  if (memberList.length === 0) {
    return {
      stage_id: stageId,
      classification_id: classificationId,
      eliminated_user_ids: [],
      survivor_user_ids: [],
      survivors: 0,
      target_survivors: targetSurvivors,
      tie_overflow: 0,
      standings_at_elimination: [],
    };
  }

  // Compute flat standings for all members using stage-local points
  // Use the first (should be only) active group's standings
  const standings = await computeFormatGroupStandings(supabase, groupIds[0], stageId);
  const sorted = standings.sort((a, b) => {
    // Sort by stage-local points descending, then tiebreakers
    return compareEntrantScoreWithOverall(a, b);
  });

  // Determine cutoff: qualify top N, but extend for ties at the boundary
  const qualifyCount = Math.min(targetSurvivors, sorted.length);
  let actualQualifyCount = qualifyCount;
  let tieOverflow = 0;

  if (actualQualifyCount > 0 && actualQualifyCount < sorted.length) {
    const lastQualifier = sorted[actualQualifyCount - 1];
    while (actualQualifyCount < sorted.length) {
      const firstEliminated = sorted[actualQualifyCount];
      if (areStandingsTied(lastQualifier, firstEliminated)) {
        actualQualifyCount++;
        tieOverflow++;
      } else {
        break;
      }
    }
  }

  const qualifyingUserIds = new Set(sorted.slice(0, actualQualifyCount).map((s) => s.user_id));
  const eliminatedUserIds = sorted.slice(actualQualifyCount).map((s) => s.user_id);

  // Mark eliminations in DB
  await Promise.all(
    eliminatedUserIds.map((userId) =>
      eliminateEntrant(
        supabase,
        classificationId,
        userId,
        `Eliminated after knockout stage: ${stageKey}`,
        undefined,
        stageId
      )
    )
  );

  // Update format_group_memberships status
  if (eliminatedUserIds.length > 0) {
    await supabase
      .from("format_group_memberships")
      .update({ status: "eliminated" })
      .eq("classification_id", classificationId)
      .in("user_id", eliminatedUserIds);
  }

  // Mark survivors
  const survivorIds = [...qualifyingUserIds];
  if (survivorIds.length > 0) {
    await supabase
      .from("format_group_memberships")
      .update({ status: "qualified_top" })
      .eq("classification_id", classificationId)
      .in("user_id", survivorIds);
  }

  // Archive current group, create new group for next stage if there are survivors
  // and this isn't the final stage
  if (survivorIds.length > 1) {
    // Archive current groups
    await supabase
      .from("format_prediction_groups")
      .update({ status: "archived" })
      .eq("classification_id", classificationId)
      .eq("status", "active");

    // Determine next stage name from the curve
    const nextStageName = knockoutStageGroupName(stageKey, survivorIds.length);

    const { data: cls } = await supabase
      .from("classifications")
      .select("competition_id")
      .eq("id", classificationId)
      .single();

    if (cls) {
      const { data: newGroup, error: newGroupError } = await supabase
        .from("format_prediction_groups")
        .insert({
          classification_id: classificationId,
          competition_id: cls.competition_id,
          group_name: nextStageName,
          group_number: 1,
          target_size: survivorIds.length,
          status: "active",
          metadata: { consolidated_from: stageKey },
        })
        .select("id")
        .single();

      if (newGroupError) throw new Error(`Failed to create next knockout group: ${newGroupError.message}`);

      const membershipInserts = survivorIds.map((userId, idx) => ({
        group_id: newGroup.id,
        classification_id: classificationId,
        user_id: userId,
        seed_position: idx + 1,
        status: "active" as const,
      }));

      const { error: insertError } = await supabase
        .from("format_group_memberships")
        .insert(membershipInserts);

      if (insertError) throw new Error(`Failed to insert next knockout memberships: ${insertError.message}`);
    }
  }

  return {
    stage_id: stageId,
    classification_id: classificationId,
    eliminated_user_ids: eliminatedUserIds,
    survivor_user_ids: survivorIds,
    survivors: qualifyingUserIds.size,
    target_survivors: targetSurvivors,
    tie_overflow: tieOverflow,
    standings_at_elimination: sorted,
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

/**
 * Convert a curve stage key to a human-readable group name.
 */
function curveStageToDisplayName(stage: string): string {
  const DISPLAY_NAMES: Record<string, string> = {
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarter_finals: "Quarter-Finals",
    semi_finals: "Semi-Finals",
    final: "Final",
  };
  return DISPLAY_NAMES[stage] ?? stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Determine the group name for the next knockout stage after the current one.
 */
function knockoutStageGroupName(currentSlug: string, survivorCount: number): string {
  const NEXT_STAGE: Record<string, string> = {
    "round-of-32": "Round of 16",
    "round-of-16": "Quarter-Finals",
    "quarter-finals": "Semi-Finals",
    "semi-finals": "Final",
  };
  return NEXT_STAGE[currentSlug] ?? `Knockout (${survivorCount})`;
}

// ============================================================
// B3: Tiebreaker functions with overall cumulative points support
//
// Hierarchy:
//   1. Stage-local points (primary)
//   2. Overall cumulative points (across all stages)
//   3. Overall exact score hits
//   4. Stage-local exact hits
//   5. Stage-local outcome hits
//   6. Tied (no elimination — both advance)
// ============================================================

/**
 * Extended comparison that also considers overall (cumulative) stats
 * stored in tie_break_values. Used for knockout-stage flat rankings
 * where overall performance should break ties in stage-local scores.
 *
 * Hierarchy:
 *   1. Stage-local points
 *   2. Overall cumulative points (tie_break_values.overall_points)
 *   3. Overall exact score hits (tie_break_values.overall_exact_hits)
 *   4. Stage-local exact hits
 *   5. Stage-local outcome hits
 */
function compareEntrantScoreWithOverall(
  a: { points: number; tie_break_values: Record<string, number> },
  b: { points: number; tie_break_values: Record<string, number> }
): number {
  // 1. Stage-local points
  if (b.points !== a.points) return b.points - a.points;

  // 2. Overall cumulative points (if available)
  const aOverallPts = a.tie_break_values?.overall_points ?? 0;
  const bOverallPts = b.tie_break_values?.overall_points ?? 0;
  if (bOverallPts !== aOverallPts) return bOverallPts - aOverallPts;

  // 3. Overall exact score hits (if available)
  const aOverallExact = a.tie_break_values?.overall_exact_hits ?? 0;
  const bOverallExact = b.tie_break_values?.overall_exact_hits ?? 0;
  if (bOverallExact !== aOverallExact) return bOverallExact - aOverallExact;

  // 4. Stage-local exact hits
  const aExact = a.tie_break_values?.exact_hits ?? 0;
  const bExact = b.tie_break_values?.exact_hits ?? 0;
  if (bExact !== aExact) return bExact - aExact;

  // 5. Stage-local outcome hits
  const aOutcome = a.tie_break_values?.outcome_hits ?? 0;
  const bOutcome = b.tie_break_values?.outcome_hits ?? 0;
  if (bOutcome !== aOutcome) return bOutcome - aOutcome;

  return 0;
}

/**
 * Two standings rows are "meaningfully tied" if they share the same
 * points, exact-score hits, correct-outcome hits, AND (when present)
 * overall cumulative points and overall exact hits. Earliest-submission
 * and seeded-random are display tiebreakers only — they should never
 * decide who survives vs. who gets eliminated.
 */
function areStandingsTied(
  a: { points: number; tie_break_values: Record<string, number> },
  b: { points: number; tie_break_values: Record<string, number> }
): boolean {
  return compareEntrantScoreWithOverall(a, b) === 0;
}
