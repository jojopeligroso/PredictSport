/**
 * Generic Tournament Bracket Engine
 *
 * Sport-agnostic logic for processing tournament brackets:
 * - Group stage standings calculation with tiebreaker support
 * - Best-third ranking and selection
 * - Knockout bracket generation
 * - Stage qualifier extraction
 *
 * This engine is driven by TournamentTemplate configuration and adapters.
 * No sport-specific logic should exist here.
 */

import {
  MatchPrediction,
  TeamWithStats,
  TiebreakerRule,
  TournamentTemplate,
  QualifiedTeam,
  BracketMatch,
  BracketData,
  GroupPredictionData,
} from './types'

// ============================================================================
// Group Stage: Calculate Standings with Tiebreakers
// ============================================================================

/**
 * Calculate group standings from match predictions
 *
 * Applies full tiebreaker hierarchy when teams are level on points.
 * Returns teams sorted by position (1st, 2nd, 3rd, 4th).
 *
 * @param predictions - All match predictions for this group
 * @param tiebreakers - Ordered list of tiebreaker rules
 * @param teamNames - All team names in the group (for zero-match teams)
 * @returns Sorted standings with stats and positions
 */
export function calculateGroupStandings(
  predictions: MatchPrediction[],
  tiebreakers: TiebreakerRule[],
  teamNames: string[]
): TeamWithStats[] {
  // Step 1: Initialize stats for all teams
  const statsMap = new Map<string, TeamWithStats>()

  teamNames.forEach((name) => {
    statsMap.set(name, {
      name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      triesScored: 0, // For rugby
      bonusPoints: 0, // For rugby
      position: 0, // Will be assigned after sorting
    })
  })

  // Step 2: Process each match prediction
  predictions.forEach((pred) => {
    const home = statsMap.get(pred.home_team)
    const away = statsMap.get(pred.away_team)

    if (!home || !away) {
      console.warn(
        `Match prediction references unknown team: ${pred.home_team} vs ${pred.away_team}`
      )
      return
    }

    home.played++
    away.played++

    // Handle draw
    if (pred.home_score === pred.away_score) {
      home.draws++
      away.draws++
      home.points += 1
      away.points += 1
    }
    // Home win
    else if (pred.home_score > pred.away_score) {
      home.wins++
      away.losses++
      home.points += 3
    }
    // Away win
    else {
      away.wins++
      home.losses++
      away.points += 3
    }

    // Goals/points scored
    home.goalsFor += pred.home_score
    home.goalsAgainst += pred.away_score
    away.goalsFor += pred.away_score
    away.goalsAgainst += pred.home_score

    // Goal difference
    home.goalDifference = home.goalsFor - home.goalsAgainst
    away.goalDifference = away.goalsFor - away.goalsAgainst

    // Rugby-specific: tries scored (if provided)
    if (pred.home_tries !== undefined) home.triesScored += pred.home_tries
    if (pred.away_tries !== undefined) away.triesScored += pred.away_tries

    // Rugby-specific: bonus points (if provided)
    if (pred.home_bonus_points !== undefined)
      home.bonusPoints += pred.home_bonus_points
    if (pred.away_bonus_points !== undefined)
      away.bonusPoints += pred.away_bonus_points
  })

  // Step 3: Sort teams by points, then apply tiebreakers
  const teams = Array.from(statsMap.values())

  // Primary sort: points descending
  teams.sort((a, b) => b.points - a.points)

  // Step 4: Identify tied groups and apply tiebreakers
  const finalStandings: TeamWithStats[] = []
  let currentPosition = 1

  let i = 0
  while (i < teams.length) {
    // Find all teams with same points as teams[i]
    const tiedTeams: TeamWithStats[] = []
    const currentPoints = teams[i].points

    while (i < teams.length && teams[i].points === currentPoints) {
      tiedTeams.push(teams[i])
      i++
    }

    // If only one team at this point level, no tiebreaker needed
    if (tiedTeams.length === 1) {
      tiedTeams[0].position = currentPosition
      finalStandings.push(tiedTeams[0])
      currentPosition++
    } else {
      // Apply tiebreakers to resolve the tie
      const resolved = applyTiebreakers(
        tiedTeams,
        tiebreakers,
        predictions,
        currentPosition
      )
      finalStandings.push(...resolved)
      currentPosition += resolved.length
    }
  }

  return finalStandings
}

