/**
 * Tournament template types
 *
 * Defines the structure for tournament configurations that drive
 * the generic bracket engine. Each tournament (WC 2026, Euros, GAA)
 * provides a template that configures groups, knockout stages, and rules.
 */

import { Sport } from '@/lib/sports/types'
import {
  TiebreakerRule,
  KnockoutStage,
  AdvancementRule,
  MatchupRule,
} from '../types'

export interface TournamentTemplate {
  /** Unique identifier for this template */
  id: string

  /** Display name */
  name: string

  /** Sport this tournament is for */
  sport: Sport

  /** Group stage configuration (optional - not all tournaments have groups) */
  groups?: {
    count: number                // Number of groups (12 for WC 2026)
    teamsPerGroup: number        // Teams per group (4 for WC 2026)
    advancePerGroup: AdvancementRule[]  // Who advances from each group
  }

  /** Knockout stage structure */
  knockoutStages: KnockoutStage[]

  /** Tiebreaker hierarchy for group standings */
  tiebreakers: TiebreakerRule[]

  /**
   * Stage pick classifications (automatic classifications based on bracket)
   * e.g., R32 Classification = how many of the 32 knockout teams did you predict?
   */
  stagePickClassifications?: Record<string, {
    name: string
    pointsPerCorrectTeam: number
  }>

  /**
   * Optional: Matchup rules for knockout bracket generation
   * If not provided, adapter must implement custom matchup logic
   */
  matchupRules?: Record<string, MatchupRule[]>  // 'r32': [...rules]
}

/**
 * Template registry
 * Maps template IDs to their implementations
 */
export interface TemplateRegistry {
  [templateId: string]: TournamentTemplate
}
