/**
 * Core types for generic tournament bracket system
 *
 * These types are sport-agnostic and work for any tournament format.
 * Sport-specific logic lives in adapters (e.g., fifa-world-cup-2026.ts)
 */

import { Sport } from '@/lib/sports/types'

// ============================================================================
// Tiebreaker System
// ============================================================================

export type TiebreakerType =
  | 'head_to_head_points'
  | 'head_to_head_gd'
  | 'head_to_head_gs'
  | 'overall_gd'
  | 'overall_gs'
  | 'fair_play'          // Phase 2: requires card tracking
  | 'ranking'            // FIFA/World Rugby/etc.
  | 'tries_scored'       // Rugby-specific
  | 'goals_scored'       // GAA-specific
  | 'random'             // Fallback

export interface TiebreakerRule {
  type: TiebreakerType
  config?: {
    uiMessage?: string      // Custom message for UI (e.g., random fallback)
    rankingSource?: string  // 'fifa', 'world_rugby', etc.
  }
}

// ============================================================================
// Team & Match Data
// ============================================================================

export interface TeamWithStats {
  name: string
  points: number
  gd: number        // goal difference
  gs: number        // goals scored
  gc: number        // goals conceded
  wins: number
  draws: number
  losses: number
  position?: number // 1-4 in group
  groupId?: string
}

export interface MatchPrediction {
  match_id: string
  home_team: string
  away_team: string
  outcome: 'home' | 'draw' | 'away'
  home_score?: number
  away_score?: number
}

export interface GroupPredictionData {
  predictions: MatchPrediction[]
  standings: TeamWithStats[]
}

// ============================================================================
// Knockout Structure
// ============================================================================

export interface KnockoutStage {
  id: string           // 'r32', 'r16', 'qf', 'sf', 'final'
  name: string         // 'Round of 32', 'Quarter Finals'
  matchCount: number   // 16, 8, 4, 2, 1
  advancesTo?: string  // next stage id (null for final/third-place)
}

export interface BracketMatch {
  match_id: string
  home_team?: string
  away_team?: string
  winner?: string
  slot_info?: {       // For explaining bracket positions
    home_source: string  // "Group A Winner"
    away_source: string  // "Best 3rd from Groups A/B/C"
  }
}

export interface KnockoutBracket {
  stages: Record<string, BracketMatch[]>  // 'r32': [...], 'r16': [...]
}

// ============================================================================
// Qualification Rules
// ============================================================================

export interface QualificationConditions {
  rankBy: TiebreakerRule[]
  selectTop: number
}

export interface AdvancementRule {
  position: number    // Group position (1=winner, 2=runner-up, 3=third)
  count: number       // How many advance (e.g., 12 winners, 8 best thirds)
  conditions?: QualificationConditions
}

// ============================================================================
// Bracket Submission Data
// ============================================================================

export interface BracketData {
  template_id: string

  groups?: Record<string, GroupPredictionData>

  stage_qualifiers: Record<string, string[]>  // 'r32': [...32 teams], 'qf': [...8 teams]

  knockout_predictions: Record<string, Array<{
    match_id: string
    winner: string
    home_team?: string
    away_team?: string
  }>>

  champion: string
}

export interface BracketSubmission {
  id: string
  competition_id: string
  user_id: string
  classification_id: string
  bracket_data: BracketData
  submitted_at: string
  locked: boolean
  version: number
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

// ============================================================================
// Team Selection (for matchup rules)
// ============================================================================

export type TeamSelectorType =
  | 'group_winner'
  | 'group_runner_up'
  | 'best_third'
  | 'knockout_winner'

export interface TeamSelector {
  type: TeamSelectorType
  groupId?: string        // For group_winner/runner_up
  rank?: number           // For best_third (1-8)
  matchId?: string        // For knockout_winner
}

export interface MatchupRule {
  match_number: number    // Match number in stage (1-16 for R32)
  home: TeamSelector
  away: TeamSelector
}

// ============================================================================
// Slot Allocation (tournament-specific)
// ============================================================================

export interface SlotAssignment {
  team: string
  stageId: string
  matchNumber: number
  position: 'home' | 'away'
  explanation: string     // UI display: "3rd from Group A/B/C"
}

// ============================================================================
// Qualified Teams
// ============================================================================

export interface QualifiedTeam {
  name: string
  source: {
    type: 'group_winner' | 'group_runner_up' | 'best_third'
    groupId?: string
    position?: number
    rank?: number      // For best thirds (1-8)
  }
  stats: TeamWithStats
}
