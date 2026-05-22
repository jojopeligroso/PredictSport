/**
 * Stage Pick Classification Scoring
 *
 * Scores how many teams a user correctly predicted would reach a specific
 * knockout stage (e.g., R32, R16, QF).
 *
 * Classification type: 'stage_pick'
 * - Path-insensitive: only checks IF team qualified, not bracket position
 * - 1 point per correct team
 * - Automatic byproduct of Full Bracket predictions
 *
 * Example: R32 Classification
 * - User predicts group matches
 * - Engine calculates which 32 teams advance
 * - Compare vs actual results: how many of their 32 match reality?
 * - Score = count of correct teams (max 32)
 */

import { BracketData, TeamWithStats } from '../bracket/types'
import { TournamentTemplate } from '../bracket/templates/types'
import { processAllGroups, extractStageQualifiers } from '../bracket/engine'

export interface StagePickScore {
  /** Classification type (e.g., 'r32', 'r16') */
  stage_id: string

  /** Points earned */
  points: number

  /** Maximum possible points */
  max_points: number

  /** How many teams correct */
  correct_count: number

  /** Total teams in this stage */
  total_teams: number

  /** Teams user predicted correctly */
  correct_teams: string[]

  /** Teams user predicted incorrectly */
  incorrect_predictions: string[]

  /** Teams user missed (qualified but not predicted) */
  missed_teams: string[]
}

/**
 * Calculate R32 Classification score
 *
 * Compares user's group stage predictions vs actual results.
 * Awards 1 point per team correctly predicted to reach R32.
 *
 * @param userBracket - User's full bracket predictions
 * @param actualGroupResults - Actual group stage standings
 * @param template - Tournament template
 * @returns R32 classification score breakdown
 */
export function calculateR32Classification(
  userBracket: BracketData,
  actualGroupResults: Record<string, TeamWithStats[]>,
  template: TournamentTemplate
): StagePickScore {
  // Extract user's predicted qualifiers
  const userQualifiers = extractQualifiersFromUserBracket(userBracket, template)

  // Extract actual qualifiers from group results
  const actualQualifiers = extractQualifiersFromActualResults(
    actualGroupResults,
    template
  )

  // Find intersection: which teams did user predict correctly?
  const correctTeams = userQualifiers.filter((team) => actualQualifiers.includes(team))

  // Find user's incorrect predictions
  const incorrectPredictions = userQualifiers.filter(
    (team) => !actualQualifiers.includes(team)
  )

  // Find missed teams (qualified but user didn't predict)
  const missedTeams = actualQualifiers.filter((team) => !userQualifiers.includes(team))

  const pointsPerTeam =
    template.stagePickClassifications?.r32?.pointsPerCorrectTeam || 1

  return {
    stage_id: 'r32',
    points: correctTeams.length * pointsPerTeam,
    max_points: actualQualifiers.length * pointsPerTeam,
    correct_count: correctTeams.length,
    total_teams: actualQualifiers.length,
    correct_teams: correctTeams,
    incorrect_predictions: incorrectPredictions,
    missed_teams: missedTeams,
  }
}

/**
 * Calculate stage pick score for any knockout stage
 *
 * Generic version that works for R32, R16, QF, SF, etc.
 *
 * @param userBracket - User's predictions
 * @param actualResults - Actual results (group or knockout)
 * @param stageId - Stage to score (e.g., 'r16', 'qf')
 * @param template - Tournament template
 * @returns Stage pick score breakdown
 */
export function calculateStagePickScore(
  userBracket: BracketData,
  actualResults: any, // Type depends on stage
  stageId: string,
  template: TournamentTemplate
): StagePickScore {
  // For R32: Use group results
  if (stageId === 'r32') {
    return calculateR32Classification(userBracket, actualResults, template)
  }

  // For later stages: Extract from knockout results
  const userQualifiers = extractStageQualifiers(userBracket, stageId)
  const actualQualifiers = extractStageQualifiers(actualResults, stageId)

  const correctTeams = userQualifiers.filter((team) => actualQualifiers.includes(team))
  const incorrectPredictions = userQualifiers.filter(
    (team) => !actualQualifiers.includes(team)
  )
  const missedTeams = actualQualifiers.filter((team) => !userQualifiers.includes(team))

  const stage = template.knockoutStages.find((s) => s.id === stageId)
  const expectedTeams = stage?.matchCount || actualQualifiers.length

  const pointsPerTeam =
    template.stagePickClassifications?.[stageId]?.pointsPerCorrectTeam || 1

  return {
    stage_id: stageId,
    points: correctTeams.length * pointsPerTeam,
    max_points: expectedTeams * pointsPerTeam,
    correct_count: correctTeams.length,
    total_teams: expectedTeams,
    correct_teams: correctTeams,
    incorrect_predictions: incorrectPredictions,
    missed_teams: missedTeams,
  }
}

