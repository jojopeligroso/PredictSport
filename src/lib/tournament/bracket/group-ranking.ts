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
import type { MatchPrediction } from './types'
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
 * Resolve a single group to its finish order (1st → 4th).
 *
 * @returns Team names in finishing position. Empty array if the group has
 *   unpredicted matches — a complete prediction is the caller's precondition
 *   (the wizard blocks submit until every match has a result).
 */
export function resolveGroupRanking(group: GroupData): string[] {
  const allPredicted = group.matches.every((m) => m.result !== null)
  if (!allPredicted) {
    return []
  }

  const predictions = group.matches.map(toScoredPrediction)
  const standings = calculateGroupStandings(
    predictions,
    FIFA_TIEBREAKERS,
    group.teams,
  )

  return standings.map((team) => team.name)
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
