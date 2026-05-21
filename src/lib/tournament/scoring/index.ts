/**
 * Tournament Scoring System
 *
 * Central export for all tournament classification scoring functions.
 *
 * Classification types:
 * - stage_pick: Team accuracy at a specific knockout stage (e.g., R32)
 * - bracket_pick: Full bracket accuracy (exact matches, winners, path)
 * - outright_winner: Champion prediction
 *
 * Phase 1: R32 Classification (stage_pick) + Champion
 * Phase 2: Knockout Bracket Classification (bracket_pick)
 */

// Re-export stage pick (R32 Classification)
export {
  calculateR32Classification,
  calculateStagePickScore,
  calculateAccuracyPercentage,
  formatStagePickScore,
  getR32ClassificationExplanation,
} from './stage-pick'

export type { StagePickScore } from './stage-pick'

// Future Phase 2 exports:
// export { calculateBracketScore } from './bracket-pick'
// export { calculateChampionScore } from './champion-pick'
