import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition } from "@/types/database";
import type { Classification } from "@/types/tournament";
import { generateEliminationCurve } from "@/lib/tournament/format/curve-generator";

// Well-known IDs from seed migration
const WC2026_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000026";
const WC2026_BRACKET_TEMPLATE_ID = "c0000000-0000-0000-0000-000000000026";

// Sporting stage IDs from seed. Exported so other modules (e.g. the
// /wc/picks page) can detect specific stages without duplicating the UUIDs.
export const WC2026_STAGE_IDS = {
  GM1: "b0000000-0000-0000-0001-000000000026",
  GM2: "b0000000-0000-0000-0002-000000000026",
  GM3: "b0000000-0000-0000-0003-000000000026",
  R32: "b0000000-0000-0000-0004-000000000026",
  R16: "b0000000-0000-0000-0005-000000000026",
  QF: "b0000000-0000-0000-0006-000000000026",
  SF: "b0000000-0000-0000-0007-000000000026",
  FINAL: "b0000000-0000-0000-0009-000000000026",
} as const;

const STAGE_IDS = WC2026_STAGE_IDS;

// Prediction window definitions — PW8 bundles Third-Place + Final (no internal elimination)
const PREDICTION_WINDOWS = [
  { name: "Group Matchday 1", stageId: STAGE_IDS.GM1, windowNumber: 1 },
  { name: "Group Matchday 2", stageId: STAGE_IDS.GM2, windowNumber: 2 },
  { name: "Group Matchday 3", stageId: STAGE_IDS.GM3, windowNumber: 3 },
  { name: "Round of 32", stageId: STAGE_IDS.R32, windowNumber: 4 },
  { name: "Round of 16", stageId: STAGE_IDS.R16, windowNumber: 5 },
  { name: "Quarter-Finals", stageId: STAGE_IDS.QF, windowNumber: 6 },
  { name: "Semi-Finals", stageId: STAGE_IDS.SF, windowNumber: 7 },
  { name: "Finals", stageId: STAGE_IDS.FINAL, windowNumber: 8 },
] as const;

interface CreateWCOptions {
  name: string;
  visibility: "public" | "private";
  entrantCount: number; // 8-96, validated by generateEliminationCurve
  maxEntrants?: number; // Hard cap on membership. Null = unlimited.
  minEntrants?: number; // Minimum to proceed. Null = no minimum.
  groupDrawHoursBefore?: number; // Hours before first event to draw groups. Default 24.
  enabledClassifications?: string[]; // e.g. ["overall","format","full_bracket","knockout_bracket"]; omit for all
  skipRounds?: boolean; // When true, skip round creation — auto-provisioned instances share rounds via tournament_id RLS
}

/**
 * Creates a World Cup 2026 prediction game with all 4 classifications and 8 prediction windows.
 * Atomic — if any step fails, partial data may remain (caller should handle).
 */
export async function createWorldCupCompetition(
  supabase: SupabaseClient,
  userId: string,
  options: CreateWCOptions
): Promise<{ competition: Competition; classifications: Classification[] }> {
  // 1. Create competition
  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .insert({
      name: options.name,
      type: "fixed",
      visibility: options.visibility,
      status: "draft",
      tournament_id: WC2026_TOURNAMENT_ID,
      product_mode: "world_cup_2026_shell",
      scoring_rules: {
        group_match_outcome: 2,
        exact_score_bonus: 3,
        knockout_advancing_team: 1,
      },
      lock_default_minutes: 30,
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
      classification_key: "format",
      classification_type: "format_elimination" as const,
      name: "Format",
      status: "active" as const,
      scoring_strategy: {
        type: "stage_local",
        points_per_outcome: 2,
        points_per_exact: 3,
        points_per_advancing: 1,
      },
      elimination_strategy: {
        type: "curve",
        entrant_count: options.entrantCount,
      },
      config: {
        group_size: 4,
        group_draw_hours_before: options.groupDrawHoursBefore ?? 24,
        elimination_curve: {
          entrantCount: options.entrantCount,
          locked: false,
          curve: generateEliminationCurve(options.entrantCount),
        },
      },
    },
    {
      competition_id: competitionId,
      classification_key: "full_bracket",
      classification_type: "bracket_survivor" as const,
      name: "Full Bracket",
      status: "active" as const,
      scoring_strategy: { type: "bracket_alive_dead" },
      config: {
        bracket_type: "full",
        bracket_template_id: WC2026_BRACKET_TEMPLATE_ID,
        lock_event: "tournament_start",
      },
    },
    {
      competition_id: competitionId,
      classification_key: "knockout_bracket",
      classification_type: "bracket_survivor" as const,
      name: "Knockout Bracket",
      status: "draft" as const, // Activates after group stage finalised
      scoring_strategy: { type: "bracket_alive_dead" },
      config: {
        bracket_type: "knockout_only",
        bracket_template_id: WC2026_BRACKET_TEMPLATE_ID,
        opens_after: "group_stage_finalised",
      },
    },
  ];

  // Filter to only enabled classifications if specified (always include "overall")
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

  // 3. Create 8 prediction windows (rounds)
  // Skipped when skipRounds is true — auto-provisioned instances share the original rounds via tournament_id RLS.
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

  return { competition: competition as Competition, classifications: classifications as Classification[] };
}

