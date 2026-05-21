/**
 * Format Converter - V2 ↔ Legacy Bracket Data
 *
 * Converts between the new W/D/L format (V2) and legacy ranking format
 * for backward compatibility with existing API and database schemas.
 */

import type { GroupData, MatchPrediction as V2MatchPrediction } from '@/components/tournament/bracket/GroupResultsStepV2'

// Legacy format types (what the API expects)
export interface LegacyMatchPrediction {
  match_id: string
  home_team: string
  away_team: string
  outcome: 'home' | 'draw' | 'away'
  home_score?: number | null
  away_score?: number | null
}

export interface LegacyGroupData {
  group_id: string
  team_names: string[]
  match_predictions: LegacyMatchPrediction[]
  standings?: Array<{
    name: string
    points: number
    position: number
    gd?: number
    gs?: number
  }>
}

/**
 * Convert V2 format to legacy format for API submission
 */
export function convertV2ToLegacy(groups: GroupData[]): LegacyGroupData[] {
  return groups.map(group => ({
    group_id: group.group_id,
    team_names: group.teams,
    match_predictions: group.matches.map(match => ({
      match_id: match.match_id,
      home_team: match.home_team,
      away_team: match.away_team,
      outcome: resultToOutcome(match.result),
      home_score: match.exact_score?.home_score,
      away_score: match.exact_score?.away_score,
    })),
    standings: undefined, // Will be calculated by API if needed
  }))
}

/**
 * Convert legacy format to V2 format for loading existing data
 */
export function convertLegacyToV2(groups: LegacyGroupData[]): GroupData[] {
  return groups.map(group => ({
    group_id: group.group_id,
    group_name: `Group ${group.group_id}`,
    teams: group.team_names,
    matches: group.match_predictions.map(match => ({
      match_id: match.match_id,
      home_team: match.home_team,
      away_team: match.away_team,
      result: outcomeToResult(match.outcome),
      exact_score: match.home_score !== undefined && match.home_score !== null &&
                   match.away_score !== undefined && match.away_score !== null
        ? { home_score: match.home_score, away_score: match.away_score }
        : undefined,
    })),
    has_tiebreaker_scores: group.match_predictions.some(m =>
      m.home_score !== undefined && m.home_score !== null
    ),
  }))
}

/**
 * Convert V2 result format to legacy outcome format
 */
function resultToOutcome(result: string | null | undefined): 'home' | 'draw' | 'away' {
  if (result === 'home_win' || result === 'home') return 'home'
  if (result === 'away_win' || result === 'away') return 'away'
  if (result === 'draw') return 'draw'
  return 'home' // Default fallback
}

/**
 * Convert legacy outcome format to V2 result format
 */
function outcomeToResult(outcome: 'home' | 'draw' | 'away'): 'home_win' | 'draw' | 'away_win' | null {
  if (outcome === 'home') return 'home_win'
  if (outcome === 'away') return 'away_win'
  if (outcome === 'draw') return 'draw'
  return null
}

/**
 * Detect if data is in V2 format
 */
export function isV2Format(data: any): boolean {
  if (!data || !Array.isArray(data)) return false
  if (data.length === 0) return false

  const firstGroup = data[0]
  return (
    firstGroup.matches !== undefined ||
    firstGroup.teams !== undefined ||
    (firstGroup.match_predictions?.[0]?.result !== undefined)
  )
}

/**
 * Auto-detect format and convert to V2
 */
export function ensureV2Format(groups: any[]): GroupData[] {
  if (isV2Format(groups)) {
    return groups as GroupData[]
  }
  return convertLegacyToV2(groups as LegacyGroupData[])
}

/**
 * Auto-detect format and convert to Legacy
 */
export function ensureLegacyFormat(groups: any[]): LegacyGroupData[] {
  if (isV2Format(groups)) {
    return convertV2ToLegacy(groups as GroupData[])
  }
  return groups as LegacyGroupData[]
}
