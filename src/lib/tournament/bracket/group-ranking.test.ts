/**
 * Tests for resolveGroupRanking / groupDataToRankings
 *
 * Run with: npx tsx src/lib/tournament/bracket/group-ranking.test.ts
 */

import { resolveGroupRanking, groupDataToRankings } from './group-ranking'
import type { GroupData } from '@/components/tournament/bracket/GroupResultsStepV2'
import type { MatchResult } from '@/components/tournament/bracket/MatchCard'

// ============================================================================
// Test Helpers
// ============================================================================

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`❌ FAIL: ${message}`)
    console.error(`  Expected: ${e}`)
    console.error(`  Actual:   ${a}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

/**
 * Build a 4-team round-robin group. `results` maps "Home vs Away" pairs to a
 * W/D/L result; `scores` optionally attaches an exact score (tiebreaker data).
 */
function buildGroup(
  groupId: string,
  teams: [string, string, string, string],
  results: Record<string, MatchResult>,
  scores: Record<string, [number, number]> = {},
): GroupData {
  const matches: GroupData['matches'] = []
  let n = 0
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      n++
      const key = `${teams[i]} vs ${teams[j]}`
      matches.push({
        match_id: `${groupId}-m${n}`,
        home_team: teams[i],
        away_team: teams[j],
        result: results[key] ?? null,
        exact_score: scores[key]
          ? { home_score: scores[key][0], away_score: scores[key][1] }
          : undefined,
      })
    }
  }
  return {
    group_id: groupId,
    group_name: `Group ${groupId}`,
    teams,
    matches,
    has_tiebreaker_scores: Object.keys(scores).length > 0,
  }
}

console.log('\n🧪 Testing resolveGroupRanking\n')

// ----------------------------------------------------------------------------
// Test 1: Clean group — every team on different points, no tie
// ----------------------------------------------------------------------------
console.log('Test Suite 1: Decisive group, no tiebreaker')
// A beats everyone, B beats C & D, C beats D, D loses all.
// Pairs (round-robin order): A-B, A-C, A-D, B-C, B-D, C-D
const cleanGroup = buildGroup('A', ['Alpha', 'Bravo', 'Charlie', 'Delta'], {
  'Alpha vs Bravo': 'home_win',
  'Alpha vs Charlie': 'home_win',
  'Alpha vs Delta': 'home_win',
  'Bravo vs Charlie': 'home_win',
  'Bravo vs Delta': 'home_win',
  'Charlie vs Delta': 'home_win',
})
assertEqual(
  resolveGroupRanking(cleanGroup),
  ['Alpha', 'Bravo', 'Charlie', 'Delta'],
  'Ranks 9/6/3/0-point teams in order, no scores needed',
)

// ----------------------------------------------------------------------------
// Test 2: Two teams level on points — broken by head-to-head result
// ----------------------------------------------------------------------------
console.log('\nTest Suite 2: Points tie broken by head-to-head')
// Alpha & Bravo both beat Charlie & Delta (6 pts each). Their head-to-head:
// Bravo beat Alpha. FIFA: H2H points first → Bravo ranks above Alpha,
// even though we give Alpha a bigger overall goal difference.
const h2hGroup = buildGroup(
  'B',
  ['Alpha', 'Bravo', 'Charlie', 'Delta'],
  {
    'Alpha vs Bravo': 'away_win', // Bravo beats Alpha (head-to-head)
    'Alpha vs Charlie': 'home_win',
    'Alpha vs Delta': 'home_win',
    'Bravo vs Charlie': 'home_win',
    'Bravo vs Delta': 'home_win',
    'Charlie vs Delta': 'home_win',
  },
  {
    // Tiebreaker scores: Alpha racks up goals overall, but lost the H2H.
    'Alpha vs Bravo': [1, 2],
    'Alpha vs Charlie': [5, 0],
    'Alpha vs Delta': [5, 0],
    'Bravo vs Charlie': [1, 0],
    'Bravo vs Delta': [1, 0],
    'Charlie vs Delta': [1, 0],
  },
)
assertEqual(
  resolveGroupRanking(h2hGroup).slice(0, 2),
  ['Bravo', 'Alpha'],
  'Head-to-head winner ranks 1st despite worse overall GD',
)

// ----------------------------------------------------------------------------
// Test 3: Points + H2H level — broken by overall goal difference
// ----------------------------------------------------------------------------
console.log('\nTest Suite 3: Tie broken by overall goal difference')
// Alpha & Bravo level on points; their H2H is a draw with equal score,
// so H2H points/GD/GS cannot separate them. Overall GD decides:
// Alpha beat its other opponents by more goals.
const gdGroup = buildGroup(
  'C',
  ['Alpha', 'Bravo', 'Charlie', 'Delta'],
  {
    'Alpha vs Bravo': 'draw',
    'Alpha vs Charlie': 'home_win',
    'Alpha vs Delta': 'home_win',
    'Bravo vs Charlie': 'home_win',
    'Bravo vs Delta': 'home_win',
    'Charlie vs Delta': 'home_win',
  },
  {
    'Alpha vs Bravo': [1, 1],
    'Alpha vs Charlie': [4, 0], // Alpha: big wins
    'Alpha vs Delta': [4, 0],
    'Bravo vs Charlie': [1, 0], // Bravo: narrow wins
    'Bravo vs Delta': [1, 0],
    'Charlie vs Delta': [1, 0],
  },
)
assertEqual(
  resolveGroupRanking(gdGroup).slice(0, 2),
  ['Alpha', 'Bravo'],
  'Overall goal difference breaks the tie when H2H is level',
)

// ----------------------------------------------------------------------------
// Test 4: Incomplete group yields empty ranking
// ----------------------------------------------------------------------------
console.log('\nTest Suite 4: Incomplete group')
const partial = buildGroup('D', ['Alpha', 'Bravo', 'Charlie', 'Delta'], {
  'Alpha vs Bravo': 'home_win',
  // remaining matches unpredicted
})
assertEqual(
  resolveGroupRanking(partial),
  [],
  'Returns empty array when not all matches are predicted',
)

// ----------------------------------------------------------------------------
// Test 5: groupDataToRankings omits incomplete groups
// ----------------------------------------------------------------------------
console.log('\nTest Suite 5: groupDataToRankings record')
const rankings = groupDataToRankings([cleanGroup, partial])
assertEqual(
  Object.keys(rankings).sort(),
  ['A'],
  'Complete group included, incomplete group omitted',
)
assertEqual(
  rankings['A'],
  ['Alpha', 'Bravo', 'Charlie', 'Delta'],
  'Included group carries its resolved ranking',
)

console.log('\n✅ All tests passed!\n')
