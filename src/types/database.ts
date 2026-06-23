export type UserRole = "admin" | "co_admin" | "mod" | "participant";
export type CompetitionType = "fixed" | "open" | "personal";
export type CompetitionVisibility = "public" | "private";
export type CompetitionStatus = "draft" | "active" | "completed" | "archived";
export type RoundStatus = "draft" | "open" | "locked" | "scored";
export type EventStatus =
  | "upcoming"
  | "locked"
  | "resulted"
  | "postponed"
  | "cancelled";
export type NominationStatus = "pending" | "approved" | "rejected";
export type ChatMessageType =
  | "user"
  | "system"
  | "system_join"
  | "system_result"
  | "system_reckons"
  | "system_tag_reveal"
  | "system_tag_change"
  | "system_tag_reject"
  | "system_round_summary";
export type ChatDeletedBy = "user" | "mod" | "admin";
export type ChatMediaType = "image" | "gif";
export type PredictionType =
  | "winner"
  | "top_n"
  | "final_standings"
  | "head_to_head"
  | "margin"
  | "over_under"
  | "handicap"
  | "yes_no"
  | "progression"
  | "exact_score";

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_super_admin: boolean;
  notification_prefs: Record<string, unknown> | null;
  timezone: string | null;
  telegram_id: number | null;
  telegram_username: string | null;
  favourite_team: { sport: string; team_name: string; provider_id: string | null } | null;
  display_name_updated_at: string | null;
  created_at: string;
}

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  type: CompetitionType;
  visibility: CompetitionVisibility;
  status: CompetitionStatus;
  scoring_rules: Record<string, unknown>;
  lock_default_minutes: number;
  allow_nominations: boolean;
  min_rounds_required: number | null;
  allow_prediction_updates: boolean;
  created_by: string;
  invite_code: string;
  tournament_id: string | null;
  product_mode: string | null;
  entry_closes_at: string | null;
  entry_close_trigger: string | null;
  hidden_at: string | null;
  max_entrants: number | null;
  min_entrants: number | null;
  chat_enabled: boolean;
  instance_type: "full" | "knockout_only" | null;
  instance_number: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  competition_id: string;
  user_id: string | null;
  content: string;
  message_type: ChatMessageType;
  mentioned_user_ids: string[];
  reply_to_id: string | null;
  media_url: string | null;
  media_type: ChatMediaType | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_by: ChatDeletedBy | null;
}

export type NoteVisibility = "public" | "private";

export interface CompetitionMember {
  id: string;
  competition_id: string;
  user_id: string;
  role: UserRole;
  callout_label: string | null;
  chat_muted_until: string | null;
  joined_at: string;
}

export interface Round {
  id: string;
  competition_id: string;
  name: string;
  round_number: number;
  deadline: string | null;
  status: RoundStatus;
  sporting_stage_id: string | null;
  prediction_window_number: number | null;
  auto_lock_offset_minutes: number | null;
  created_at: string;
}

export interface EventPredictionType {
  id: string;
  event_id: string;
  prediction_type: PredictionType;
  points: number;
  partial_points: number;
  config: Record<string, unknown> | null;
}

export interface Event {
  id: string;
  competition_id: string;
  round_id: string | null;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  result_data: Record<string, unknown> | null;
  result_confirmed: boolean;
  result_confirmed_by: string | null;
  pick_reveal_at: string | null;
  status: EventStatus;
  nominated_by: string | null;
  external_event_id: string | null;
  sporting_event_id: string | null;
  provider_league: string | null;
  tournament_id: string | null;
  is_bracket_placeholder: boolean;
  created_at: string;
}

export interface Prediction {
  id: string;
  event_prediction_type_id: string;
  event_id: string;
  user_id: string;
  prediction_type: PredictionType;
  prediction_data: Record<string, unknown>;
  is_correct: boolean | null;
  is_partial: boolean;
  points_awarded: number;
  note_text: string | null;
  note_visibility: NoteVisibility;
  submitted_at: string;
  updated_at: string;
  confidence_level: number | null;
}

export interface PredictionReaction {
  id: string;
  prediction_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Tiebreaker {
  id: string;
  competition_id: string;
  question_text: string;
  correct_value: number | null;
}

export interface TiebreakerAnswer {
  id: string;
  tiebreaker_id: string;
  user_id: string;
  value: number;
  submitted_at: string;
}

export interface EventNomination {
  id: string;
  competition_id: string;
  nominated_by: string;
  event_name: string;
  sport: string;
  proposed_date: string;
  proposed_prediction_type: PredictionType | null;
  status: NominationStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface InviteToken {
  id: string;
  competition_id: string;
  token: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
}

// ============================================================
// Reputation Tags
// ============================================================

export type TagCategory = "behavioural" | "event_driven" | "engagement_pressure";
export type TagStatus = "pending" | "active" | "rejected" | "suppressed" | "expired";

export interface MemberTag {
  id: string;
  competition_id: string;
  user_id: string;
  round_id: string | null;
  event_id: string | null;
  tag_name: string;
  tag_category: TagCategory;
  status: TagStatus;
  stats: Record<string, unknown>;
  assigned_at: string;
  published_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  expired_at: string | null;
  created_at: string;
}

/** Row shape returned by compute_reputation_stats RPC */
export interface BehaviouralTagMetrics {
  user_id: string;
  total_predictions: number;
  events_available: number;
  engagement_rate: number;
  winner_correct: number;
  winner_total: number;
  exact_correct: number;
  exact_total: number;
  draws_predicted: number;
  total_goals_predicted: number;
  avg_goal_diff: number;
  avg_total_goals: number;
  max_goal_diff: number;
  blowouts_predicted: number;
  minority_picks: number;
  majority_picks: number;
  contrarian_pct: number;
  most_repeated_score: string;
  repeat_score_count: number;
  unique_scores_used: number;
  prediction_changes: number;
  avg_submission_lead_time_mins: number;
  earliest_submission_lead_hrs: number;
  latest_submission_lead_mins: number;
  public_notes_count: number;
  current_streak: number;
  best_streak: number;
}

/** Row shape returned by compute_event_tag_metrics RPC (v2 — per-member summary) */
export interface EventTagMetric {
  user_id: string;
  display_name: string;
  predicted: boolean;
  winner_correct: boolean;
  exact_correct: boolean;
  total_points_this_event: number;
  was_minority: boolean;
  pct_with_same_pick: number;
  current_correct_streak: number;
  current_wrong_streak: number;
  position_before: number;
  position_after: number;
  is_first_confirmed_event: boolean;
  is_last_confirmed_event: boolean;
  exact_score_count_total: number;
  winner_prediction_data: Record<string, unknown> | null;
  exact_score_prediction_data: Record<string, unknown> | null;
  submission_seconds_before_lock: number;
  is_first_exact_score: boolean;
}
