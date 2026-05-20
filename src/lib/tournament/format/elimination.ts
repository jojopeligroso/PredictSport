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

  // Fetch all groups to compute group-level standings
  const { data: groups, error: groupsError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_number")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  if (groupsError) throw new Error(`Failed to fetch groups: ${groupsError.message}`);

  const groupList = (groups ?? []) as { id: string; group_number: number }[];

  // Collect all entrant standings across groups
  type EntrantScore = {
    user_id: string;
    group_id: string;
    group_position: number;
    points: number;
    exact_hits: number;
    outcome_hits: number;
  };

  const allEntrants: EntrantScore[] = [];

  for (const group of groupList) {
    const standings = await computeFormatGroupStandings(supabase, group.id, stageId);
    for (const row of standings) {
      allEntrants.push({
        user_id: row.user_id,
        group_id: group.id,
        group_position: row.group_position,
        points: row.points,
        exact_hits: row.tie_break_values?.exact_hits ?? 0,
        outcome_hits: row.tie_break_values?.outcome_hits ?? 0,
      });
    }
  }

  // Top 2 per group auto-qualify; 3rd-place fight for remaining spots
  const qualifyingUserIds = new Set<string>();
  const thirdPlaceCandidates: EntrantScore[] = [];
  const eliminatedDirectly: EntrantScore[] = [];

  for (const group of groupList) {
    const groupEntrants = allEntrants
      .filter((e) => e.group_id === group.id)
      .sort((a, b) => compareEntrantScore(a, b));

    groupEntrants.forEach((entrant, idx) => {
      if (idx < 2) {
        // Top 2 — qualify automatically
        qualifyingUserIds.add(entrant.user_id);
      } else if (idx === 2) {
        // Third place — enters best-third competition
        thirdPlaceCandidates.push(entrant);
      } else {
        // 4th and below — eliminated directly
        eliminatedDirectly.push(entrant);
      }
    });
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
    ...eliminatedDirectly.map((e) => e.user_id),
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
