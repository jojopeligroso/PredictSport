import type { SupabaseClient } from "@supabase/supabase-js";
import type { Classification } from "@/types/tournament";
import { eliminateEntrant } from "../membership";
import { computeFormatGroupStandings, computeBestThirdRanking } from "./scoring";

// ============================================================
// Exported types for elimination mechanics
// ============================================================

export interface EliminationCurveStage {
  target_survivors: number;
}

export interface EliminationCurve {
  preset: number;
  stages: Record<string, EliminationCurveStage>;
}

export interface ConsequenceRow {
  stage_key: string;
  entrants_before: number;
  target_survivors: number;
  eliminated_count: number;
  survivors_after: number;
}

export interface ConsequenceTable {
  preset: number;
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
  const curve = getEliminationCurve(classification);

  // Identify which stage key this stageId maps to
  const { data: stage, error: stageError } = await supabase
    .from("sporting_stages")
    .select("slug")
    .eq("id", stageId)
    .single();

  if (stageError) throw new Error(`Failed to fetch sporting stage: ${stageError.message}`);

  const stageKey = stage.slug as string;
  const stageConfig = curve.stages[stageKey];

  if (!stageConfig) {
    throw new Error(
      `No elimination config for stage '${stageKey}' in classification ${classificationId}`
    );
  }

  const targetSurvivors = stageConfig.target_survivors;

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
// ============================================================

export function getEliminationCurve(classification: Classification): EliminationCurve {
  const config = classification.config as Record<string, unknown>;
  const curve = config?.elimination_curve as EliminationCurve | undefined;

  if (!curve) {
    throw new Error(
      `No elimination_curve found in config for classification ${classification.id}`
    );
  }

  if (!curve.stages || typeof curve.stages !== "object") {
    throw new Error(
      `Invalid elimination_curve.stages in classification ${classification.id}`
    );
  }

  return curve;
}

// ============================================================
// Preview consequence table for admin before launch
// ============================================================

export function previewEliminationConsequences(
  curve: EliminationCurve,
  entrantCount: number
): ConsequenceTable {
  const rows: ConsequenceRow[] = [];
  let current = entrantCount;

  for (const [stageKey, stageConfig] of Object.entries(curve.stages)) {
    const target = stageConfig.target_survivors;
    const eliminated = Math.max(0, current - target);
    const survivors = current - eliminated;

    rows.push({
      stage_key: stageKey,
      entrants_before: current,
      target_survivors: target,
      eliminated_count: eliminated,
      survivors_after: survivors,
    });

    current = survivors;
  }

  return {
    preset: curve.preset,
    initial_entrants: entrantCount,
    rows,
  };
}

// ============================================================
// Internal comparison helper (same tie-break as standings)
// ============================================================

function compareEntrantScore(
  a: { points: number; exact_hits: number; outcome_hits: number },
  b: { points: number; exact_hits: number; outcome_hits: number }
): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exact_hits !== a.exact_hits) return b.exact_hits - a.exact_hits;
  if (b.outcome_hits !== a.outcome_hits) return b.outcome_hits - a.outcome_hits;
  return 0;
}