// ============================================================================
// Tiebreaker Application
// ============================================================================

/**
 * Apply tiebreaker hierarchy to resolve ties
 *
 * Recursively applies tiebreaker rules until all teams are separated,
 * or fallback to random if all rules exhausted.
 *
 * @param teams - Teams tied on points
 * @param tiebreakers - Ordered tiebreaker rules
 * @param allMatches - All group matches (for head-to-head)
 * @param startPosition - Starting position for this tied group
 * @returns Sorted teams with positions assigned
 */
function applyTiebreakers(
  teams: TeamWithStats[],
  tiebreakers: TiebreakerRule[],
  allMatches: MatchPrediction[],
  startPosition: number
): TeamWithStats[] {
  if (teams.length === 1) {
    teams[0].position = startPosition
    return teams
  }

  // Try each tiebreaker rule in order
  for (const rule of tiebreakers) {
    const sorted = applyTiebreaker(teams, rule, allMatches)

    // Check if this tiebreaker separated the teams
    const stillTied = groupByTiebreaker(sorted, rule, allMatches)

    // If we separated everyone, assign positions and return
    if (stillTied.every((group) => group.length === 1)) {
      sorted.forEach((team, index) => {
        team.position = startPosition + index
      })
      return sorted
    }

    // If this tiebreaker partially separated teams, recurse on each tied subgroup
    if (stillTied.some((group) => group.length > 1)) {
      const result: TeamWithStats[] = []
      let currentPos = startPosition

      for (const group of stillTied) {
        if (group.length === 1) {
          group[0].position = currentPos
          result.push(group[0])
          currentPos++
        } else {
          // Recurse with remaining tiebreakers
          const remainingRules = tiebreakers.slice(tiebreakers.indexOf(rule) + 1)
          const resolved = applyTiebreakers(group, remainingRules, allMatches, currentPos)
          result.push(...resolved)
          currentPos += resolved.length
        }
      }

      return result
    }

    // Continue to next tiebreaker rule
  }

  // Fallback: If we exhausted all tiebreakers, teams remain tied
  // Assign same position to all (should not happen if 'random' is last rule)
  teams.forEach((team) => {
    team.position = startPosition
  })

  return teams
}

/**
 * Apply a single tiebreaker rule to sort teams
 *
 * @param teams - Teams to sort
 * @param rule - Tiebreaker rule to apply
 * @param allMatches - All group matches (for head-to-head)
 * @returns Sorted teams (may still contain ties)
 */
function applyTiebreaker(
  teams: TeamWithStats[],
  rule: TiebreakerRule,
  allMatches: MatchPrediction[]
): TeamWithStats[] {
  const sorted = [...teams]

  switch (rule.type) {
    case 'head_to_head_points': {
      const h2hPoints = calculateHeadToHeadPoints(teams, allMatches)
      sorted.sort((a, b) => h2hPoints.get(b.name)! - h2hPoints.get(a.name)!)
      break
    }

    case 'head_to_head_gd': {
      const h2hGD = calculateHeadToHeadGD(teams, allMatches)
      sorted.sort((a, b) => h2hGD.get(b.name)! - h2hGD.get(a.name)!)
      break
    }

    case 'head_to_head_gs': {
      const h2hGS = calculateHeadToHeadGS(teams, allMatches)
      sorted.sort((a, b) => h2hGS.get(b.name)! - h2hGS.get(a.name)!)
      break
    }

    case 'overall_gd':
      sorted.sort((a, b) => b.goalDifference - a.goalDifference)
      break

    case 'overall_gs':
    case 'goals_scored':
      sorted.sort((a, b) => b.goalsFor - a.goalsFor)
      break

    case 'tries_scored':
      sorted.sort((a, b) => b.triesScored - a.triesScored)
      break

    case 'fair_play':
      // Phase 2: Requires card tracking in predictions
      // For now, no separation (all teams equal)
      break

    case 'ranking':
      // Phase 2: Requires external ranking dataset
      // For now, no separation (all teams equal)
      break

    case 'random':
      // Shuffle randomly
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
      }
      break
  }

  return sorted
}

/**
 * Group teams by whether they're still tied after applying a tiebreaker
 *
 * @returns Array of groups (each group contains teams still tied)
 */
