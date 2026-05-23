'use client'

/**
 * Match Card - Compact W/D/L prediction with team name buttons
 *
 * Design principles:
 * - Team names are the buttons (not "Home Win"/"Away Win" labels)
 * - Color-driven selection (user's pick color)
 * - Exact score is expandable/collapsible (ignorable by default)
 * - Mobile-first compact layout (single row)
 * - Minimum 44px tap targets for accessibility
 */

import { useState, useEffect } from 'react'

export type MatchResult = 'home_win' | 'draw' | 'away_win' | null

export interface MatchPrediction {
  match_id: string
  home_team: string
  away_team: string
  result: MatchResult
  exact_score?: {
    home_score: number
    away_score: number
  }
}

interface MatchCardProps {
  match: MatchPrediction
  isHighlighted?: boolean
  needsScore?: boolean
  pickColor?: 'green' | 'amber' // User's customizable pick color
  onResultChange: (result: MatchResult) => void
  onScoreEntry: (homeScore: number, awayScore: number) => void
}

export default function MatchCard({
  match,
  isHighlighted = false,
  needsScore = false,
  pickColor = 'green',
  onResultChange,
  onScoreEntry,
}: MatchCardProps) {
  const [showScoreInput, setShowScoreInput] = useState(false)
  const [homeScore, setHomeScore] = useState(
    match.exact_score?.home_score?.toString() || ''
  )
  const [awayScore, setAwayScore] = useState(
    match.exact_score?.away_score?.toString() || ''
  )

  // Update local state when match score changes
  useEffect(() => {
    setHomeScore(match.exact_score?.home_score?.toString() || '')
    setAwayScore(match.exact_score?.away_score?.toString() || '')
  }, [match.exact_score])

  function handleScoreSubmit() {
    const home = parseInt(homeScore, 10)
    const away = parseInt(awayScore, 10)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      alert('Please enter valid scores (0 or higher)')
      return
    }

    // Validate score matches result
    if (!scoreMatchesResult(match.result, home, away)) {
      alert("Score doesn't match your predicted result!")
      return
    }

    onScoreEntry(home, away)
    setShowScoreInput(false)
  }

  const selectedTextColor = pickColor === 'amber' ? 'text-ps-amber' : 'text-ps-green'
  const selectedBgColor = pickColor === 'amber' ? 'bg-ps-amber/10' : 'bg-ps-green/10'

  return (
    <div
      id={`match-${match.match_id}`}
      role="group"
      aria-label={`Match: ${match.home_team} vs ${match.away_team}`}
      className={`
        rounded-lg border p-3 transition-all duration-200
        ${isHighlighted ? 'ring-2 ring-ps-amber scale-[1.01]' : ''}
        ${match.result ? 'border-ps-border bg-ps-surface' : 'border-ps-border bg-ps-surface'}
      `}
    >
      {/* Pick row — home / D / away. The D button replaces "vs" as the
          centered separator: tapping it predicts a draw. Per
          docs/DESIGN-PROMPT-WC2026-BRACKET.md §"Match Card Structure". */}
      <div className="flex items-center gap-1">
        <button
          onClick={() =>
            onResultChange(match.result === 'home_win' ? null : 'home_win')
          }
          aria-label={`Predict ${match.home_team} to win`}
          aria-pressed={match.result === 'home_win'}
          className={`
            flex-1 min-h-[44px] rounded-md px-2 py-2 text-right text-sm font-semibold transition-all duration-150
            ${
              match.result === 'home_win'
                ? `${selectedTextColor} ${selectedBgColor}`
                : 'text-ps-text-sec hover:bg-ps-chip'
            }
          `}
        >
          {match.home_team}
        </button>

        <button
          onClick={() => onResultChange(match.result === 'draw' ? null : 'draw')}
          aria-label="Predict draw"
          aria-pressed={match.result === 'draw'}
          className={`
            shrink-0 min-h-[44px] min-w-[40px] rounded-md px-2 py-2 text-center text-xs font-mono font-bold uppercase tracking-widest transition-all duration-150
            ${
              match.result === 'draw'
                ? `${selectedTextColor} ${selectedBgColor}`
                : 'text-ps-text-ter hover:bg-ps-chip hover:text-ps-text-sec'
            }
          `}
        >
          D
        </button>

        <button
          onClick={() =>
            onResultChange(match.result === 'away_win' ? null : 'away_win')
          }
          aria-label={`Predict ${match.away_team} to win`}
          aria-pressed={match.result === 'away_win'}
          className={`
            flex-1 min-h-[44px] rounded-md px-2 py-2 text-left text-sm font-semibold transition-all duration-150
            ${
              match.result === 'away_win'
                ? `${selectedTextColor} ${selectedBgColor}`
                : 'text-ps-text-sec hover:bg-ps-chip'
            }
          `}
        >
          {match.away_team}
        </button>
      </div>

      {/* Exact score section - collapsible */}
      <div className="mt-3">
        {!showScoreInput ? (
          // Collapsed state
          <button
            onClick={() => setShowScoreInput(true)}
            className="flex w-full items-center justify-between text-xs text-ps-text-sec hover:text-ps-text"
          >
            <span className="flex items-center gap-1">
              <span>⋮</span>
              <span>Exact score</span>
            </span>
            {match.exact_score && (
              <span className="font-mono text-ps-text-ter">
                {match.exact_score.home_score} - {match.exact_score.away_score}
              </span>
            )}
          </button>
        ) : (
          // Expanded state
          <div className="space-y-2">
            <button
              onClick={() => setShowScoreInput(false)}
              className="flex w-full items-center gap-1 text-xs text-ps-text-sec hover:text-ps-text"
            >
              <span>▾</span>
              <span>Exact score</span>
            </button>

            <div className="rounded border border-ps-border bg-ps-bg p-3">
              {needsScore && !match.exact_score && (
                <p className="mb-2 text-xs text-ps-amber">
                  ⚠️ Required for tiebreaker
                </p>
              )}
              <p className="mb-2 text-xs text-ps-text-sec">
                {match.home_team} vs {match.away_team}
              </p>
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
                  onClick={handleScoreSubmit}
                  className="ml-auto rounded bg-ps-text px-3 py-2 text-xs font-semibold text-ps-bg hover:opacity-90"
                >
                  Save
                </button>
              </div>
              <p className="mt-2 text-xs italic text-ps-text-ter">
                Optional: Used for tiebreakers
              </p>
            </div>
          </div>
        )}
      </div>
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
