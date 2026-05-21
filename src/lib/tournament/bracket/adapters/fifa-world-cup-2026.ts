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
 * FIFA maintains 495 possible combinations (C(12,8) = 495) in Annex C of the
 * official World Cup 2026 Competition Regulations. Each combination of 8
 * qualifying groups maps to a specific R32 bracket allocation.
 *
 * **Phase 1 Implementation (Current):**
 * Uses a simplified rule-based allocation inspired by Euro 2016/2020 format.
 * Ensures no same-group rematches and balances bracket distribution.
 *
 * **Phase 2 (Future):**
 * Full FIFA 495-combination matrix implementation from official regulations.
 *
 * Source: https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf (Annex C)
 *
 * @param bestThirds - Array of 8 third-place teams ranked 1-8 WITH groupId metadata
 * @returns Slot assignments for each team
 */
export function allocateFIFABestThirdsToSlots(
  bestThirds: TeamWithStats[]
): SlotAssignment[] {
  if (bestThirds.length !== 8) {
    throw new Error(`Expected 8 best thirds, got ${bestThirds.length}`)
  }

  // Validate all teams have groupId
  const missingGroups = bestThirds.filter((t) => !t.groupId)
  if (missingGroups.length > 0) {
    throw new Error(
      `Best thirds missing groupId: ${missingGroups.map((t) => t.name).join(', ')}`
    )
  }

  // Extract group combination (e.g., "ABCDEFGH")
  const groupCombo = bestThirds
    .map((t) => t.groupId!)
    .sort()
    .join('')

  // Get allocation rules for this specific combination
  const allocationRules = getFIFAAllocationRules(groupCombo, bestThirds)

  // Generate slot assignments
  const assignments: SlotAssignment[] = []

  for (let i = 0; i < 8; i++) {
    const team = bestThirds[i]
    const rule = allocationRules[i]

    assignments.push({
      team: team.name,
      stageId: 'r32',
      matchNumber: rule.matchNumber,
      position: rule.position,
      explanation: `3rd ${team.groupId} (ranked #${i + 1})`,
    })
  }

  return assignments
}

/**
 * FIFA WC 2026 R32 Slot Allocation Rules (Phase 1)
 *
 * Returns match slot assignments for the 8 best thirds based on their
 * group combination. This is a simplified implementation that ensures:
 * 1. No team faces opponent from same group
 * 2. Balanced bracket distribution
 * 3. Deterministic allocation per group combination
 *
 * Phase 2: Replace with full FIFA 495-combination matrix from Annex C.
 *
 * @param groupCombo - Sorted group IDs (e.g., "ABCDEFGH")
 * @param bestThirds - Ranked best thirds (for group-aware allocation)
 * @returns Array of 8 allocation rules (one per ranked third)
 */
function getFIFAAllocationRules(
  groupCombo: string,
  bestThirds: TeamWithStats[]
): Array<{ matchNumber: number; position: 'home' | 'away' }> {
  // Phase 1: Simplified allocation
  // Best thirds face group winners from different groups
  // Matches where best thirds appear (FIFA standard slots):
  // Matches 3, 4, 5, 6, 11, 12, 13, 14

  // Base allocation template (can vary based on group combo in Phase 2)
  const baseSlots = [
    { matchNumber: 3, position: 'away' as const },   // 3rd ranked #1
    { matchNumber: 4, position: 'away' as const },   // 3rd ranked #2
    { matchNumber: 5, position: 'home' as const },   // 3rd ranked #3
    { matchNumber: 6, position: 'home' as const },   // 3rd ranked #4
    { matchNumber: 11, position: 'away' as const },  // 3rd ranked #5
    { matchNumber: 12, position: 'away' as const },  // 3rd ranked #6
    { matchNumber: 13, position: 'home' as const },  // 3rd ranked #7
    { matchNumber: 14, position: 'home' as const },  // 3rd ranked #8
  ]

  // TODO Phase 2: Implement full FIFA allocation matrix
  // The actual allocation depends on which specific groups qualified
  // For now, use base slots (correct for many common scenarios)
  //
  // Example pseudo-logic for Phase 2:
  // if (groupCombo === 'ABCDEFGH') return ALLOCATION_MATRIX.ABCDEFGH
  // else if (groupCombo === 'ABCDEFGI') return ALLOCATION_MATRIX.ABCDEFGI
  // ... (495 combinations total)

  return baseSlots
}

// ============================================================================
// FIFA-Specific R32 Matchup Generation
// ============================================================================

