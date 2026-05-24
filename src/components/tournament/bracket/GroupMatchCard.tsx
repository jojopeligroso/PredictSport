'use client'

/**
 * Group Match Card
 *
 * Individual match prediction card for group stage.
 * Collects score predictions and optional extras (tries, bonus points).
 */

import { useState } from 'react'
import { MatchPrediction } from '@/lib/tournament/bracket/types'
import { CountryFlag } from '@/components/CountryFlag'

interface GroupMatchCardProps {
  match: MatchPrediction
  onScoreUpdate: (
    homeScore: number | null,
    awayScore: number | null,
    homeTries?: number,
    awayTries?: number
  ) => void
  needsTries?: boolean
  needsBonusPoints?: boolean
}

export default function GroupMatchCard({
  match,
  onScoreUpdate,
  needsTries = false,
  needsBonusPoints = false,
}: GroupMatchCardProps) {
  const [homeScore, setHomeScore] = useState<string>(
    match.home_score?.toString() || ''
  )
  const [awayScore, setAwayScore] = useState<string>(
    match.away_score?.toString() || ''
  )
  const [homeTries, setHomeTries] = useState<string>(
    match.home_tries?.toString() || ''
  )
  const [awayTries, setAwayTries] = useState<string>(
    match.away_tries?.toString() || ''
  )

  function handleScoreChange(team: 'home' | 'away', value: string) {
    const numValue = value === '' ? null : parseInt(value, 10)

    if (value !== '' && (isNaN(numValue!) || numValue! < 0)) {
      return // Invalid input
    }

    if (team === 'home') {
      setHomeScore(value)
      onScoreUpdate(
        numValue,
        awayScore === '' ? null : parseInt(awayScore, 10),
        homeTries === '' ? undefined : parseInt(homeTries, 10),
        awayTries === '' ? undefined : parseInt(awayTries, 10)
      )
    } else {
      setAwayScore(value)
      onScoreUpdate(
        homeScore === '' ? null : parseInt(homeScore, 10),
        numValue,
        homeTries === '' ? undefined : parseInt(homeTries, 10),
        awayTries === '' ? undefined : parseInt(awayTries, 10)
      )
    }
  }

  function handleTriesChange(team: 'home' | 'away', value: string) {
    const numValue = value === '' ? undefined : parseInt(value, 10)

    if (value !== '' && (isNaN(numValue!) || numValue! < 0)) {
      return
    }

    if (team === 'home') {
      setHomeTries(value)
      onScoreUpdate(
        homeScore === '' ? null : parseInt(homeScore, 10),
        awayScore === '' ? null : parseInt(awayScore, 10),
        numValue,
        awayTries === '' ? undefined : parseInt(awayTries, 10)
      )
    } else {
      setAwayTries(value)
      onScoreUpdate(
        homeScore === '' ? null : parseInt(homeScore, 10),
        awayScore === '' ? null : parseInt(awayScore, 10),
        homeTries === '' ? undefined : parseInt(homeTries, 10),
        numValue
      )
    }
  }

  const isComplete =
    homeScore !== '' &&
    awayScore !== '' &&
    (!needsTries || (homeTries !== '' && awayTries !== ''))

  return (
    <div
      className={`
      rounded-lg border p-4 transition-all
      ${
        isComplete
          ? 'border-ps-green/30 bg-ps-green/5'
          : 'border-ps-ink/10 bg-white'
      }
    `}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-1.5">
            <CountryFlag name={match.home_team} size={20} />
            <p className="text-sm font-semibold text-ps-ink">
              {match.home_team}
            </p>
          </div>
          <input
            type="number"
            min="0"
            value={homeScore}
            onChange={(e) => handleScoreChange('home', e.target.value)}
            placeholder="0"
            className="w-full rounded border border-ps-ink/20 px-3 py-2 font-mono text-lg font-semibold text-ps-ink focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/20"
          />

          {/* Tries (rugby) */}
          {needsTries && (
            <div className="mt-2">
              <label className="text-xs text-ps-ink/60">Tries</label>
              <input
                type="number"
                min="0"
                value={homeTries}
                onChange={(e) => handleTriesChange('home', e.target.value)}
                placeholder="0"
                className="w-full rounded border border-ps-ink/10 px-2 py-1 text-sm font-mono text-ps-ink focus:border-ps-amber focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* VS separator */}
        <div className="flex flex-col items-center">
          <span className="font-mono text-xs text-ps-ink/40">vs</span>
          {isComplete && (
            <span className="mt-1 text-lg">✓</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-1.5">
            <CountryFlag name={match.away_team} size={20} />
            <p className="text-sm font-semibold text-ps-ink">
              {match.away_team}
            </p>
          </div>
          <input
            type="number"
            min="0"
            value={awayScore}
            onChange={(e) => handleScoreChange('away', e.target.value)}
            placeholder="0"
            className="w-full rounded border border-ps-ink/20 px-3 py-2 font-mono text-lg font-semibold text-ps-ink focus:border-ps-amber focus:outline-none focus:ring-2 focus:ring-ps-amber/20"
          />

          {/* Tries (rugby) */}
          {needsTries && (
            <div className="mt-2">
              <label className="text-xs text-ps-ink/60">Tries</label>
              <input
                type="number"
                min="0"
                value={awayTries}
                onChange={(e) => handleTriesChange('away', e.target.value)}
                placeholder="0"
                className="w-full rounded border border-ps-ink/10 px-2 py-1 text-sm font-mono text-ps-ink focus:border-ps-amber focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
