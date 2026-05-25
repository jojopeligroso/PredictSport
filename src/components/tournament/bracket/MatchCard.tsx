'use client'

import { useState, useEffect, useRef } from 'react'
import { CountryFlag } from '@/components/CountryFlag'

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
  pickColor?: 'green' | 'amber'
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
  const [homeScore, setHomeScore] = useState(
    match.exact_score?.home_score?.toString() ?? ''
  )
  const [awayScore, setAwayScore] = useState(
    match.exact_score?.away_score?.toString() ?? ''
  )
  const awayRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHomeScore(match.exact_score?.home_score?.toString() ?? '')
    setAwayScore(match.exact_score?.away_score?.toString() ?? '')
  }, [match.exact_score])

  const selectedTextColor = pickColor === 'amber' ? 'text-ps-amber' : 'text-ps-green'
  const selectedBgColor = pickColor === 'amber' ? 'bg-ps-amber/10' : 'bg-ps-green/10'

  function handleScoreBlur(currentHome: string, currentAway: string) {
    const home = parseInt(currentHome, 10)
    const away = parseInt(currentAway, 10)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return

    // Single callback — the parent handles both result + score atomically
    // to avoid the stale-closure race where two sequential updateMatch calls
    // each read from the same pre-update groups snapshot.
    onScoreEntry(home, away)
  }

  return (
    <div
      id={`match-${match.match_id}`}
      role="group"
      aria-label={`Match: ${match.home_team} vs ${match.away_team}`}
      className={`
        rounded-xl border p-3.5 transition-all duration-200 bg-ps-surface
        ${isHighlighted ? 'ring-2 ring-ps-amber scale-[1.01]' : ''}
        ${match.result ? 'border-ps-amber/30' : 'border-ps-border'}
      `}
    >
      <div className="flex items-center justify-center gap-1.5">
        <button
          onClick={() =>
            onResultChange(match.result === 'home_win' ? null : 'home_win')
          }
          aria-label={`Predict ${match.home_team} to win`}
          aria-pressed={match.result === 'home_win'}
          className={`
            flex-1 min-w-0 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer
            ${match.result === 'home_win' ? `${selectedBgColor} ring-2 ring-ps-amber` : 'hover:bg-ps-chip'}
          `}
        >
          <CountryFlag shape="pill" name={match.home_team} size={24} />
          <span
            className={`
              max-w-full truncate text-xs font-semibold text-center leading-tight
              ${match.result === 'home_win' ? selectedTextColor : 'text-ps-text-ter'}
            `}
          >
            {match.home_team}
          </span>
        </button>

        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={homeScore}
          placeholder="–"
          aria-label={`${match.home_team} score`}
          onChange={(e) => {
            const next = e.target.value
            setHomeScore(next)
            if (homeScore === '' && next !== '') {
              awayRef.current?.focus()
              awayRef.current?.select()
            }
          }}
          onBlur={() => handleScoreBlur(homeScore, awayScore)}
          className={`
            w-[30px] h-[28px] rounded-full border text-center font-mono text-sm font-semibold text-ps-text outline-none transition-all duration-150 shrink-0
            focus:border-ps-amber focus:bg-white
            ${homeScore !== '' ? 'bg-white border-ps-amber' : 'bg-transparent border-ps-border'}
          `}
        />

        <button
          onClick={() => onResultChange(match.result === 'draw' ? null : 'draw')}
          aria-label="Predict draw"
          aria-pressed={match.result === 'draw'}
          className={`
            shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
            ${
              match.result === 'draw'
                ? `${selectedBgColor} ${selectedTextColor} ring-2 ring-ps-amber`
                : 'text-ps-text-ter hover:bg-ps-chip hover:text-ps-text-sec'
            }
          `}
        >
          draw
        </button>

        <input
          ref={awayRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={awayScore}
          placeholder="–"
          aria-label={`${match.away_team} score`}
          onChange={(e) => setAwayScore(e.target.value)}
          onBlur={() => handleScoreBlur(homeScore, awayScore)}
          className={`
            w-[30px] h-[28px] rounded-full border text-center font-mono text-sm font-semibold text-ps-text outline-none transition-all duration-150 shrink-0
            focus:border-ps-amber focus:bg-white
            ${awayScore !== '' ? 'bg-white border-ps-amber' : 'bg-transparent border-ps-border'}
          `}
        />

        <button
          onClick={() =>
            onResultChange(match.result === 'away_win' ? null : 'away_win')
          }
          aria-label={`Predict ${match.away_team} to win`}
          aria-pressed={match.result === 'away_win'}
          className={`
            flex-1 min-w-0 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer
            ${match.result === 'away_win' ? `${selectedBgColor} ring-2 ring-ps-amber` : 'hover:bg-ps-chip'}
          `}
        >
          <CountryFlag shape="pill" name={match.away_team} size={24} />
          <span
            className={`
              max-w-full truncate text-xs font-semibold text-center leading-tight
              ${match.result === 'away_win' ? selectedTextColor : 'text-ps-text-ter'}
            `}
          >
            {match.away_team}
          </span>
        </button>
      </div>
    </div>
  )
}
