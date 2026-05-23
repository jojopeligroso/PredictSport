/**
 * Group-ranking adapter — W/D/L GroupData → FIFA-ranked groupRankings
 *
 * The W/D/L bracket wizard (`GroupResultsStepV2` + `TiebreakerResolutionPage`)
 * captures, per group match, a `result` (home_win / draw / away_win) and — only
 * for matches involving teams left tied on points — an `exact_score`. It never
 * resolves those into a 1st/2nd/3rd/4th finish order.
 *
 * This module is that missing step. It feeds the captured data into the real
 * FIFA tiebreaker engine (`calculateGroupStandings`) and returns the ordered
 * team list each group resolves to — the `groupRankings` shape that
 * `BracketSubmissionData`, `generateWC2026R32Matchups`, `validateWC2026Bracket`
 * and `scoreBracket` all consume.
 *
 * Tiebreaker order is FIFA-official (`FIFA_TIEBREAKERS`): head-to-head points →
 * H2H goal difference → H2H goals scored → overall GD → overall GS → fallback.
 * See docs/DESIGN-WC-H1-FULL-BRACKET.md and the World Cup 2026 rules.
 */

import { calculateGroupStandings } from './engine'
import { FIFA_TIEBREAKERS } from './tiebreakers/fifa'
import type { MatchPrediction, TeamWithStats } from './types'
import type { GroupData } from '@/components/tournament/bracket/GroupResultsStepV2'

/**
 * Convert one W/D/L match into the score-bearing shape the engine needs.
 *
 * `calculateGroupStandings` reads the flat `home_score` / `away_score` fields
 * and skips any match where they are null. The W/D/L flow only carries real
 * scores (`exact_score`) for tiebreaker matches, so for every other match we
 * synthesise a minimal score consistent with the picked result:
 *   home_win → 1-0,  draw → 0-0,  away_win → 0-1.
 *
 * This is safe for goal difference: synthesised scores only ever belong to
 * matches between teams already separated on points (FIFA collects real scores
 * for *all* matches among tied teams — see DESIGN-WC-H1-FULL-BRACKET.md Step 2),
 * so a synthesised GD is never consulted to break a contested tie.
 */
function toScoredPrediction(match: GroupData['matches'][number]): MatchPrediction {
  if (match.exact_score) {
    return {
      match_id: match.match_id,
      home_team: match.home_team,
      away_team: match.away_team,
      outcome:
        match.result === 'home_win'
          ? 'home'
          : match.result === 'away_win'
            ? 'away'
            : 'draw',
      result: match.result,
      home_score: match.exact_score.home_score,
      away_score: match.exact_score.away_score,
    }
  }

  // No real score — synthesise a minimal one from the W/D/L result.
  const [home_score, away_score] =
    match.result === 'home_win'
      ? [1, 0]
      : match.result === 'away_win'
        ? [0, 1]
        : [0, 0]

  return {
    match_id: match.match_id,
    home_team: match.home_team,
    away_team: match.away_team,
    outcome:
      match.result === 'home_win'
        ? 'home'
        : match.result === 'away_win'
          ? 'away'
          : 'draw',
    result: match.result,
    home_score,
    away_score,
  }
}

/**
 * Resolve a single group to its full finishing standings (1st → 4th) with
 * stats. Use this when you need the team's points/GD/GS — e.g., for
 * cross-group best-thirds ranking.
 *
 * @returns Full standings in finishing position. Empty array if the group has
 *   unpredicted matches.
 */
export function resolveGroupStandings(group: GroupData): TeamWithStats[] {
  const allPredicted = group.matches.every((m) => m.result !== null)
  if (!allPredicted) {
    return []
  }

  const predictions = group.matches.map(toScoredPrediction)
  return calculateGroupStandings(predictions, FIFA_TIEBREAKERS, group.teams)
}

/**
 * Resolve a single group to its finish order (1st → 4th), name-only.
 *
 * @returns Team names in finishing position. Empty array if the group has
 *   unpredicted matches — a complete prediction is the caller's precondition
 *   (the wizard blocks submit until every match has a result).
 */
export function resolveGroupRanking(group: GroupData): string[] {
  return resolveGroupStandings(group).map((team) => team.name)
}

/**
 * Adapt the wizard's `GroupData[]` into the `groupRankings` record consumed by
 * `BracketSubmissionData` and the bracket scoring engine.
 *
 * Groups that are not yet fully predicted are omitted, so a partial draft
 * yields a partial record — `validateWC2026Bracket` is what enforces "all 12
 * groups ranked" at submit time.
 */
export function groupDataToRankings(
  groups: GroupData[],
): Record<string, string[]> {
  const rankings: Record<string, string[]> = {}
  for (const group of groups) {
    const ranking = resolveGroupRanking(group)
    if (ranking.length > 0) {
      rankings[group.group_id] = ranking
    }
  }
  return rankings
}

// ---------------------------------------------------------------------------
// Tiebreaker detection helpers (shared between GroupStep and TiebreakersStep)
// ---------------------------------------------------------------------------

/**
 * Derive a simple points-only standings table from W/D/L results, using
 * synthesised 1-0/0-0/0-1 scores for goal-diff display. Only used for
 * tie detection — the ranking engine handles the authoritative order.
 */
function computePointsTable(group: GroupData): Record<string, number> {
  const pts: Record<string, number> = {}
  for (const t of group.teams) pts[t] = 0
  for (const m of group.matches) {
    if (!m.result) continue
    if (m.result === 'home_win') pts[m.home_team] = (pts[m.home_team] ?? 0) + 3
    else if (m.result === 'away_win') pts[m.away_team] = (pts[m.away_team] ?? 0) + 3
    else {
      pts[m.home_team] = (pts[m.home_team] ?? 0) + 1
      pts[m.away_team] = (pts[m.away_team] ?? 0) + 1
    }
  }
  return pts
}

/**
 * Return the names of teams that share the same points total in a group.
 * Empty array means no tie — group is unambiguously ranked by points alone.
 */
export function tiedTeamsInGroup(group: GroupData): string[] {
  const pts = computePointsTable(group)
  const tied = new Set<string>()
  const entries = Object.entries(pts).sort((a, b) => b[1] - a[1])
  for (let i = 0; i < entries.length - 1; i++) {
    if (entries[i][1] === entries[i + 1][1]) {
      tied.add(entries[i][0])
      tied.add(entries[i + 1][0])
    }
  }
  return [...tied]
}

/**
 * A group's tiebreaker is "resolved" when every match that involves at least
 * one tied team has an exact_score recorded. That gives the ranking engine
 * real goal-difference data to work with.
 */
export function groupTiebreakerResolved(group: GroupData): boolean {
  const tied = tiedTeamsInGroup(group)
  if (tied.length === 0) return true
  return group.matches
    .filter((m) => tied.includes(m.home_team) || tied.includes(m.away_team))
    .every((m) => m.exact_score !== undefined)
}

/**
 * True when every fully-predicted group has either no point ties or has had
 * its tiebreaker resolved via exact scores. This is the condition that allows
 * the wizard to advance past the Tiebreakers step.
 */
export function allTiebreakersResolved(groups: GroupData[]): boolean {
  return groups
    .filter((g) => g.matches.every((m) => m.result !== null))
    .every(groupTiebreakerResolved)
}
