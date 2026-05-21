'use client'

/**
 * Score Collector Component
 *
 * Smart score input triggered by ties in group standings.
 * Only requests scores for matches involving tied teams to resolve tiebreakers.
 *
 * Features:
 * - Shows which teams are tied and why scores are needed
 * - Displays only relevant matches (involving tied teams)
 * - Score input fields with validation
 * - Handles random fallback tiebreaker with custom messaging
 * - Applies scores to predictions on submit
 */

import { useState } from 'react'
import {
  TeamWithStats,
  TiebreakerRule,
  MatchPrediction,
} from '@/lib/tournament/bracket/types'

interface ScoreCollectorProps {
  tiedTeams: TeamWithStats[]
  matchesNeedingScores: string[] // match IDs that need scores
  currentTiebreaker: TiebreakerRule
  predictions: MatchPrediction[]
  onScoresProvided: (updatedPredictions: MatchPrediction[]) => void
}

function formatTiebreakerLabel(type: string): string {
  const labels: Record<string, string> = {
    head_to_head_points: 'Head-to-head points',
    head_to_head_gd: 'Head-to-head goal difference',
    head_to_head_gs: 'Head-to-head goals scored',
    overall_gd: 'Overall goal difference',
    overall_gs: 'Overall goals scored',
    fair_play: 'Fair play score (yellow/red cards)',
    ranking: 'FIFA world ranking',
    tries_scored: 'Tries scored',
    goals_scored: 'Goals scored',
    random: 'Random selection',
  }
  return labels[type] || type
}

export default function ScoreCollector({
  tiedTeams,
  matchesNeedingScores,
  currentTiebreaker,
  predictions,
  onScoresProvided,
}: ScoreCollectorProps) {
  // Track scores being entered
  const [scores, setScores] = useState<
    Record<string, { home: string; away: string }>
  >(() => {
    // Initialize with existing scores from predictions
    const initial: Record<string, { home: string; away: string }> = {}
    matchesNeedingScores.forEach((matchId) => {
      const pred = predictions.find((p) => p.match_id === matchId)
      if (pred) {
        initial[matchId] = {
          home: pred.home_score?.toString() ?? '',
          away: pred.away_score?.toString() ?? '',
        }
      }
    })
    return initial
  })

  // Get matches that need scores
  const relevantMatches = predictions.filter((p) =>
    matchesNeedingScores.includes(p.match_id)
  )

  // Check if all required scores are entered
  const allScoresEntered = matchesNeedingScores.every((matchId) => {
    const score = scores[matchId]
    return (
      score &&
      score.home !== '' &&
      score.away !== '' &&
      !isNaN(parseInt(score.home)) &&
      !isNaN(parseInt(score.away))
    )
  })

  function handleScoreChange(
    matchId: string,
    team: 'home' | 'away',
    value: string
  ) {
    // Allow empty or valid numbers only
    if (value !== '' && (isNaN(parseInt(value)) || parseInt(value) < 0)) {
      return
    }

    setScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: value,
      },
    }))
  }

  function handleSubmit() {
    if (!allScoresEntered) return

    // Update predictions with scores
    const updatedPredictions = predictions.map((pred) => {
      if (matchesNeedingScores.includes(pred.match_id)) {
        const score = scores[pred.match_id]
        return {
          ...pred,
          home_score: parseInt(score.home),
          away_score: parseInt(score.away),
        }
      }
      return pred
    })

    onScoresProvided(updatedPredictions)
  }

  // Special case: Random tiebreaker
  if (currentTiebreaker.type === 'random') {
    const tiebreakerMessage =
      currentTiebreaker.config?.uiMessage ||
      'FIFA would use fair play scores to decide this, but for now we\'ve randomly placed teams.'

    return (
      <div className="rounded-lg border border-ps-amber/30 bg-ps-amber/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <h3 className="font-semibold text-ps-ink">
              Your predictions created an exact tie
            </h3>
            <p className="mt-2 text-sm text-ps-ink/70">{tiebreakerMessage}</p>
            <p className="mt-3 text-sm font-semibold text-ps-ink/80">
              💡 Tip: Predict different scores to avoid ties!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-ps-amber/30 bg-ps-amber/5 p-4">
      {/* Tie notification */}
      <div className="mb-4 flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-semibold text-ps-ink">
            {tiedTeams.length} teams tied on {tiedTeams[0]?.points ?? 0} points
          </h3>
          <p className="mt-1 text-sm text-ps-ink/70">
            {tiedTeams.map((t) => t.name).join(', ')}
          </p>
          <p className="mt-2 text-sm font-semibold text-ps-ink/80">
            {formatTiebreakerLabel(currentTiebreaker.type)} will decide the
            final positions.
          </p>
        </div>
      </div>

      {/* Score inputs */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ps-ink">
          Please predict scores for these matches:
        </p>

        {relevantMatches.map((match) => (
          <div
            key={match.match_id}
            className="flex items-center gap-3 rounded-lg bg-ps-cream p-3"
          >
            {/* Match info */}
            <div className="flex-1 text-sm font-medium text-ps-ink">
              {match.home_team} vs {match.away_team}
            </div>

            {/* Score inputs */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={scores[match.match_id]?.home ?? ''}
                onChange={(e) =>
                  handleScoreChange(match.match_id, 'home', e.target.value)
                }
                className="w-12 rounded border border-ps-ink/20 bg-white px-2 py-1 text-center font-mono text-sm font-semibold text-ps-ink focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/20"
                placeholder="0"
              />
              <span className="font-mono text-sm text-ps-ink/60">-</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={scores[match.match_id]?.away ?? ''}
                onChange={(e) =>
                  handleScoreChange(match.match_id, 'away', e.target.value)
                }
                className="w-12 rounded border border-ps-ink/20 bg-white px-2 py-1 text-center font-mono text-sm font-semibold text-ps-ink focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/20"
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!allScoresEntered}
        className={`mt-4 w-full rounded-lg py-2 font-semibold transition-colors ${
          allScoresEntered
            ? 'bg-ps-amber text-white hover:bg-ps-amber/90'
            : 'cursor-not-allowed bg-ps-ink/10 text-ps-ink/40'
        }`}
      >
        Apply Scores
      </button>

      {!allScoresEntered && (
        <p className="mt-2 text-center text-xs text-ps-ink/60">
          Enter scores for all matches to continue
        </p>
      )}
    </div>
  )
}