/**
 * Extract which teams qualified from user's bracket predictions
 *
 * Process user's group predictions and determine which teams advanced.
 */
function extractQualifiersFromUserBracket(
  bracket: BracketData,
  template: TournamentTemplate
): string[] {
  if (!bracket.groups || !template.groups) {
    return []
  }

  // Process all groups to get standings
  const standings = processAllGroups(bracket.groups, template.tiebreakers)

  const qualifiers: string[] = []

  // Extract teams based on advancement rules
  template.groups.advancePerGroup.forEach((rule) => {
    if (rule.position <= 2) {
      // Winners and runners-up (all advance)
      Object.values(standings).forEach((groupStandings) => {
        const team = groupStandings.find((t) => t.position === rule.position)
        if (team) qualifiers.push(team.name)
      })
    } else if (rule.position === 3) {
      // Best thirds (only top N advance)
      const allThirds = Object.values(standings)
        .map((groupStandings) => groupStandings.find((t) => t.position === 3))
        .filter((t): t is TeamWithStats => t !== undefined)

      // Rank thirds by tiebreaker rules
      const rankedThirds = allThirds.sort((a, b) => {
        // Simple ranking by points, then GD, then GS
        if (b.points !== a.points) return b.points - a.points
        const aGd = a.goalDifference ?? 0
        const bGd = b.goalDifference ?? 0
        if (bGd !== aGd) return bGd - aGd
        return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
      })

      // Take top N thirds
      const selectTop = rule.conditions?.selectTop || rule.count
      rankedThirds.slice(0, selectTop).forEach((team) => {
        qualifiers.push(team.name)
      })
    }
  })

  return qualifiers
}

/**
 * Extract which teams actually qualified from actual results
 *
 * Same logic as user extraction, but on actual group results.
 */
function extractQualifiersFromActualResults(
  groupResults: Record<string, TeamWithStats[]>,
  template: TournamentTemplate
): string[] {
  if (!template.groups) return []

  const qualifiers: string[] = []

  template.groups.advancePerGroup.forEach((rule) => {
    if (rule.position <= 2) {
      // Winners and runners-up
      Object.values(groupResults).forEach((standings) => {
        const team = standings.find((t) => t.position === rule.position)
        if (team) qualifiers.push(team.name)
      })
    } else if (rule.position === 3) {
      // Best thirds
      const allThirds = Object.values(groupResults)
        .map((standings) => standings.find((t) => t.position === 3))
        .filter((t): t is TeamWithStats => t !== undefined)

      const rankedThirds = allThirds.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const aGd = a.goalDifference ?? 0
        const bGd = b.goalDifference ?? 0
        if (bGd !== aGd) return bGd - aGd
        return (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
      })

      const selectTop = rule.conditions?.selectTop || rule.count
      rankedThirds.slice(0, selectTop).forEach((team) => {
        qualifiers.push(team.name)
      })
    }
  })

  return qualifiers
}

/**
 * Calculate accuracy percentage for R32 classification
 *
 * Helper for leaderboard display.
 */
export function calculateAccuracyPercentage(score: StagePickScore): number {
  if (score.total_teams === 0) return 0
  return (score.correct_count / score.total_teams) * 100
}

/**
 * Format R32 classification score for display
 *
 * Example: "24/32 teams (75%)"
 */
export function formatStagePickScore(score: StagePickScore): string {
  const percentage = calculateAccuracyPercentage(score)
  return `${score.correct_count}/${score.total_teams} teams (${percentage.toFixed(0)}%)`
}

/**
 * Get user-friendly explanation of R32 classification
 *
 * For FAQ and help text.
 */
export function getR32ClassificationExplanation(template: TournamentTemplate): string {
  if (!template.groups) return ''

  const totalQualifiers = template.groups.advancePerGroup.reduce(
    (sum, rule) => sum + rule.count,
    0
  )

  const pointsPerTeam =
    template.stagePickClassifications?.r32?.pointsPerCorrectTeam || 1

  return `
Your R32 Classification is an automatic byproduct of your group stage predictions.

When you predict all group matches, we calculate which ${totalQualifiers} teams advance to the knockout stage. Then, when the actual group stage completes, we compare your predicted qualifiers vs the real qualifiers.

**Scoring:**
- ${pointsPerTeam} point per team you predicted correctly (max ${totalQualifiers * pointsPerTeam} points)
- Path-insensitive: doesn't matter which bracket slot, just whether they made it
- No separate prediction flow required

**Example:**
If you correctly predicted 24 of the 32 teams, you score ${24 * pointsPerTeam} points (75% accuracy).
`.trim()
}
