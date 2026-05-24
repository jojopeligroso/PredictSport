'use client'

/**
 * Knockout Match Card
 *
 * Simple winner picker for knockout matches.
 * User selects which team advances (no score prediction needed).
 */

import { CountryFlag } from '@/components/CountryFlag'

interface KnockoutMatchCardProps {
  matchNumber: number
  homeTeam: string
  awayTeam: string
  selectedWinner: string | null
  onWinnerSelect: (winner: string) => void
}

export default function KnockoutMatchCard({
  matchNumber,
  homeTeam,
  awayTeam,
  selectedWinner,
  onWinnerSelect,
}: KnockoutMatchCardProps) {
  const isComplete = selectedWinner !== null
  const isTBD = homeTeam === 'TBD' || awayTeam === 'TBD'

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
      {/* Match number */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-ps-ink/40">
          Match {matchNumber}
        </span>
        {isComplete && (
          <span className="text-lg">✓</span>
        )}
      </div>

      <div className="flex items-stretch gap-3">
        {/* Home team button */}
        <button
          onClick={() => onWinnerSelect(homeTeam)}
          disabled={isTBD}
          className={`
            flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 text-center font-semibold transition-all
            ${
              selectedWinner === homeTeam
                ? 'border-ps-amber bg-ps-amber/10 text-ps-ink shadow-md'
                : 'border-ps-ink/10 text-ps-ink/80 hover:border-ps-ink/20 hover:bg-ps-ink/5'
            }
            ${isTBD ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
          `}
        >
          <CountryFlag name={isTBD ? null : homeTeam} size={32} />
          <span className="block text-sm font-semibold">{homeTeam}</span>
        </button>

        {/* VS separator */}
        <div className="flex items-center">
          <span className="font-mono text-xs text-ps-ink/40">vs</span>
        </div>

        {/* Away team button */}
        <button
          onClick={() => onWinnerSelect(awayTeam)}
          disabled={isTBD}
          className={`
            flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 text-center font-semibold transition-all
            ${
              selectedWinner === awayTeam
                ? 'border-ps-amber bg-ps-amber/10 text-ps-ink shadow-md'
                : 'border-ps-ink/10 text-ps-ink/80 hover:border-ps-ink/20 hover:bg-ps-ink/5'
            }
            ${isTBD ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
          `}
        >
          <CountryFlag name={isTBD ? null : awayTeam} size={32} />
          <span className="block text-sm font-semibold">{awayTeam}</span>
        </button>
      </div>

      {/* TBD warning */}
      {isTBD && (
        <p className="mt-2 text-xs text-ps-ink/60">
          Complete previous rounds to unlock this match
        </p>
      )}
    </div>
  )
}
