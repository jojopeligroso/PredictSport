import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition } from "@/types/database";
import type { Classification } from "@/types/tournament";

// Well-known IDs from the seed migration (20260716020000_seed_lvbp_tournament.sql).
const LVBP_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000202";
const LVBP_BRACKET_TEMPLATE_ID = "c0000000-0000-0000-0000-000000000202";

// Sporting stage IDs from the seed.
export const LVBP_STAGE_IDS = {
  REGULAR_SEASON: "b0000000-0000-0000-0001-000000000202",
  WILD_CARD: "b0000000-0000-0000-0002-000000000202",
  ROUND_ROBIN: "b0000000-0000-0000-0003-000000000202",
  FINAL: "b0000000-0000-0000-0004-000000000202",
} as const;

const STAGE_IDS = LVBP_STAGE_IDS;

// Prediction windows. Regular-season per-game picks live under the Regular
// Season window; the wild card, round robin, and final are each their own
// window. The wild-card (asymmetric max-2) and the best-of-7 final are the only
// series-shaped nodes — modelled as synthetic "series" events with head_to_head
// (winner) + over_under(stat=games_played) (length) EPTs. The round robin is a
// table scored like the regular season.
const PREDICTION_WINDOWS = [
  { name: "Regular Season", stageId: STAGE_IDS.REGULAR_SEASON, windowNumber: 1 },
  { name: "Wild Card", stageId: STAGE_IDS.WILD_CARD, windowNumber: 2 },
  { name: "Round Robin", stageId: STAGE_IDS.ROUND_ROBIN, windowNumber: 3 },
  { name: "Serie Final", stageId: STAGE_IDS.FINAL, windowNumber: 4 },
] as const;

interface CreateLVBPOptions {
  name: string;
  visibility: "public" | "private";
  maxEntrants?: number;
  minEntrants?: number;
  /** Subset of classification keys to enable; "overall" is always included. */
  enabledClassifications?: string[]; // e.g. ["overall","outrights","bracket"]
  /** Skip round creation — auto-provisioned instances share rounds via tournament_id RLS. */
  skipRounds?: boolean;
}

/**
 * Creates a Liga Venezolana de Béisbol Profesional prediction game
 * (Archetype B: round-robin regular season -> asymmetric wild card ->
 * round-robin playoff -> best-of-7 final). Classifications: overall (cumulative
 * leaderboard), outrights (season-long futures board), and bracket (playoff
 * progression survivor). No format-elimination survival game.
 *
 * Not atomic — if any step fails, partial data may remain (caller should handle).
 */
export async function createLVBPCompetition(
  supabase: SupabaseClient,
  userId: string,
  options: CreateLVBPOptions
): Promise<{ competition: Competition; classifications: Classification[] }> {
  // 1. Create competition
  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .insert({
      name: options.name,
      type: "fixed",
      visibility: options.visibility,
      status: "draft",
      tournament_id: LVBP_TOURNAMENT_ID,
      product_mode: "predictsport_full",
      scoring_rules: {
        // Defaults copied onto new events as event_prediction_types; the EPT
        // rows remain the per-event source of truth.
        game_outcome: 2,
        exact_score_bonus: 3,
        series_advancing_team: 1,
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

  // 2. Create classifications (optionally filtered by enabledClassifications)
  const allClassificationRows = [
    {
      competition_id: competitionId,
      classification_key: "overall",
      classification_type: "leaderboard" as const,
      name: "Overall",
      status: "active" as const,
      scoring_strategy: {
        type: "cumulative",
        points_per_outcome: 2,
        points_per_exact: 3,
        points_per_advancing: 1,
      },
      config: {},
    },
    {
      competition_id: competitionId,
      classification_key: "outrights",
      classification_type: "leaderboard" as const,
      name: "Outrights",
      status: "active" as const,
      scoring_strategy: {
        type: "cumulative",
        points_per_outcome: 2,
        points_per_exact: 3,
        points_per_advancing: 1,
      },
      config: { source: "outright_events" },
    },
    {
      competition_id: competitionId,
      classification_key: "bracket",
      classification_type: "bracket_survivor" as const,
      name: "Playoff Bracket",
      // Opens once the regular season table is final and the wild-card seeds are set.
      status: "draft" as const,
      scoring_strategy: { type: "bracket_alive_dead" },
      config: {
        bracket_type: "wildcard_roundrobin_final",
        bracket_template_id: LVBP_BRACKET_TEMPLATE_ID,
        opens_after: "regular_season_finalised",
        final_best_of: 7,
      },
    },
  ];

  const classificationRows = options.enabledClassifications
    ? allClassificationRows.filter(
        (r) =>
          r.classification_key === "overall" ||
          options.enabledClassifications!.includes(r.classification_key)
      )
    : allClassificationRows;

  const { data: classifications, error: classError } = await supabase
    .from("classifications")
    .insert(classificationRows)
    .select();

  if (classError || !classifications) {
    throw new Error(`Failed to create classifications: ${classError?.message}`);
  }

  // 3. Create prediction windows (rounds).
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

  // 4. Add creator as admin member
  const { error: memberError } = await supabase
    .from("competition_members")
    .insert({
      competition_id: competitionId,
      user_id: userId,
      role: "admin",
    });

  if (memberError) {
    throw new Error(`Failed to add admin member: ${memberError.message}`);
  }

  // 5. Enroll admin in all created classifications
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
