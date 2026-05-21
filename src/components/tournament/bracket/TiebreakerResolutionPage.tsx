'use client'

/**
 * Tiebreaker Resolution Page
 *
 * Separate step for resolving group stage tiebreakers.
 * Users enter exact scores for all matches involving tied teams.
 *
 * Design principles:
 * - Clear messaging: Which teams are tied and why scores are needed
 * - Shows ALL matches for each tied team (3 matches per team)
 * - Pre-fills scores if already entered in group view
 * - Validates scores match previously predicted results
 * - Returns to group view after resolution
 */

import { useState } from 'react'
import type { GroupData, MatchPrediction, MatchResult } from './GroupResultsStepV2'

interface TiebreakerResolutionPageProps {
  group: GroupData
  tiedTeams: string[] // Team names that are tied
  onResolve: (updatedGroup: GroupData) => void
  onBack: () => void
}

export default function TiebreakerResolutionPage({
  group,
  tiedTeams,
  onResolve,
  onBack,
}: TiebreakerResolutionPageProps) {
  const [localGroup, setLocalGroup] = useState<GroupData>(group)

  // Get matches for each tied team
  const teamMatches = tiedTeams.map((teamName) => ({
    teamName,
    matches: localGroup.matches.filter(
      (m) => m.home_team === teamName || m.away_team === teamName
    ),
  }))

  // Check if all required scores are entered
  const allScoresEntered = teamMatches.every((tm) =>
    tm.matches.every((m) => m.exact_score !== undefined)
  )

  function handleScoreEntry(
    matchId: string,
    homeScore: number,
    awayScore: number
  ) {
    const match = localGroup.matches.find((m) => m.match_id === matchId)
    if (!match) return

    // Validate score matches result
    if (!scoreMatchesResult(match.result, homeScore, awayScore)) {
      alert("Score doesn't match your predicted result!")
      return
    }

    match.exact_score = { home_score: homeScore, away_score: awayScore }
    setLocalGroup({ ...localGroup })
  }

  function handleResolve() {
    if (!allScoresEntered) {
      alert('Please enter scores for all matches before resolving the tiebreaker')
      return
    }

    onResolve(localGroup)
  }

  return (
    <div className="mx-auto max-w-[480px] space-y-4 px-4 py-6">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm text-ps-text-sec hover:text-ps-text"
        >
          <span>←</span>
          <span>Back to Groups</span>
        </button>

        <div className="rounded-lg border-2 border-ps-amber/50 bg-ps-amber/10 p-4">
          <h1 className="mb-2 font-display text-xl font-extrabold text-ps-text">
            ⚠️ Tiebreaker Needed: {group.group_name}
          </h1>
          <p className="text-sm text-ps-text-sec">
            {tiedTeams.join(' and ')} are tied on points. Enter exact scores for
            their matches to break the tie using Goal Difference and Goals Scored.
          </p>
        </div>
      </div>

      {/* Tied teams and their matches */}
      <div className="space-y-6">
        {teamMatches.map(({ teamName, matches }) => (
          <div key={teamName} className="rounded-lg border border-ps-border bg-ps-surface p-4">
            <h2 className="mb-3 text-base font-bold text-ps-text">{teamName}'s Matches</h2>
            <div className="space-y-3">
              {matches.map((match) => (
                <TiebreakerMatchCard
                  key={match.match_id}
                  match={match}
                  onScoreEntry={(home, away) =>
                    handleScoreEntry(match.match_id, home, away)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Resolve button */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-6 py-3 text-sm font-semibold text-ps-text transition-all hover:bg-ps-chip"
        >
          Cancel
        </button>
        <button
          onClick={handleResolve}
          disabled={!allScoresEntered}
          className={`
            flex-1 rounded-lg px-6 py-3 text-sm font-semibold transition-all
            ${
              allScoresEntered
                ? 'bg-ps-text text-ps-bg hover:opacity-90'
                : 'cursor-not-allowed bg-ps-chip text-ps-text-ter'
            }
          `}
        >
          Resolve Tiebreaker
        </button>
      </div>

      {/* Help text */}
      <div className="rounded border border-ps-border bg-ps-bg p-3 text-xs text-ps-text-sec">
        <p className="font-semibold">How tiebreakers work:</p>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>Teams tied on points are separated by Goal Difference</li>
          <li>If still tied, Goals Scored is used</li>
          <li>Exact scores must match your predicted results (W/D/L)</li>
        </ol>
      </div>
    </div>
  )
}

// ============================================================================
// Tiebreaker Match Card (always shows score input)
// ============================================================================

interface TiebreakerMatchCardProps {
  match: MatchPrediction
  onScoreEntry: (homeScore: number, awayScore: number) => void
}

function TiebreakerMatchCard({ match, onScoreEntry }: TiebreakerMatchCardProps) {
  const [homeScore, setHomeScore] = useState(
    match.exact_score?.home_score?.toString() || ''
  )
  const [awayScore, setAwayScore] = useState(
    match.exact_score?.away_score?.toString() || ''
  )

  function handleSave() {
    const home = parseInt(homeScore, 10)
    const away = parseInt(awayScore, 10)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      alert('Please enter valid scores (0 or higher)')
      return
    }

    onScoreEntry(home, away)
  }

  // Result label
  const resultLabel =
    match.result === 'home_win'
      ? `${match.home_team} Win`
      : match.result === 'away_win'
        ? `${match.away_team} Win`
        : 'Draw'

  // Check if score is entered
  const hasScore = match.exact_score !== undefined

  return (
    <div
      className={`
        rounded-lg border p-3
        ${hasScore ? 'border-ps-green/30 bg-ps-green/5' : 'border-ps-amber/30 bg-ps-amber/5'}
      `}
    >
      {/* Match info */}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-ps-text">
          {match.home_team} vs {match.away_team}
        </span>
        <span className="rounded bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-sec">
          {resultLabel}
        </span>
      </div>

      {/* Score input */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          placeholder="0"
          className="w-16 rounded border border-ps-border bg-ps-surface px-2 py-2 text-center font-mono text-sm"
        />
        <span className="text-sm text-ps-text-ter">-</span>
        <input
          type="number"
          min="0"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          placeholder="0"
          className="w-16 rounded border border-ps-border bg-ps-surface px-2 py-2 text-center font-mono text-sm"
        />
        <button
          onClick={handleSave}
          className="ml-auto rounded bg-ps-text px-3 py-2 text-xs font-semibold text-ps-bg hover:opacity-90"
        >
          {hasScore ? 'Update' : 'Save'}
        </button>
      </div>

      {/* Validation hint */}
      <p className="mt-2 text-xs italic text-ps-text-ter">
        Score must match: {resultLabel}
      </p>
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate that a score matches the predicted result
 */
function scoreMatchesResult(
  result: MatchResult,
  homeScore: number,
  awayScore: number
): boolean {
  if (!result) return true // No result selected yet

  if (result === 'home_win') return homeScore > awayScore
  if (result === 'away_win') return awayScore > homeScore
  if (result === 'draw') return homeScore === awayScore

  return false
}
