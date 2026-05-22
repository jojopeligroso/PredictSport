// Tournament system types — 12 new tables for Classifications, Brackets, Finalisations.

// ============================================================
// Type unions
// ============================================================

export type TournamentStatus = "upcoming" | "active" | "completed" | "archived";
export type StageType = "group" | "knockout";
export type StageStatus = "upcoming" | "active" | "finalised";
export type ClassificationType = "leaderboard" | "format_elimination" | "bracket_survivor";
export type ClassificationStatus = "draft" | "active" | "finalised" | "archived";
export type MembershipStatus = "active" | "eliminated" | "dead" | "winner" | "withdrawn";
export type SnapshotType = "window" | "stage" | "final" | "correction";
export type GenerationMethod = "manual" | "automatic" | "correction";
export type BracketType = "single_elimination" | "double_elimination" | "group_plus_knockout";
export type BracketSubmissionStatus = "draft" | "submitted" | "locked" | "superseded";
export type FinalisationType = "window" | "stage";
export type FinalisationStatus = "pending" | "finalised" | "corrected";
export type FinalisationMethod = "manual" | "automatic";
export type GroupMemberStatus = "active" | "qualified_top" | "qualified_third" | "eliminated";
export type ProductMode = "predictsport_full" | "world_cup_2026_shell" | "world_cup_2026_archive";

// ============================================================
// Sporting Tournament tables
// ============================================================

export interface SportingTournament {
  id: string;
  slug: string;
  name: string;
  sport: string;
  template_key: string | null;
  config: Record<string, unknown>;
  status: TournamentStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SportingStage {
  id: string;
  tournament_id: string;
  slug: string;
  name: string;
  stage_order: number;
  stage_type: StageType;
  config: Record<string, unknown>;
  status: StageStatus;
  finalised_at: string | null;
  finalised_by: string | null;
  created_at: string;
}

// ============================================================
// Classification tables
// ============================================================

export interface Classification {
  id: string;
  competition_id: string;
  classification_key: string;
  classification_type: ClassificationType;
  name: string;
  status: ClassificationStatus;
  scoring_strategy: Record<string, unknown>;
  elimination_strategy: Record<string, unknown> | null;
  config: Record<string, unknown>;
  source_template_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassificationMembership {
  id: string;
  classification_id: string;
  competition_id: string;
  user_id: string;
  status: MembershipStatus;
  entered_at: string;
  eliminated_at: string | null;
  eliminated_window_id: string | null;
  eliminated_stage_id: string | null;
  elimination_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClassificationEvent {
  id: string;
  classification_id: string;
  competition_id: string;
  prediction_window_id: string | null;
  event_id: string | null;
  sporting_stage_id: string | null;
  counts_for_scoring: boolean;
  counts_for_elimination: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Standing Snapshots
// ============================================================

export interface StandingRow {
  rank: number;
  user_id: string;
  display_name: string;
  points: number;
  status: MembershipStatus;
  tie_break_values: Record<string, number>;
  movement: number | null;
  eliminated: boolean;
  metadata: Record<string, unknown>;
}

export interface ClassificationStandingsSnapshot {
  id: string;
  classification_id: string;
  competition_id: string;
  prediction_window_id: string | null;
  sporting_stage_id: string | null;
  finalisation_id: string | null;
  snapshot_type: SnapshotType;
  standings_data: StandingRow[];
  entrant_count: number;
  generated_at: string;
  generated_by: string | null;
  generation_method: GenerationMethod;
  checksum: string | null;
  created_at: string;
}

// ============================================================
// Format Prediction Groups
// ============================================================

export interface FormatPredictionGroup {
  id: string;
  classification_id: string;
  competition_id: string;
  group_name: string;
  group_number: number;
  target_size: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FormatGroupMembership {
  id: string;
  group_id: string;
  classification_id: string;
  user_id: string;
  seed_position: number | null;
  status: GroupMemberStatus;
  created_at: string;
}

// ============================================================
// Bracket System
// ============================================================

export interface BracketTemplate {
  id: string;
  template_key: string;
  name: string;
  sport: string;
  bracket_type: BracketType;
  config: BracketTemplateConfig;
  created_at: string;
  updated_at: string;
}

export interface BracketTemplateConfig {
  groups: { groupId: string; name: string; teams: string[] }[];
  knockoutRounds: { roundKey: string; name: string; matchCount: number; slotIds: string[] }[];
  bestThirdConfig?: {
    qualifyCount: number;
    totalGroups: number;
    allocationMatrix: Record<string, Record<string, string>>;
  };
  thirdPlacePlayoff: boolean;
}

export interface BracketPredictionSubmission {
  id: string;
  competition_id: string;
  classification_id: string;
  bracket_template_id: string;
  user_id: string;
  version_number: number;
  status: BracketSubmissionStatus;
  bracket_data: BracketSubmissionData;
  submitted_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BracketSubmissionData {
  /**
   * Per-group finishing order (1st → 4th). The contract consumed by the
   * scoring engine, `validateWC2026Bracket`, and `generateWC2026R32Matchups`.
   * Derived from `groupsV2` via `groupDataToRankings` at save/submit time.
   */
  groupRankings: Record<string, string[]>;
  /**
   * Raw W/D/L group predictions from the wizard's match-based group step.
   * Additive and optional — no scoring path reads it; it exists so a draft
   * can round-trip the richer match/tiebreaker data the user entered.
   */
  groupsV2?: GroupDataV2[];
  bestThirdPicks: string[];
  knockoutPicks: Record<string, { winner: string }>;
  champion: string;
  thirdPlace?: string;
}

/**
 * One group's match-level predictions, as captured by the W/D/L group step
 * (`GroupResultsStepV2`). Structurally mirrors that component's `GroupData`;
 * declared here so `BracketSubmissionData` (a server-and-client type) does not
 * import a client component module.
 */
export interface GroupDataV2 {
  group_id: string;
  group_name: string;
  teams: string[];
  matches: Array<{
    match_id: string;
    home_team: string;
    away_team: string;
    result: "home_win" | "draw" | "away_win" | null;
    exact_score?: { home_score: number; away_score: number };
  }>;
  has_tiebreaker_scores: boolean;
}

// ============================================================
// Result Finalisations & Corrections
// ============================================================

export interface ResultFinalisation {
  id: string;
  competition_id: string;
  prediction_window_id: string | null;
  sporting_stage_id: string | null;
  finalisation_type: FinalisationType;
  status: FinalisationStatus;
  finalised_at: string | null;
  finalised_by: string | null;
  finalisation_method: FinalisationMethod | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ResultCorrection {
  id: string;
  finalisation_id: string;
  corrected_by: string;
  corrected_at: string;
  reason: string;
  old_result_data: Record<string, unknown>;
  new_result_data: Record<string, unknown>;
  affected_event_ids: string[];
  affected_window_ids: string[] | null;
  affected_stage_ids: string[] | null;
  scoring_recalculated: boolean;
  eliminations_changed: boolean;
  previous_snapshot_id: string | null;
  replacement_snapshot_id: string | null;
  metadata: Record<string, unknown>;
}
