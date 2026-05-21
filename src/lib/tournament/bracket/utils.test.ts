/**
 * Tests for rankBestThirds function
 *
 * Run with: npx tsx src/lib/tournament/bracket/utils.test.ts
 */

import { rankBestThirds } from './utils'
import { TeamWithStats } from './types'

// ============================================================================
// Test Helpers
// ============================================================================

function createTeam(
  name: string,
  points: number,
  gd: number,
  gs: number
): TeamWithStats {
  return {
    name,
    points,
    gd,
    gs,
    gc: gs - gd, // Calculated
    wins: Math.floor(points / 3),
    draws: points % 3,
    losses: 0,
    groupId: name.split(' ')[0], // Extract group letter
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr !== expectedStr) {
    console.error(`❌ FAIL: ${message}`)
    console.error(`  Expected: ${expectedStr}`)
    console.error(`  Actual:   ${actualStr}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

function assertThrows(fn: () => void, message: string) {
  try {
    fn()
    console.error(`❌ FAIL: ${message} (expected error but none thrown)`)
    process.exit(1)
  } catch (err) {
    console.log(`✅ PASS: ${message}`)
  }
}

// ============================================================================
// Test Cases
// ============================================================================

console.log('\n🧪 Testing rankBestThirds function\n')

// Test 1: Validates input has exactly 12 teams
console.log('Test Suite 1: Input Validation')
assertThrows(
  () => rankBestThirds([]),
  'Rejects empty array'
)
assertThrows(
  () => rankBestThirds([createTeam('A Third', 3, 0, 1)]),
  'Rejects array with < 12 teams'
)
assertThrows(
  () => rankBestThirds(Array(13).fill(createTeam('A Third', 3, 0, 1))),
  'Rejects array with > 12 teams'
)

// Test 2: Returns exactly 8 teams
console.log('\nTest Suite 2: Output Size')
const allSameStats = Array(12).fill(null).map((_, i) =>
  createTeam(`${String.fromCharCode(65 + i)} Third`, 3, 0, 1)
)
const result = rankBestThirds(allSameStats)
assertEqual(result.length, 8, 'Returns exactly 8 teams')

// Test 3: Ranks by points (descending)
console.log('\nTest Suite 3: Ranking by Points')
const byPoints = [
  createTeam('A Third', 6, 3, 5),
  createTeam('B Third', 5, 2, 4),
  createTeam('C Third', 4, 1, 3),
  createTeam('D Third', 4, 0, 2),
  createTeam('E Third', 3, 0, 1),
  createTeam('F Third', 3, -1, 1),
  createTeam('G Third', 3, -2, 0),
  createTeam('H Third', 2, -1, 1),
  createTeam('I Third', 2, -2, 0),
  createTeam('J Third', 1, -3, 0),
  createTeam('K Third', 1, -4, 0),
  createTeam('L Third', 0, -5, 0),
]
const rankedByPoints = rankBestThirds(byPoints)
assertEqual(
  rankedByPoints.map(t => t.name),
  ['A Third', 'B Third', 'C Third', 'D Third', 'E Third', 'F Third', 'G Third', 'H Third'],
  'Selects top 8 by points'
)
assertEqual(rankedByPoints[0].points, 6, 'Top team has highest points')
assertEqual(rankedByPoints[7].points, 2, '8th team has 2 points')

// Test 4: Breaks ties with goal difference
console.log('\nTest Suite 4: Tiebreaker - Goal Difference')
const byGD = [
  createTeam('A Third', 3, 5, 7),   // Same points, best GD
  createTeam('B Third', 3, 3, 5),
  createTeam('C Third', 3, 2, 4),
  createTeam('D Third', 3, 1, 3),
  createTeam('E Third', 3, 0, 2),
  createTeam('F Third', 3, -1, 1),
  createTeam('G Third', 3, -2, 0),
  createTeam('H Third', 3, -3, 0),
  createTeam('I Third', 3, -4, 0),  // Same points, worst GD (not in top 8)
  createTeam('J Third', 3, -5, 0),
  createTeam('K Third', 3, -6, 0),
  createTeam('L Third', 3, -7, 0),
]
const rankedByGD = rankBestThirds(byGD)
assertEqual(rankedByGD[0].name, 'A Third', 'Team with best GD ranks 1st')
assertEqual(rankedByGD[0].gd, 5, 'Top team has GD of 5')
assertEqual(rankedByGD[7].name, 'H Third', '8th team has GD of -3')
assertEqual(rankedByGD[7].gd, -3, '8th team GD is -3')

// Test 5: Breaks ties with goals scored
console.log('\nTest Suite 5: Tiebreaker - Goals Scored')
const byGS = [
  createTeam('A Third', 3, 0, 5),   // Same points & GD, most GS
  createTeam('B Third', 3, 0, 4),
  createTeam('C Third', 3, 0, 3),
  createTeam('D Third', 3, 0, 3),   // Tied on GS with C
  createTeam('E Third', 3, 0, 2),
  createTeam('F Third', 3, 0, 2),
  createTeam('G Third', 3, 0, 1),
  createTeam('H Third', 3, 0, 1),
  createTeam('I Third', 3, 0, 1),   // Not in top 8
  createTeam('J Third', 3, 0, 0),
  createTeam('K Third', 3, 0, 0),
  createTeam('L Third', 3, 0, 0),
]
const rankedByGS = rankBestThirds(byGS)
assertEqual(rankedByGS[0].name, 'A Third', 'Team with most GS ranks 1st')
assertEqual(rankedByGS[0].gs, 5, 'Top team has 5 goals scored')
// Teams tied on points, GD, and GS will be sorted alphabetically (deterministic fallback)
assertEqual(rankedByGS[2].name, 'C Third', 'C Third ranks before D Third (alphabetical)')
assertEqual(rankedByGS[3].name, 'D Third', 'D Third ranks after C Third (alphabetical)')

// Test 6: Complex scenario with multiple tiebreaker levels
console.log('\nTest Suite 6: Complex Multi-Level Tiebreakers')
const complex = [
  createTeam('A Third', 6, 4, 7),   // Clear winner (most points)
  createTeam('B Third', 6, 2, 5),   // Same points as A, lower GD
  createTeam('C Third', 4, 3, 6),   // 4 pts, best GD in this tier
  createTeam('D Third', 4, 3, 5),   // 4 pts, same GD as C, fewer GS
  createTeam('E Third', 4, 2, 5),   // 4 pts, lower GD
  createTeam('F Third', 3, 2, 4),   // 3 pts, best GD in this tier
  createTeam('G Third', 3, 2, 3),   // 3 pts, same GD as F, fewer GS
  createTeam('H Third', 3, 1, 3),   // 3 pts, lower GD
  createTeam('I Third', 3, 0, 2),   // 3 pts, even lower GD (borderline)
  createTeam('J Third', 2, 1, 3),   // 2 pts (out)
  createTeam('K Third', 1, -2, 1),  // 1 pt (out)
  createTeam('L Third', 0, -5, 0),  // 0 pts (out)
]
const rankedComplex = rankBestThirds(complex)
assertEqual(
  rankedComplex.map(t => t.name),
  ['A Third', 'B Third', 'C Third', 'D Third', 'E Third', 'F Third', 'G Third', 'H Third'],
  'Correctly ranks complex scenario'
)

// Test 7: Sets position field correctly
console.log('\nTest Suite 7: Position Field')
const withPositions = rankBestThirds(allSameStats)
assertEqual(withPositions[0].position, 1, '1st team has position=1')
assertEqual(withPositions[7].position, 8, '8th team has position=8')

// Test 8: All teams identical (random fallback via alphabetical sort)
console.log('\nTest Suite 8: Random Fallback (Alphabetical for Tests)')
const identical = [
  createTeam('L Third', 3, 0, 1),
  createTeam('K Third', 3, 0, 1),
  createTeam('J Third', 3, 0, 1),
  createTeam('I Third', 3, 0, 1),
  createTeam('H Third', 3, 0, 1),
  createTeam('G Third', 3, 0, 1),
  createTeam('F Third', 3, 0, 1),
  createTeam('E Third', 3, 0, 1),
  createTeam('D Third', 3, 0, 1),
  createTeam('C Third', 3, 0, 1),
  createTeam('B Third', 3, 0, 1),
  createTeam('A Third', 3, 0, 1),
]
const rankedIdentical = rankBestThirds(identical)
assertEqual(
  rankedIdentical.map(t => t.name),
  ['A Third', 'B Third', 'C Third', 'D Third', 'E Third', 'F Third', 'G Third', 'H Third'],
  'Falls back to alphabetical order when all stats identical'
)

// Test 9: Real-world scenario (FIFA WC 2026 example)
console.log('\nTest Suite 9: Real-World FIFA WC 2026 Scenario')
const realistic = [
  createTeam('A Third', 4, 1, 3),   // 4 pts, +1 GD
  createTeam('B Third', 4, 0, 2),   // 4 pts, 0 GD
  createTeam('C Third', 4, -1, 2),  // 4 pts, -1 GD
  createTeam('D Third', 3, 2, 4),   // 3 pts, +2 GD (best in 3-pt tier)
  createTeam('E Third', 3, 1, 3),   // 3 pts, +1 GD
  createTeam('F Third', 3, 0, 2),   // 3 pts, 0 GD
  createTeam('G Third', 3, 0, 1),   // 3 pts, 0 GD, fewer GS
  createTeam('H Third', 3, -1, 1),  // 3 pts, -1 GD
  createTeam('I Third', 3, -2, 0),  // 3 pts, -2 GD (out)
  createTeam('J Third', 2, 0, 2),   // 2 pts (out)
  createTeam('K Third', 1, -3, 1),  // 1 pt (out)
  createTeam('L Third', 1, -4, 0),  // 1 pt (out)
]
const rankedRealistic = rankBestThirds(realistic)
assertEqual(
  rankedRealistic.map(t => t.name),
  ['A Third', 'B Third', 'C Third', 'D Third', 'E Third', 'F Third', 'G Third', 'H Third'],
  'Correctly ranks realistic FIFA scenario'
)
// Verify the bubble teams
assertEqual(rankedRealistic[7].points, 3, '8th place has 3 points')
assertEqual(rankedRealistic[7].gd, -1, '8th place has -1 GD')

console.log('\n✅ All tests passed!\n')