function groupByTiebreaker(
  teams: TeamWithStats[],
  rule: TiebreakerRule,
  allMatches: MatchPrediction[]
): TeamWithStats[][] {
  const groups: TeamWithStats[][] = []
  let currentGroup: TeamWithStats[] = []

  teams.forEach((team, index) => {
    if (currentGroup.length === 0) {
      currentGroup.push(team)
    } else {
      const lastTeam = currentGroup[currentGroup.length - 1]

      // Check if this team is tied with the last team
      const isTied = isStillTied(lastTeam, team, rule, allMatches)

      if (isTied) {
        currentGroup.push(team)
      } else {
        groups.push(currentGroup)
        currentGroup = [team]
      }
    }

    // Push last group
    if (index === teams.length - 1) {
      groups.push(currentGroup)
    }
  })

  return groups
}

/**
 * Check if two teams are still tied after applying a tiebreaker
 */
function isStillTied(
  a: TeamWithStats,
  b: TeamWithStats,
  rule: TiebreakerRule,
  allMatches: MatchPrediction[]
): boolean {
  switch (rule.type) {
    case 'head_to_head_points': {
      const teams = [a, b]
      const h2hPoints = calculateHeadToHeadPoints(teams, allMatches)
      return h2hPoints.get(a.name) === h2hPoints.get(b.name)
    }

    case 'head_to_head_gd': {
      const teams = [a, b]
      const h2hGD = calculateHeadToHeadGD(teams, allMatches)
      return h2hGD.get(a.name) === h2hGD.get(b.name)
    }

    case 'head_to_head_gs': {
      const teams = [a, b]
      const h2hGS = calculateHeadToHeadGS(teams, allMatches)
      return h2hGS.get(a.name) === h2hGS.get(b.name)
    }

    case 'overall_gd':
      return a.goalDifference === b.goalDifference

    case 'overall_gs':
    case 'goals_scored':
      return a.goalsFor === b.goalsFor

    case 'tries_scored':
      return a.triesScored === b.triesScored

    case 'fair_play':
    case 'ranking':
      // Phase 2: Not implemented yet, so all teams remain tied
      return true

    case 'random':
      // Random never leaves teams tied (by definition)
      return false

    default:
      return true
  }
}

// ============================================================================
// Head-to-Head Calculations
// ============================================================================

/**
 * Calculate head-to-head points between tied teams
 *
 * Only considers matches between the teams in the tied group.
 */
function calculateHeadToHeadPoints(
  teams: TeamWithStats[],
  allMatches: MatchPrediction[]
): Map<string, number> {
  const points = new Map<string, number>()
  teams.forEach((t) => points.set(t.name, 0))

  const teamNames = new Set(teams.map((t) => t.name))

  // Filter to head-to-head matches only
  const h2hMatches = allMatches.filter(
    (m) => teamNames.has(m.home_team) && teamNames.has(m.away_team)
  )

  h2hMatches.forEach((match) => {
    if (match.home_score === match.away_score) {
      points.set(match.home_team, points.get(match.home_team)! + 1)
      points.set(match.away_team, points.get(match.away_team)! + 1)
    } else if (match.home_score > match.away_score) {
      points.set(match.home_team, points.get(match.home_team)! + 3)
    } else {
      points.set(match.away_team, points.get(match.away_team)! + 3)
    }
  })

  return points
}

/**
 * Calculate head-to-head goal difference between tied teams
 */
function calculateHeadToHeadGD(
  teams: TeamWithStats[],
  allMatches: MatchPrediction[]
): Map<string, number> {
  const gd = new Map<string, number>()
  teams.forEach((t) => gd.set(t.name, 0))

  const teamNames = new Set(teams.map((t) => t.name))

  const h2hMatches = allMatches.filter(
    (m) => teamNames.has(m.home_team) && teamNames.has(m.away_team)
  )

  h2hMatches.forEach((match) => {
    const homeDiff = match.home_score - match.away_score
    gd.set(match.home_team, gd.get(match.home_team)! + homeDiff)
    gd.set(match.away_team, gd.get(match.away_team)! - homeDiff)
  })

  return gd
}

/**
 * Calculate head-to-head goals scored between tied teams
 */
function calculateHeadToHeadGS(
  teams: TeamWithStats[],
  allMatches: MatchPrediction[]
): Map<string, number> {
  const gs = new Map<string, number>()
  teams.forEach((t) => gs.set(t.name, 0))

  const teamNames = new Set(teams.map((t) => t.name))

  const h2hMatches = allMatches.filter(
    (m) => teamNames.has(m.home_team) && teamNames.has(m.away_team)
  )

  h2hMatches.forEach((match) => {
    gs.set(match.home_team, gs.get(match.home_team)! + match.home_score)
    gs.set(match.away_team, gs.get(match.away_team)! + match.away_score)
  })

  return gs
}

