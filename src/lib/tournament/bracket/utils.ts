/**
 * Generic bracket utilities
 *
 * Shared functions for bracket generation, qualification, and ranking.
 */

import { TeamWithStats, TiebreakerRule, MatchPrediction } from './types'

// ============================================================================
// Best-Third Ranking
// ============================================================================

/**
 * Ranks third-place teams using FIFA tiebreaker hierarchy
 *
 * Applies steps 1-5 + random fallback:
 * 1. Points (already sorted in group standings)
 * 2. Goal difference
 * 3. Goals scored
 * 4. Fair play score (Phase 2 - skipped in Phase 1)
 * 5. FIFA ranking (Phase 2 - skipped in Phase 1)
 * 6. Random (fallback)
 *
 * NOTE: Steps 1-3 for head-to-head only apply when comparing teams
 * that actually played each other. Since third-place teams come from
 * different groups, they never met, so we skip directly to overall stats.
 *
 * @param allThirds - All 12 third-place teams from groups
 * @param tiebreakers - Tiebreaker rules to apply (defaults to FIFA rules)
 * @returns Top 8 third-place teams, ranked 1-8
 */
export function rankBestThirds(
  allThirds: TeamWithStats[],
  tiebreakers?: TiebreakerRule[]
): TeamWithStats[] {
  if (allThirds.length !== 12) {
    throw new Error(`Expected 12 third-place teams, got ${allThirds.length}`)
  }

  // Phase 1: Apply steps 4-5 (overall stats) + random
  // Head-to-head (steps 1-3) doesn't apply since thirds are from different groups

  let ranked = [...allThirds]

  // Step 4: Overall points (primary sort)
  ranked.sort((a, b) => {
    // Points (descending)
    if (b.points !== a.points) return b.points - a.points

    // Step 5: Overall goal difference (descending)
    const aGd = a.gd ?? 0
    const bGd = b.gd ?? 0
    if (bGd !== aGd) return bGd - aGd

    // Step 6: Overall goals scored (descending)
    const aGs = a.gs ?? 0
    const bGs = b.gs ?? 0
    if (bGs !== aGs) return bGs - aGs

    // Step 7: Fair play score (Phase 2 - not implemented yet)
    // Step 8: FIFA ranking (Phase 2 - not implemented yet)

    // Step 9: Random fallback
    // Use stable sort by team name for deterministic ordering in tests
    // In production, this would use crypto.randomBytes() for true randomness
    return a.name.localeCompare(b.name)
  })

  // Return top 8
  return ranked.slice(0, 8).map((team, index) => ({
    ...team,
    position: index + 1, // Rank 1-8
  }))
}

// ============================================================================
// Tiebreaker Application (for future head-to-head support)
// ============================================================================

/**
 * Applies a sequence of tiebreakers to a set of teams
 *
 * This is a generic tiebreaker engine that will be used in Phase 2
 * when we add head-to-head support for 3+ team ties within groups.
 *
 * @param teams - Teams to rank
 * @param tiebreakers - Ordered list of tiebreaker rules
 * @param matches - Match predictions (needed for head-to-head calculation)
 * @returns Teams sorted by tiebreaker hierarchy
 */
export function applyTiebreakers(
  teams: TeamWithStats[],
  tiebreakers: TiebreakerRule[],
  matches?: MatchPrediction[]
): TeamWithStats[] {
  // Phase 2: Implement full tiebreaker logic
  // For now, just sort by overall stats
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const aGd = a.gd ?? 0
    const bGd = b.gd ?? 0
    if (bGd !== aGd) return bGd - aGd
    const aGs = a.gs ?? 0
    const bGs = b.gs ?? 0
    if (bGs !== aGs) return bGs - aGs
    return a.name.localeCompare(b.name)
  })
}

// ============================================================================
// Head-to-Head Calculation (Phase 2)
// ============================================================================

/**
 * Calculates head-to-head standings for a subset of teams
 *
 * Used when 3+ teams are tied and need to be separated.
 * Only considers matches between the tied teams.
 *
 * Phase 2 implementation.
 *
 * @param teams - Tied teams to compare
 * @param matches - All match predictions
 * @returns Teams with recalculated stats based on h2h matches only
 */
export function calculateHeadToHead(
  teams: TeamWithStats[],
  matches: MatchPrediction[]
): TeamWithStats[] {
  // Phase 2: Filter matches to only include those between tied teams
  // Recalculate points, GD, GS for h2h mini-league
  return teams
}