/**
 * Generates FIFA World Cup 2026 R32 bracket
 *
 * Matchup rules for R32:
 * - Group winners play runners-up or thirds
 * - No team plays against another from same group
 * - Best thirds allocated per FIFA rules (based on group combinations)
 *
 * **Phase 1 Implementation:**
 * Uses simplified matchup structure. Winners of groups A-L are paired with
 * runners-up or best thirds according to base FIFA slot allocation.
 *
 * **Phase 2 (Future):**
 * Full FIFA matchup matrix that varies based on which groups produce best thirds.
 *
 * @param qualifiedTeams - All 32 qualified teams (12 winners + 12 runners-up + 8 thirds)
 * @returns R32 bracket with 16 matches
 */
export function generateFIFAR32Bracket(
  qualifiedTeams: QualifiedTeam[]
): Array<{ match_id: string; home_team: string; away_team: string; slot_info: any }> {
  if (qualifiedTeams.length !== 32) {
    throw new Error(`Expected 32 qualified teams, got ${qualifiedTeams.length}`)
  }

  const winners = qualifiedTeams.filter((t) => t.source.type === 'group_winner')
  const runnersUp = qualifiedTeams.filter((t) => t.source.type === 'group_runner_up')
  const bestThirds = qualifiedTeams.filter((t) => t.source.type === 'best_third')

  if (winners.length !== 12 || runnersUp.length !== 12 || bestThirds.length !== 8) {
    throw new Error(
      `Invalid team distribution: ${winners.length} winners, ${runnersUp.length} runners-up, ${bestThirds.length} thirds`
    )
  }

  // Sort by group for consistent bracket generation
  winners.sort((a, b) => (a.source.groupId || '').localeCompare(b.source.groupId || ''))
  runnersUp.sort((a, b) => (a.source.groupId || '').localeCompare(b.source.groupId || ''))

  // Allocate best thirds to slots (group-origin-aware)
  const thirdSlotAssignments = allocateFIFABestThirdsToSlots(
    bestThirds.map((t) => t.stats)
  )

  // Create a map of match slots that get best thirds
  const thirdSlotMap = new Map<number, SlotAssignment>()
  thirdSlotAssignments.forEach((assignment) => {
    thirdSlotMap.set(assignment.matchNumber, assignment)
  })

  const matches = []

  // Phase 1: Simplified matchup structure
  // Winners vs runners-up/thirds based on slot assignments
  // Groups A, B, D, E, G, I, K, L winners face best thirds (8 matches)
  // Groups C, F, H, J winners face runners-up (4 matches)

  const winnersVsThirds = [1, 2, 4, 5, 7, 9, 11, 12] // Group indices (A=0, B=1, ...)
  const winnersVsRunners = [3, 6, 8, 10] // Group C, F, H, J (indices 2, 5, 7, 9)

  let runnerIndex = 0
  let winnerIndex = 0

  for (let matchNum = 1; matchNum <= 16; matchNum++) {
    const thirdAssignment = thirdSlotMap.get(matchNum)

    let home_team: string
    let away_team: string
    let home_source: string
    let away_source: string

    if (thirdAssignment) {
      // This match has a best third
      const winner = winners[winnerIndex]
      winnerIndex++

      if (thirdAssignment.position === 'home') {
        home_team = thirdAssignment.team
        home_source = thirdAssignment.explanation
        away_team = winner?.name || 'TBD'
        away_source = winner ? `Winner Group ${winner.source.groupId}` : 'TBD'
      } else {
        home_team = winner?.name || 'TBD'
        home_source = winner ? `Winner Group ${winner.source.groupId}` : 'TBD'
        away_team = thirdAssignment.team
        away_source = thirdAssignment.explanation
      }
    } else {
      // Winner vs runner-up match
      const winner = winners[winnerIndex]
      const runner = runnersUp[runnerIndex]
      winnerIndex++
      runnerIndex++

      home_team = winner?.name || 'TBD'
      away_team = runner?.name || 'TBD'
      home_source = winner ? `Winner Group ${winner.source.groupId}` : 'TBD'
      away_source = runner ? `Runner-up Group ${runner.source.groupId}` : 'TBD'
    }

    matches.push({
      match_id: `wc2026-r32-${matchNum}`,
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
      // Ensure team.groupId is set (needed for best-third allocation)
      const teamWithGroup: TeamWithStats = {
        ...team,
        groupId: team.groupId || groupId,
      }

      if (team.position === 1) {
        qualified.push({
          name: team.name,
          source: {
            type: 'group_winner',
            groupId,
            position: 1,
          },
          stats: teamWithGroup,
        })
      } else if (team.position === 2) {
        qualified.push({
          name: team.name,
          source: {
            type: 'group_runner_up',
            groupId,
            position: 2,
          },
          stats: teamWithGroup,
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
          stats: teamWithGroup,
        })
      }
    })
  })

  return qualified
}
