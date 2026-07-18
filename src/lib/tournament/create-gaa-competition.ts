import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition } from "@/types/database";
import type { Classification } from "@/types/tournament";

/**
 * The four 2026 GAA intercounty championship blueprints (men's), seeded by
 * migrations 20260716050000-080000. One parameterised orchestrator serves all
 * four, mirroring the per-league baseball/cricket creators.
 *
 *  - liam_maccarthy: All-Ireland SHC (provincial round-robins + AI knockout)
 *  - joe_mcdonagh:   Joe McDonagh Cup (round-robin + final)
 *  - sam_maguire:    All-Ireland SFC (provincials + R1/R2A/R2B/R3/QF/SF/Final)
 *  - tailteann:      Tailteann Cup (double-elimination)
 */
export type GaaBlueprintKey = "liam_maccarthy" | "joe_mcdonagh" | "sam_maguire" | "tailteann";

interface GaaBlueprint {
  tournamentId: string;
  bracketTemplateId: string;
  /** Sport identifier (gaelic_football or hurling). */
  sport: "gaelic_football" | "hurling";
  /** Prediction windows, one per sporting stage. */
  windows: { name: string; stageId: string; windowNumber: number }[];
}

export const GAA_BLUEPRINTS: Record<GaaBlueprintKey, GaaBlueprint> = {
  liam_maccarthy: {
    tournamentId: "a0000000-0000-0000-0000-000000000207",
    bracketTemplateId: "c0000000-0000-0000-0000-000000000207",
    sport: "hurling",
    windows: [
      { name: "Munster SHC (Round Robin)", stageId: "b0000000-0000-0000-0001-000000000207", windowNumber: 1 },
      { name: "Leinster SHC (Round Robin)", stageId: "b0000000-0000-0000-0002-000000000207", windowNumber: 2 },
      { name: "Munster Final", stageId: "b0000000-0000-0000-0003-000000000207", windowNumber: 3 },
      { name: "Leinster Final", stageId: "b0000000-0000-0000-0004-000000000207", windowNumber: 4 },
      { name: "All-Ireland Quarter-Finals", stageId: "b0000000-0000-0000-0005-000000000207", windowNumber: 5 },
      { name: "All-Ireland Semi-Finals", stageId: "b0000000-0000-0000-0006-000000000207", windowNumber: 6 },
      { name: "All-Ireland Final", stageId: "b0000000-0000-0000-0007-000000000207", windowNumber: 7 },
    ],
  },
  joe_mcdonagh: {
    tournamentId: "a0000000-0000-0000-0000-000000000208",
    bracketTemplateId: "c0000000-0000-0000-0000-000000000208",
    sport: "hurling",
    windows: [
      { name: "Round Robin", stageId: "b0000000-0000-0000-0001-000000000208", windowNumber: 1 },
      { name: "Final", stageId: "b0000000-0000-0000-0002-000000000208", windowNumber: 2 },
    ],
  },
  sam_maguire: {
    tournamentId: "a0000000-0000-0000-0000-000000000205",
    bracketTemplateId: "c0000000-0000-0000-0000-000000000205",
    sport: "gaelic_football",
    windows: [
      { name: "Connacht SFC", stageId: "b0000000-0000-0000-0001-000000000205", windowNumber: 1 },
      { name: "Leinster SFC", stageId: "b0000000-0000-0000-0002-000000000205", windowNumber: 2 },
      { name: "Munster SFC", stageId: "b0000000-0000-0000-0003-000000000205", windowNumber: 3 },
      { name: "Ulster SFC", stageId: "b0000000-0000-0000-0004-000000000205", windowNumber: 4 },
      { name: "Sam Maguire Round 1", stageId: "b0000000-0000-0000-0005-000000000205", windowNumber: 5 },
      { name: "Sam Maguire Round 2A", stageId: "b0000000-0000-0000-0006-000000000205", windowNumber: 6 },
      { name: "Sam Maguire Round 2B", stageId: "b0000000-0000-0000-0007-000000000205", windowNumber: 7 },
      { name: "Sam Maguire Round 3", stageId: "b0000000-0000-0000-0008-000000000205", windowNumber: 8 },
      { name: "Sam Maguire Quarter-Finals", stageId: "b0000000-0000-0000-0009-000000000205", windowNumber: 9 },
      { name: "Sam Maguire Semi-Finals", stageId: "b0000000-0000-0000-0010-000000000205", windowNumber: 10 },
      { name: "Sam Maguire Final", stageId: "b0000000-0000-0000-0011-000000000205", windowNumber: 11 },
    ],
  },
  tailteann: {
    tournamentId: "a0000000-0000-0000-0000-000000000206",
    bracketTemplateId: "c0000000-0000-0000-0000-000000000206",
    sport: "gaelic_football",
    windows: [
      { name: "Round 1 (Open Draw)", stageId: "b0000000-0000-0000-0001-000000000206", windowNumber: 1 },
      { name: "Round 2", stageId: "b0000000-0000-0000-0002-000000000206", windowNumber: 2 },
      { name: "Preliminary Quarter-Finals", stageId: "b0000000-0000-0000-0003-000000000206", windowNumber: 3 },
      { name: "Quarter-Finals", stageId: "b0000000-0000-0000-0004-000000000206", windowNumber: 4 },
      { name: "Semi-Finals", stageId: "b0000000-0000-0000-0005-000000000206", windowNumber: 5 },
      { name: "Final", stageId: "b0000000-0000-0000-0006-000000000206", windowNumber: 6 },
    ],
  },
};