// ============================================================================
// Smart Score Collection: Detect Which Tiebreakers Need User Input
// ============================================================================

/**
 * Detect which tiebreakers will be needed to resolve standings
 *
 * This is called BEFORE user predicts scores, to determine whether
 * we need to ask for additional inputs (e.g., home_tries, away_tries).
 *
 * Phase 1: Returns tiebreaker types that need score input.
 * Phase 2: Could optimize to only request scores when ties are detected.
 *
 * @param predictions - Current match predictions (may have null scores)
 * @param tiebreakers - Tournament's tiebreaker hierarchy
 * @returns Set of tiebreaker types that require additional score inputs
 */
export function detectTiebreakersNeeded(
  predictions: MatchPrediction[],
  tiebreakers: TiebreakerRule[]
): Set<string> {
  const needed = new Set<string>()

  // Check each tiebreaker rule
  tiebreakers.forEach((rule) => {
    switch (rule.type) {
      case 'tries_scored':
        // Rugby: Need tries scored if this tiebreaker is in the hierarchy
        needed.add('tries_scored')
        break

      case 'fair_play':
        // Phase 2: Would need yellow/red card counts
        break

      case 'ranking':
        // Phase 2: External data, no user input needed
        break

      // Other tiebreakers use standard match scores (no extra input needed)
      default:
        break
    }
  })

  return needed
}

// ============================================================================
// Best-Third Ranking: Rank Third-Place Teams Across Groups
// ============================================================================

/**
 * Rank third-place teams from all groups by tiebreaker rules
 *
 * Used for tournaments where best third-place teams advance (e.g., WC 2026).
 * Applies same tiebreaker hierarchy as group standings.
 *
 * @param thirds - All third-place teams from all groups
 * @param tiebreakers - Tiebreaker hierarchy
 * @param allGroupPredictions - All group predictions (for context)
 * @returns Ranked third-place teams (best first)
 */
export function rankTeamsByRules(
  thirds: TeamWithStats[],
  tiebreakers: TiebreakerRule[],
  allGroupPredictions: Record<string, MatchPrediction[]>
): TeamWithStats[] {
  // For best-third ranking, we don't use head-to-head (teams from different groups)
  // So we skip H2H tiebreakers and go straight to overall stats

  const relevantTiebreakers = tiebreakers.filter(
    (rule) =>
      rule.type !== 'head_to_head_points' &&
      rule.type !== 'head_to_head_gd' &&
      rule.type !== 'head_to_head_gs'
  )

  // Apply tiebreakers (no head-to-head, so pass empty array)
  return applyTiebreakers(thirds, relevantTiebreakers, [], 1)
}

// ============================================================================
// Knockout Bracket Generation (Generic)
// ============================================================================

/**
 * Generate knockout bracket matches from qualified teams
 *
 * This is a generic helper. Sport-specific bracket generation
 * (e.g., FIFA's best-third slot allocation) is handled by adapters.
 *
 * @param template - Tournament template
 * @param qualifiedTeams - All teams that qualified from groups
 * @param stageId - Knockout stage to generate (e.g., 'r32', 'r16')
 * @returns Bracket matches with slot assignments
 */
export function generateKnockoutBracket(
  template: TournamentTemplate,
  qualifiedTeams: QualifiedTeam[],
  stageId: string
): BracketMatch[] {
  const stage = template.knockoutStages.find((s) => s.id === stageId)

  if (!stage) {
    throw new Error(`Unknown knockout stage: ${stageId}`)
  }

  // For first knockout stage, use adapter-specific bracket generation
  // (e.g., FIFA's R32 has complex best-third allocation)
  //
  // For subsequent stages, matches are determined by previous round results
  // (handled by UI when user picks winners)

  // This generic function is primarily for validation and structure
  // Real bracket generation is delegated to adapters like generateFIFAR32Bracket

  const matches: BracketMatch[] = []

  for (let i = 0; i < stage.matchCount; i++) {
    matches.push({
      match_id: `${template.id}-${stageId}-${i + 1}`,
      home_team: 'TBD',
      away_team: 'TBD',
      slot_info: {
        home_source: 'TBD',
        away_source: 'TBD',
      },
    })
  }

  return matches
}

