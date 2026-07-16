import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition } from "@/types/database";
import type { Classification } from "@/types/tournament";

// Well-known IDs from the seed migration (20260716000000_seed_the_hundred_tournament.sql).
const THE_HUNDRED_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000100";
const THE_HUNDRED_BRACKET_TEMPLATE_ID = "c0000000-0000-0000-0000-000000000100";

// Sporting stage IDs from the seed. Exported so pick/admin surfaces can detect
// specific stages without duplicating the UUIDs.
export const THE_HUNDRED_STAGE_IDS = {
  LEAGUE: "b0000000-0000-0000-0001-000000000100",
  ELIMINATOR: "b0000000-0000-0000-0002-000000000100",
  FINAL: "b0000000-0000-0000-0003-000000000100",
} as const;

const STAGE_IDS = THE_HUNDRED_STAGE_IDS;

// Prediction windows. Per-game league picks all live under the single League
// Stage window (each fixture is its own event with its own lock_time); the
// playoff has its own windows.
const PREDICTION_WINDOWS = [
  { name: "League Stage", stageId: STAGE_IDS.LEAGUE, windowNumber: 1 },
  { name: "Eliminator", stageId: STAGE_IDS.ELIMINATOR, windowNumber: 2 },
  { name: "Final", stageId: STAGE_IDS.FINAL, windowNumber: 3 },
] as const;

export type TheHundredEdition = "mens" | "womens";

interface CreateTheHundredOptions {
  name: string;
  visibility: "public" | "private";
  /** Which edition this instance tracks. Same blueprint, different fixtures. */
  edition: TheHundredEdition;
  maxEntrants?: number; // Hard cap on membership. Null = unlimited.
  minEntrants?: number; // Minimum to proceed. Null = no minimum.
  /** Subset of classification keys to enable; "overall" is always included. */
  enabledClassifications?: string[]; // e.g. ["overall","outrights","bracket"]
  /** Skip round creation — auto-provisioned instances share rounds via tournament_id RLS. */
  skipRounds?: boolean;
}

/**
 * Creates a "The Hundred" prediction game (Archetype B: league table -> top-3
 * playoff). Classifications: overall (cumulative leaderboard), outrights
 * (season-long futures board), and bracket (playoff survivor). Unlike the
 * World Cup, there is NO format-elimination survival game — a round-robin
 * league has no staged knockout shape to mirror.
 *
 * Not atomic — if any step fails, partial data may remain (caller should handle).
 */
export async function createTheHundredCompetition(
  supabase: SupabaseClient,
  userId: string,
  options: CreateTheHundredOptions
): Promise<{ competition: Competition; classifications: Classification[] }> {
  // 1. Create competition
  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .insert({
      name: options.name,
      type: "fixed",
      visibility: options.visibility,
      status: "draft",
      tournament_id: THE_HUNDRED_TOURNAMENT_ID,
      product_mode: "predictsport_full",
      scoring_rules: {
        // Defaults copied onto new events as event_prediction_types; the EPT
        // rows remain the per-event source of truth.
        match_outcome: 2,
        margin_bonus: 3,
        playoff_advancing_team: 1,
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
      config: { edition: options.edition },
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
      // A separate board fed only by season-long outright events, tagged via
      // classification_events.counts_for_scoring.
      config: { edition: options.edition, source: "outright_events" },
    },
    {
      competition_id: competitionId,
      classification_key: "bracket",
      classification_type: "bracket_survivor" as const,
      name: "Playoff Bracket",
      // Opens once the league table is final and the top 3 are known.
      status: "draft" as const,
      scoring_strategy: { type: "bracket_alive_dead" },
      config: {
        bracket_type: "top3_eliminator",
        bracket_template_id: THE_HUNDRED_BRACKET_TEMPLATE_ID,
        opens_after: "league_stage_finalised",
        edition: options.edition,
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
  // Skipped when skipRounds is true — auto-provisioned instances share the
  // original rounds via tournament_id RLS.
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
