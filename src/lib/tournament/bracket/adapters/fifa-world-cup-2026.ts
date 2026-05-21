/**
 * FIFA World Cup 2026 Tournament Adapter
 *
 * Defines the complete tournament structure for FIFA World Cup 2026:
 * - 12 groups of 4 teams each (48 teams total)
 * - Top 2 from each group + best 8 third-place teams advance (32 teams)
 * - Knockout stages: R32 → R16 → QF → SF → Third Place + Final
 *
 * This adapter contains all FIFA-specific logic including:
 * - Group structure and qualification rules
 * - Best-third slot allocation (complex FIFA rules)
 * - Tiebreaker hierarchy
 */

import { TournamentTemplate } from '../templates/types'
import { FIFA_TIEBREAKERS } from '../tiebreakers/fifa'
import {
  TeamWithStats,
  SlotAssignment,
  QualifiedTeam,
} from '../types'
import { rankBestThirds } from '../utils'

// ============================================================================
// FIFA World Cup 2026 Template
// ============================================================================

export const FIFA_WC_2026_TEMPLATE: TournamentTemplate = {
  id: 'fifa-world-cup-2026',
  name: 'FIFA World Cup 2026',
  sport: 'soccer',

  groups: {
    count: 12,
    teamsPerGroup: 4,
    advancePerGroup: [
      {
        position: 1,
        count: 12, // All group winners
      },
      {
        position: 2,
        count: 12, // All runners-up
      },
      {
        position: 3,
        count: 8, // Best 8 third-place teams
        conditions: {
          rankBy: FIFA_TIEBREAKERS,
          selectTop: 8,
        },
      },
    ],
  },

  knockoutStages: [
    {
      id: 'r32',
      name: 'Round of 32',
      matchCount: 16,
      advancesTo: 'r16',
    },
    {
      id: 'r16',
      name: 'Round of 16',
      matchCount: 8,
      advancesTo: 'qf',
    },
    {
      id: 'qf',
      name: 'Quarter Finals',
      matchCount: 4,
      advancesTo: 'sf',
    },
    {
      id: 'sf',
      name: 'Semi Finals',
      matchCount: 2,
      advancesTo: 'final',
    },
    {
      id: 'third_place',
      name: 'Third Place Play-Off',
      matchCount: 1,
    },
    {
      id: 'final',
      name: 'Final',
      matchCount: 1,
    },
  ],

  tiebreakers: FIFA_TIEBREAKERS,

  stagePickClassifications: {
    r32: {
      name: 'R32 Classification',
      pointsPerCorrectTeam: 1,
    },
  },
}

// ============================================================================
// FIFA-Specific Best-Third Slot Allocation
// ============================================================================

/**
 * FIFA World Cup 2026 best-third slot allocation rules
 *
 * The 8 best third-place teams are assigned to specific R32 matches
 * based on which groups they came from. This is FIFA's complex allocation
 * system that prevents teams from the same group meeting in R32.
 *
 * Source: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup#Knockout_stage
 *
 * @param bestThirds - Array of 8 third-place teams ranked 1-8
 * @returns Slot assignments for each team
 */
export function allocateFIFABestThirdsToSlots(
  bestThirds: TeamWithStats[]
): SlotAssignment[] {
  // FIFA's slot allocation is based on which groups the best thirds came from
  // This is a simplified version - full implementation requires group origin tracking

  // For Phase 1: Assign best thirds to R32 matches in order
  // Phase 2: Implement full FIFA group-origin-based allocation

  const assignments: SlotAssignment[] = []

  // Best thirds fill specific R32 match slots
  // Matches 3, 4, 5, 6, 11, 12, 13, 14 receive best thirds
  const bestThirdSlots = [
    { match: 3, position: 'away' as const },
    { match: 4, position: 'away' as const },
    { match: 5, position: 'home' as const },
    { match: 6, position: 'home' as const },
    { match: 11, position: 'away' as const },
    { match: 12, position: 'away' as const },
    { match: 13, position: 'home' as const },
    { match: 14, position: 'home' as const },
  ]

  bestThirds.slice(0, 8).forEach((team, index) => {
    const slot = bestThirdSlots[index]
    assignments.push({
      team: team.name,
      stageId: 'r32',
      matchNumber: slot.match,
      position: slot.position,
      explanation: `3rd place (ranked #${index + 1})`,
    })
  })

  return assignments
}

// ============================================================================
// FIFA-Specific R32 Matchup Generation
// ============================================================================

/**
 * Generates FIFA World Cup 2026 R32 bracket
 *
 * Matchup rules for R32 (simplified):
 * - Group winners play runners-up or thirds
 * - No team plays against another from same group
 * - Best thirds allocated per FIFA rules
 *
 * @param qualifiedTeams - All 32 qualified teams (12 winners + 12 runners-up + 8 thirds)
 * @returns R32 bracket with 16 matches
 */