// ============================================================================
// Extract Stage Qualifiers from Bracket Data
// ============================================================================

/**
 * Extract which teams qualified for a specific knockout stage
 *
 * This is used for automatic R32 Classification scoring.
 * Compares user's group predictions vs actual results to determine
 * how many of the qualifying teams they predicted correctly.
 *
 * @param bracketData - User's full bracket predictions
 * @param stageId - Stage to extract qualifiers for (e.g., 'r32')
 * @returns Array of team names that qualified
 */
export function extractStageQualifiers(
  bracketData: BracketData,
  stageId: string
): string[] {
  // For R32: Extract all teams from group stage that advanced
  if (stageId === 'r32') {
    return bracketData.stage_qualifiers['r32'] || []
  }

  // For later stages: Extract from knockout predictions
  const previousStage = bracketData.knockout_predictions[stageId]
  if (!previousStage) return []

  return previousStage.map((match) => match.winner).filter((w): w is string => w !== null)
}

// ============================================================================
// Validation: Check Bracket Completeness
// ============================================================================

/**
 * Validate that bracket predictions are complete
 *
 * @param bracketData - User's bracket predictions
 * @param template - Tournament template
 * @returns Validation errors (empty array if valid)
 */
export function validateBracketCompleteness(
  bracketData: BracketData,
  template: TournamentTemplate
): string[] {
  const errors: string[] = []

  // Check groups (if tournament has groups)
  if (template.groups) {
    const expectedGroups = template.groups.count

    if (!bracketData.groups || Object.keys(bracketData.groups).length !== expectedGroups) {
      errors.push(
        `Expected ${expectedGroups} group predictions, got ${Object.keys(bracketData.groups || {}).length}`
      )
    }

    // Check each group has correct number of teams
    Object.entries(bracketData.groups || {}).forEach(([groupId, groupData]) => {
      const teamCount = groupData.team_names.length
      const expectedTeams = template.groups!.teamsPerGroup

      if (teamCount !== expectedTeams) {
        errors.push(
          `Group ${groupId}: Expected ${expectedTeams} teams, got ${teamCount}`
        )
      }

      // Check all matches predicted
      const expectedMatches = (expectedTeams * (expectedTeams - 1)) / 2
      if (groupData.match_predictions.length !== expectedMatches) {
        errors.push(
          `Group ${groupId}: Expected ${expectedMatches} matches, got ${groupData.match_predictions.length}`
        )
      }

      // Check all matches have scores
      const incompleteMcathes = groupData.match_predictions.filter(
        (m) => m.home_score === null || m.away_score === null
      )

      if (incompleteMcathes.length > 0) {
        errors.push(
          `Group ${groupId}: ${incompleteMcathes.length} matches missing scores`
        )
      }
    })
  }

  // Check knockout stages
  template.knockoutStages.forEach((stage) => {
    const stagePredictions = bracketData.knockout_predictions[stage.id]

    if (!stagePredictions || stagePredictions.length !== stage.matchCount) {
      errors.push(
        `Stage ${stage.name}: Expected ${stage.matchCount} matches, got ${stagePredictions?.length || 0}`
      )
    }

    // Check all matches have winners (except third place, which may not be predicted yet)
    if (stage.id !== 'third_place') {
      const incompleteMatches = (stagePredictions || []).filter((m) => !m.winner)

      if (incompleteMatches.length > 0) {
        errors.push(
          `Stage ${stage.name}: ${incompleteMatches.length} matches missing winners`
        )
      }
    }
  })

  // Check champion
  if (!bracketData.champion) {
    errors.push('No champion predicted')
  }

  return errors
}

// ============================================================================
// Helper: Process All Groups
// ============================================================================

/**
 * Process all group predictions and return standings for each group
 *
 * @param groups - All group predictions
 * @param tiebreakers - Tiebreaker hierarchy
 * @returns Map of groupId → sorted standings
 */
export function processAllGroups(
  groups: Record<string, GroupPredictionData>,
  tiebreakers: TiebreakerRule[]
): Record<string, TeamWithStats[]> {
  const standings: Record<string, TeamWithStats[]> = {}

  Object.entries(groups).forEach(([groupId, groupData]) => {
    standings[groupId] = calculateGroupStandings(
      groupData.match_predictions,
      tiebreakers,
      groupData.team_names
    )
  })

  return standings
}
