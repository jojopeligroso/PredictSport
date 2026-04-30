export type UserRole = "admin" | "co_admin" | "participant";
export type CompetitionType = "fixed" | "open";
export type CompetitionVisibility = "public" | "private";
export type CompetitionStatus = "draft" | "active" | "completed";
export type EventStatus =
  | "upcoming"
  | "locked"
  | "resulted"
  | "postponed"
  | "cancelled";
export type NominationStatus = "pending" | "approved" | "rejected";
export type PredictionType =
  | "winner"
  | "top_n"
  | "head_to_head"
  | "margin"
  | "over_under"
  | "handicap";

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_super_admin: boolean;
  notification_prefs: Record<string, unknown> | null;
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
  created_by: string;
  invite_code: string;
  created_at: string;
}

export interface CompetitionMember {
  id: string;
  competition_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
}

export interface Event {
  id: string;
  competition_id: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  prediction_types: Record<string, unknown>;
  result_data: Record<string, unknown> | null;
  result_confirmed: boolean;
  result_confirmed_by: string | null;
  status: EventStatus;
  nominated_by: string | null;
  external_event_id: string | null;
  created_at: string;
}

export interface Prediction {
  id: string;
  event_id: string;
  user_id: string;
  prediction_type: PredictionType;
  prediction_data: Record<string, unknown>;
  is_correct: boolean | null;
  is_partial: boolean;
  points_awarded: number;
  submitted_at: string;
  updated_at: string;
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
