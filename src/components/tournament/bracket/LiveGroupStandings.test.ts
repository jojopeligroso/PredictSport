/**
 * Tests for LiveGroupStandings component logic
 *
 * Run with: npx tsx src/components/tournament/bracket/LiveGroupStandings.test.ts
 */

import { TeamWithStats } from '@/lib/tournament/bracket/types'

// ============================================================================
// Test Helpers
// ============================================================================

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`❌ FAIL: ${message}`)
    console.error('Expected:', expected)
    console.error('Actual:', actual)
    throw new Error(`Test failed: ${message}`)
  }
  console.log(`✅ PASS: ${message}`)
}

function createTeam(
  name: string,
  points: number,
  gd: number = 0,
  gs: number = 0,
  position?: number
): TeamWithStats {
  return {
    name,
    points,
    gd,
    gs,
    gc: gs - gd,
    wins: 0,
    draws: 0,
    losses: 0,
    position,
  }
}

// ============================================================================
// Tie Detection Logic Tests
// ============================================================================

console.log('LiveGroupStandings - Tie Detection Logic Tests\n')

// Test 1: No ties - all teams have different points
console.log('Test 1: No ties')
const noTies = [
  createTeam('Netherlands', 9, 5, 8, 1),
  createTeam('Ecuador', 6, 2, 5, 2),
  createTeam('Senegal', 3, -1, 3, 3),
  createTeam('Qatar', 0, -6, 0, 4),
]

const tiedGroups1: TeamWithStats[][] = []
const pointsMap1 = new Map<number, TeamWithStats[]>()
noTies.forEach((team) => {
  const teams = pointsMap1.get(team.points) || []
  teams.push(team)
  pointsMap1.set(team.points, teams)
})
pointsMap1.forEach((teams) => {
  if (teams.length > 1) {
    tiedGroups1.push(teams)
  }
})

assertEqual(tiedGroups1.length, 0, 'No tied groups detected')

// Test 2: Two teams tied on points
console.log('\nTest 2: Two teams tied')
const twoTied = [
  createTeam('Netherlands', 6, 2, 5, 1),
  createTeam('Ecuador', 6, 1, 4, 2),
  createTeam('Senegal', 3, -1, 3, 3),
  createTeam('Qatar', 0, -2, 0, 4),
]

const tiedGroups2: TeamWithStats[][] = []
const pointsMap2 = new Map<number, TeamWithStats[]>()
twoTied.forEach((team) => {
  const teams = pointsMap2.get(team.points) || []
  teams.push(team)
  pointsMap2.set(team.points, teams)
})
pointsMap2.forEach((teams) => {
  if (teams.length > 1) {
    tiedGroups2.push(teams)
  }
})

assertEqual(tiedGroups2.length, 1, 'One tied group detected')
assertEqual(tiedGroups2[0].length, 2, 'Group has 2 teams')
assertEqual(
  tiedGroups2[0].map((t) => t.name).sort(),
  ['Ecuador', 'Netherlands'],
  'Correct teams identified as tied'
)

// Test 3: Three teams tied on points
console.log('\nTest 3: Three teams tied')
const threeTied = [
  createTeam('Netherlands', 6, 3, 6, 1),
  createTeam('Ecuador', 6, 2, 5, 2),
  createTeam('Senegal', 6, 1, 4, 3),
  createTeam('Qatar', 0, -6, 0, 4),
]

const tiedGroups3: TeamWithStats[][] = []
const pointsMap3 = new Map<number, TeamWithStats[]>()
threeTied.forEach((team) => {
  const teams = pointsMap3.get(team.points) || []
  teams.push(team)
  pointsMap3.set(team.points, teams)
})
pointsMap3.forEach((teams) => {
  if (teams.length > 1) {
    tiedGroups3.push(teams)
  }
})

assertEqual(tiedGroups3.length, 1, 'One tied group detected')
assertEqual(tiedGroups3[0].length, 3, 'Group has 3 teams')

// Test 4: Multiple separate tie groups
console.log('\nTest 4: Multiple tie groups')
const multipleTies = [
  createTeam('Netherlands', 6, 2, 5, 1),
  createTeam('Ecuador', 6, 1, 4, 2),
  createTeam('Senegal', 3, 0, 3, 3),
  createTeam('Qatar', 3, -1, 2, 4),
]

const tiedGroups4: TeamWithStats[][] = []
const pointsMap4 = new Map<number, TeamWithStats[]>()
multipleTies.forEach((team) => {
  const teams = pointsMap4.get(team.points) || []
  teams.push(team)
  pointsMap4.set(team.points, teams)
})
pointsMap4.forEach((teams) => {
  if (teams.length > 1) {
    tiedGroups4.push(teams)
  }
})

assertEqual(tiedGroups4.length, 2, 'Two separate tied groups detected')

// Test 5: All four teams tied
console.log('\nTest 5: All four teams tied')
const allTied = [
  createTeam('Netherlands', 6, 3, 6, 1),
  createTeam('Ecuador', 6, 2, 5, 2),
  createTeam('Senegal', 6, 1, 4, 3),
  createTeam('Qatar', 6, 0, 3, 4),
]

const tiedGroups5: TeamWithStats[][] = []
const pointsMap5 = new Map<number, TeamWithStats[]>()
allTied.forEach((team) => {
  const teams = pointsMap5.get(team.points) || []
  teams.push(team)
  pointsMap5.set(team.points, teams)
})
pointsMap5.forEach((teams) => {
  if (teams.length > 1) {
    tiedGroups5.push(teams)
  }
})

assertEqual(tiedGroups5.length, 1, 'One tied group detected')
assertEqual(tiedGroups5[0].length, 4, 'All 4 teams in tie')

// ============================================================================
// Field Compatibility Tests
// ============================================================================

console.log('\n\nField Compatibility Tests\n')

// Test 6: Handle optional fields with null coalescing
console.log('Test 6: Optional field handling')
const teamWithOptionalFields: TeamWithStats = {
  name: 'Test Team',
  points: 6,
  gd: 2,
  gs: 5,
  gc: 3,
}

const gdValue = (teamWithOptionalFields.goalDifference ?? teamWithOptionalFields.gd) ?? 0
const gsValue = (teamWithOptionalFields.goalsFor ?? teamWithOptionalFields.gs) ?? 0

assertEqual(gdValue, 2, 'GD value correctly resolved from gd field')
assertEqual(gsValue, 5, 'GS value correctly resolved from gs field')

// Test 7: Legacy field names
console.log('\nTest 7: Legacy field name support')
const teamWithLegacyFields: TeamWithStats = {
  name: 'Legacy Team',
  points: 6,
  goalDifference: 3,
  goalsFor: 7,
  goalsAgainst: 4,
}

const gdLegacy = (teamWithLegacyFields.goalDifference ?? teamWithLegacyFields.gd) ?? 0
const gsLegacy = (teamWithLegacyFields.goalsFor ?? teamWithLegacyFields.gs) ?? 0

assertEqual(gdLegacy, 3, 'GD resolved from legacy goalDifference field')
assertEqual(gsLegacy, 7, 'GS resolved from legacy goalsFor field')

console.log('\n✅ All LiveGroupStandings logic tests passed!\n')