interface CreateGaaOptions {
  blueprint: GaaBlueprintKey;
  name: string;
  visibility: "public" | "private";
  maxEntrants?: number;
  minEntrants?: number;
  /** Subset of classification keys to enable; "overall" is always included. */
  enabledClassifications?: string[];
  /** Skip round creation — auto-provisioned instances share rounds via tournament_id RLS. */
  skipRounds?: boolean;
}

/**
 * Creates a GAA intercounty championship prediction game from one of the four
 * 2026 blueprints. Classifications: overall (cumulative leaderboard), outrights
 * (season-long futures), and bracket (progression survivor). GAA scoring uses
 * the existing goals+points exact_score and winner branches; provincial
 * round-robins allow draws (per-event config).
 *
 * Not atomic — if any step fails, partial data may remain (caller should handle).
 */
export async function createGaaCompetition(
  supabase: SupabaseClient,
  userId: string,
  options: CreateGaaOptions
): Promise<{ competition: Competition; classifications: Classification[] }> {
  const blueprint = GAA_BLUEPRINTS[options.blueprint];
  if (!blueprint) {
    throw new Error(`Unknown GAA blueprint: ${options.blueprint}`);
  }

  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .insert({
      name: options.name,
      type: "fixed",
      visibility: options.visibility,
      status: "draft",
      tournament_id: blueprint.tournamentId,
      product_mode: "predictsport_full",
      scoring_rules: {
        match_outcome: 2,
        exact_score_bonus: 3,
        knockout_advancing_team: 1,
      },
      lock_default_minutes: 10,
      allow_nominations: false,
      allow_prediction_updates: true,
      max_entrants: options.maxEntrants ?? null,
      min_entrants: options.minEntrants ?? null,
      created_by: userId,
    })
    .select()
    .single();

  if (compError || !competition) {
    throw new Error(`Failed to create competition: ${compError?.message}`);
  }

  const competitionId = competition.id;

  const allClassificationRows = [
    {
      competition_id: competitionId,
      classification_key: "overall",
      classification_type: "leaderboard" as const,
      name: "Overall",
      status: "active" as const,
      scoring_strategy: { type: "cumulative", points_per_outcome: 2, points_per_exact: 3, points_per_advancing: 1 },
      config: { blueprint: options.blueprint },
    },
    {
      competition_id: competitionId,
      classification_key: "outrights",
      classification_type: "leaderboard" as const,
      name: "Outrights",
      status: "active" as const,
      scoring_strategy: { type: "cumulative", points_per_outcome: 2, points_per_exact: 3, points_per_advancing: 1 },
      config: { source: "outright_events" },
    },
    {
      competition_id: competitionId,
      classification_key: "bracket",
      classification_type: "bracket_survivor" as const,
      name: "Bracket",
      status: "draft" as const,
      scoring_strategy: { type: "bracket_alive_dead" },
      config: {
        bracket_template_id: blueprint.bracketTemplateId,
        blueprint: options.blueprint,
      },
    },
  ];

  const classificationRows = options.enabledClassifications
    ? allClassificationRows.filter(
        (r) => r.classification_key === "overall" || options.enabledClassifications!.includes(r.classification_key)
      )
    : allClassificationRows;

  const { data: classifications, error: classError } = await supabase
    .from("classifications")
    .insert(classificationRows)
    .select();

  if (classError || !classifications) {
    throw new Error(`Failed to create classifications: ${classError?.message}`);
  }

  if (!options.skipRounds) {
    const roundRows = blueprint.windows.map((pw) => ({
      competition_id: competitionId,
      name: pw.name,
      round_number: pw.windowNumber,
      sporting_stage_id: pw.stageId,
      prediction_window_number: pw.windowNumber,
      status: "draft" as const,
    }));

    const { error: roundError } = await supabase.from("rounds").insert(roundRows);
    if (roundError) {
      throw new Error(`Failed to create prediction windows: ${roundError.message}`);
    }
  }

  const { error: memberError } = await supabase
    .from("competition_members")
    .insert({ competition_id: competitionId, user_id: userId, role: "admin" });
  if (memberError) {
    throw new Error(`Failed to add admin member: ${memberError.message}`);
  }

  const membershipRows = classifications.map((c: Classification) => ({
    classification_id: c.id,
    competition_id: competitionId,
    user_id: userId,
    status: "active" as const,
  }));

  const { error: membershipError } = await supabase
    .from("classification_memberships")
    .insert(membershipRows);
  if (membershipError) {
    throw new Error(`Failed to enroll admin in classifications: ${membershipError.message}`);
  }

  return {
    competition: competition as Competition,
    classifications: classifications as Classification[],
  };
}