export function generateFIFAR32Bracket(
  qualifiedTeams: QualifiedTeam[]
): Array<{ match_id: string; home_team: string; away_team: string; slot_info: any }> {
  const winners = qualifiedTeams.filter((t) => t.source.type === 'group_winner')
  const runnersUp = qualifiedTeams.filter((t) => t.source.type === 'group_runner_up')
  const bestThirds = qualifiedTeams.filter((t) => t.source.type === 'best_third')

  // Sort by group for consistent bracket generation
  winners.sort((a, b) => (a.source.groupId || '').localeCompare(b.source.groupId || ''))
  runnersUp.sort((a, b) => (a.source.groupId || '').localeCompare(b.source.groupId || ''))

  // Allocate best thirds to slots
  const thirdSlotAssignments = allocateFIFABestThirdsToSlots(
    bestThirds.map((t) => t.stats)
  )

  const matches = []

  // Generate 16 R32 matches
  // Simplified FIFA bracket structure
  for (let i = 0; i < 16; i++) {
    const matchNumber = i + 1

    // Check if this match gets a best third
    const thirdAssignment = thirdSlotAssignments.find((a) => a.matchNumber === matchNumber)

    let home_team: string
    let away_team: string
    let home_source: string
    let away_source: string

    if (thirdAssignment) {
      // This match involves a best third
      if (thirdAssignment.position === 'home') {
        home_team = thirdAssignment.team
        home_source = thirdAssignment.explanation
        away_team = winners[i]?.name || runnersUp[i]?.name || 'TBD'
        away_source = winners[i] ? `Group ${winners[i].source.groupId} Winner` : 'TBD'
      } else {
        home_team = winners[i]?.name || runnersUp[i]?.name || 'TBD'
        home_source = winners[i] ? `Group ${winners[i].source.groupId} Winner` : 'TBD'
        away_team = thirdAssignment.team
        away_source = thirdAssignment.explanation
      }
    } else {
      // Standard winner vs runner-up match
      const winnerIndex = Math.floor(i / 2)
      const runnerUpIndex = 11 - Math.floor(i / 2) // Opposite pairing

      home_team = winners[winnerIndex]?.name || 'TBD'
      away_team = runnersUp[runnerUpIndex]?.name || 'TBD'
      home_source = winners[winnerIndex] ? `Group ${winners[winnerIndex].source.groupId} Winner` : 'TBD'
      away_source = runnersUp[runnerUpIndex] ? `Group ${runnersUp[runnerUpIndex].source.groupId} Runner-up` : 'TBD'
    }

    matches.push({
      match_id: `wc2026-r32-${matchNumber}`,
      home_team,
      away_team,
      slot_info: {
        home_source,
        away_source,
      },
    })
  }

  return matches
}

// ============================================================================
// FIFA Best-Third Ranking
// ============================================================================

/**
 * Ranks all 12 third-place teams and returns the top 8
 *
 * This is a convenience wrapper around the generic rankBestThirds function
 * that applies FIFA-specific tiebreakers.
 *
 * @param allThirds - All 12 third-place teams from groups
 * @returns Top 8 third-place teams, ranked 1-8
 */
export function rankFIFABestThirds(allThirds: TeamWithStats[]): TeamWithStats[] {
  return rankBestThirds(allThirds, FIFA_TIEBREAKERS)
}

// ============================================================================
// Helper: Extract Qualified Teams from Group Results
// ============================================================================

/**
 * Extracts all qualified teams from group stage results
 *
 * @param groupResults - All 12 group standings
 * @returns Array of 32 qualified teams with source metadata
 */
export function extractQualifiedTeamsFromGroups(
  groupResults: Record<string, TeamWithStats[]>
): QualifiedTeam[] {
  const qualified: QualifiedTeam[] = []

  Object.entries(groupResults).forEach(([groupId, standings]) => {
    standings.forEach((team) => {
      if (team.position === 1) {
        qualified.push({
          name: team.name,
          source: {
            type: 'group_winner',
            groupId,
            position: 1,
          },
          stats: team,
        })
      } else if (team.position === 2) {
        qualified.push({
          name: team.name,
          source: {
            type: 'group_runner_up',
            groupId,
            position: 2,
          },
          stats: team,
        })
      } else if (team.position === 3) {
        // Will be filtered to best 8 later
        qualified.push({
          name: team.name,
          source: {
            type: 'best_third',
            groupId,
            position: 3,
          },
          stats: team,
        })
      }
    })
  })

  return qualified
}
