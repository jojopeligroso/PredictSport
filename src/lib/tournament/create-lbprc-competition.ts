import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition } from "@/types/database";
import type { Classification } from "@/types/tournament";

// Well-known IDs from the seed migration (20260716040000_seed_lbprc_tournament.sql).
const LBPRC_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000204";
const LBPRC_BRACKET_TEMPLATE_ID = "c0000000-0000-0000-0000-000000000204";

export const LBPRC_STAGE_IDS = {
  REGULAR_SEASON: "b0000000-0000-0000-0001-000000000204",
  SEMIFINALS: "b0000000-0000-0000-0002-000000000204",
  FINAL: "b0000000-0000-0000-0003-000000000204",
} as const;

const STAGE_IDS = LBPRC_STAGE_IDS;

// Regular-season per-game picks live under the Regular Season window; each
// series is a synthetic series event scored via head_to_head (winner) +
// over_under(stat=games_played) (length). Semifinals are best-of-7; the Serie
// Final is best-of-9 (an LBPRC distinction — longer than the other Caribbean
// leagues' best-of-7 finals).
const PREDICTION_WINDOWS = [
  { name: "Regular Season", stageId: STAGE_IDS.REGULAR_SEASON, windowNumber: 1 },
  { name: "Semifinals", stageId: STAGE_IDS.SEMIFINALS, windowNumber: 2 },
  { name: "Serie Final", stageId: STAGE_IDS.FINAL, windowNumber: 3 },
] as const;

interface CreateLBPRCOptions {
  name: string;
  visibility: "public" | "private";
  maxEntrants?: number;
  minEntrants?: number;
  enabledClassifications?: string[];
  skipRounds?: boolean;
}

/**
 * Creates an LBPRC (Puerto Rico) prediction game (Archetype B: round-robin
 * regular season -> 4-team elimination bracket: best-of-7 semifinals into a
 * best-of-9 Serie Final; no wild card).
 * Classifications: overall + outrights + bracket. No format-elimination.
 */
export async function createLBPRCCompetition(
  supabase: SupabaseClient,
  userId: string,
  options: CreateLBPRCOptions
): Promise<{ competition: Competition; classifications: Classification[] }> {
  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .insert({
      name: options.name,
      type: "fixed",
      visibility: options.visibility,
      status: "draft",
      tournament_id: LBPRC_TOURNAMENT_ID,
      product_mode: "predictsport_full",
      scoring_rules: { game_outcome: 2, exact_score_bonus: 3, series_advancing_team: 1 },
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
      config: {},
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
      name: "Playoff Bracket",
      status: "draft" as const,
      scoring_strategy: { type: "bracket_alive_dead" },
      config: {
        bracket_type: "series_elim",
        bracket_template_id: LBPRC_BRACKET_TEMPLATE_ID,
        opens_after: "regular_season_finalised",
        semifinal_best_of: 7,
        final_best_of: 9,
        reseed_each_round: false,
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
    const roundRows = PREDICTION_WINDOWS.map((pw) => ({
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
