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
export type BracketType = "single_elimination" | "double_elimination" | "group_plus_knockout" | "league_plus_playoff";
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
  stage_finalisation_hold?: boolean;
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
// Classification Phases
// ============================================================

export type PhaseStatus = "pending" | "active" | "finalised";
export type ScoringScope = "stage_local" | "cumulative" | "none";
export type BranchType = "winners" | "losers" | "merge" | "continuation";
export type StageRole = "scoring" | "elimination_trigger" | "scoring_and_trigger";

export interface BestThirdsConfig {
  auto_qualify_group_sizes: number[];
  eligible_group_sizes: number[];
  never_qualify_group_sizes: number[];
}

export interface QualificationRules {
  method: "top_n_per_group_with_best_thirds" | "top_n_flat" | "bracket_seed" | "direct";
  /** For group phases: how many per group auto-qualify */
  qualify_per_group?: number;
  /** For knockout phases: total survivors from this phase */
  target_survivors?: number;
  best_thirds?: BestThirdsConfig;
  tie_handling?: "both_advance" | "tiebreaker" | "random";
}

export interface PoolStructure {
  type: "grouped" | "single";
  group_count?: number;
  group_sizes?: number[];
  parameters?: Record<string, unknown>;
}

export interface ClassificationPhase {
  id: string;
  classification_id: string;
  phase_key: string;
  phase_name: string;
  phase_order: number;
  entry_count: number | null;
  exit_count: number | null;
  qualification_rules: QualificationRules;
  pool_structure: PoolStructure;
  tiebreaker_rules: Record<string, unknown> | null;
  scoring_scope: ScoringScope;
  source_phase_id: string | null;
  branch_type: BranchType | null;
  status: PhaseStatus;
  activated_at: string | null;
  finalised_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClassificationPhaseStage {
  id: string;
  phase_id: string;
  sporting_stage_id: string;
  stage_role: StageRole;
  stage_order_within_phase: number;
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
  phase_id: string | null;
  status?: 'active' | 'archived';
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
   * Per-group finishing order (1st → 4th). Computed from `predictions` rows
   * via `groupDataToRankings` whenever needed (scoring, validation, knockout
   * matchup generation). Optional in the stored blob and never written by the
   * wizard under the 2026-05-23 unified-predictions amendment — kept here so
   * the submit endpoint can attach it to the validator input and so legacy
   * stored drafts can still be read.
   */
  groupRankings?: Record<string, string[]>;
  bestThirdPicks: string[];
  knockoutPicks: Record<string, { winner: string }>;
  champion: string;
  thirdPlace?: string;
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
