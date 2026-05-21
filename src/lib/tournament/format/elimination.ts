import type { SupabaseClient } from "@supabase/supabase-js";
import type { Classification } from "@/types/tournament";
import type { CurveStep } from "./curve-generator";
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
  const qualifyingUserIds = new Set<string>();
  const eliminatedDirectly: string[] = [];

  for (const group of groupList) {
    const standings = await computeFormatGroupStandings(supabase, group.id, stageId);
    const sorted = standings.sort((a, b) => a.group_position - b.group_position);

    for (let idx = 0; idx < sorted.length; idx++) {
      const userId = sorted[idx].user_id;
      if (idx < 2) {
        // Top 2 — always qualify
        qualifyingUserIds.add(userId);
      } else if (idx === 2) {
        // Third place — depends on group size
        if (group.target_size === 5) {
          qualifyingUserIds.add(userId); // auto-qualifies
        } else if (group.target_size === 3) {
          eliminatedDirectly.push(userId); // last place, never qualifies
        }
        // target_size === 4: handled by best-third ranking below
      } else {
        // 4th and below — always eliminated
        eliminatedDirectly.push(userId);
      }
    }
  }

  // Determine how many best-third spots remain
  const spotsFromBestThird = Math.max(0, targetSurvivors - qualifyingUserIds.size);

  // Rank third-place finishers via the same best-third logic
  const thirdPlaceRows = await computeBestThirdRanking(supabase, classificationId, stageId);
  const qualifyingThirds = thirdPlaceRows.slice(0, spotsFromBestThird).map((r) => r.user_id);
  const eliminatedThirds = thirdPlaceRows.slice(spotsFromBestThird).map((r) => r.user_id);

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
  };
}

// ============================================================
// Read the elimination curve from classification config
// New format: { entrantCount, locked, curve: CurveStep[] }
// ============================================================

export function getEliminationCurve(classification: Classification): CurveStep[] {
  const config = classification.config as Record<string, unknown>;
  const curveConfig = config?.elimination_curve as { curve?: CurveStep[] } | undefined;

  if (!curveConfig?.curve || !Array.isArray(curveConfig.curve)) {
    throw new Error(
      `No elimination_curve.curve found in config for classification ${classification.id}`
    );
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
