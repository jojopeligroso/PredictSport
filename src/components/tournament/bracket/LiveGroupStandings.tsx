/**
 * Live Group Standings Component
 *
 * Displays group table with tie detection, highlights, and tiebreaker information.
 * Shows which tiebreaker applies next for tied teams.
 */

import { TeamWithStats, TiebreakerRule } from '@/lib/tournament/bracket/types'
import { CountryFlag } from '@/components/CountryFlag'

interface LiveGroupStandingsProps {
  standings: TeamWithStats[]
  tiebreakers: TiebreakerRule[]
  highlightTies?: boolean
  highlightPositions?: number[] // e.g., [1, 2] for winners and runners-up
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

export default function LiveGroupStandings({
  standings,
  tiebreakers,
  highlightTies = true,
  highlightPositions = [1, 2],
}: LiveGroupStandingsProps) {
  // Detect ties - find groups of teams with equal points
  const tiedGroups: TeamWithStats[][] = []
  if (highlightTies) {
    const pointsMap = new Map<number, TeamWithStats[]>()
    standings.forEach((team) => {
      const teams = pointsMap.get(team.points) || []
      teams.push(team)
      pointsMap.set(team.points, teams)
    })

    // Only consider groups with 2+ teams as ties
    pointsMap.forEach((teams) => {
      if (teams.length > 1) {
        tiedGroups.push(teams)
      }
    })
  }

  // Find which teams are tied
  const tiedTeamNames = new Set(
    tiedGroups.flat().map((team) => team.name)
  )

  // Get the next tiebreaker to apply (simplified - just show first one)
  const nextTiebreaker = tiebreakers[0]

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ps-ink/10 text-left font-mono text-xs text-ps-ink/60">
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-2">Team</th>
              <th className="pb-2 pr-1 text-center">Pts</th>
              <th className="pb-2 pr-1 text-center">GD</th>
              <th className="pb-2 pr-1 text-center">GF</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => {
              const isQualifying = highlightPositions.includes(
                team.position || 0
              )
              const isTied = tiedTeamNames.has(team.name)

              return (
                <tr
                  key={team.name}
                  className={`
                    border-b border-ps-ink/5 font-mono
                    ${isQualifying ? 'bg-ps-green/5' : ''}
                    ${isTied && highlightTies ? 'bg-ps-amber/5 border-l-2 border-ps-amber' : ''}
                  `}
                >
                  {/* Position */}
                  <td className="py-2 pr-2">
                    <span
                      className={`
                        inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
                        ${
                          isQualifying
                            ? 'bg-ps-green text-white'
                            : isTied && highlightTies
                              ? 'bg-ps-amber text-white'
                              : 'bg-ps-ink/5 text-ps-ink/60'
                        }
                      `}
                    >
                      {team.position}
                    </span>
                  </td>

                  {/* Team name */}
                  <td className="py-2 pr-2 font-sans font-semibold text-ps-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <CountryFlag name={team.name} size={16} />
                      <span>{team.name}</span>
                      {isTied && highlightTies && (
                        <span className="ml-1 text-ps-amber">⚠️</span>
                      )}
                    </span>
                  </td>

                  {/* Points */}
                  <td className="py-2 pr-1 text-center font-bold text-ps-ink">
                    {team.points}
                  </td>

                  {/* Goal Difference */}
                  <td
                    className={`py-2 pr-1 text-center ${
                      ((team.goalDifference ?? team.gd) ?? 0) > 0
                        ? 'text-ps-green'
                        : ((team.goalDifference ?? team.gd) ?? 0) < 0
                          ? 'text-ps-red'
                          : 'text-ps-ink/80'
                    }`}
                  >
                    {((team.goalDifference ?? team.gd) ?? 0) > 0 ? '+' : ''}
                    {(team.goalDifference ?? team.gd) ?? 0}
                  </td>

                  {/* Goals For */}
                  <td className="py-2 pr-1 text-center text-ps-ink/80">
                    {(team.goalsFor ?? team.gs) ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tie Warning and Tiebreaker Info */}
      {tiedGroups.length > 0 && highlightTies && (
        <div className="mt-3 space-y-2">
          {tiedGroups.map((group, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-ps-amber/20 bg-ps-amber/5 p-3 text-sm"
            >
              <div className="flex items-start gap-2">
                <span className="text-ps-amber">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-ps-ink">
                    {group.length} teams tied on {group[0].points} points
                  </p>
                  <p className="mt-1 text-xs text-ps-ink/70">
                    {group.map((t) => t.name).join(', ')}
                  </p>
                  {nextTiebreaker && (
                    <p className="mt-2 text-xs text-ps-ink/60">
                      Next tiebreaker:{' '}
                      <span className="font-semibold">
                        {formatTiebreakerLabel(nextTiebreaker.type)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Tiebreaker Hierarchy */}
          {tiebreakers.length > 0 && (
            <div className="rounded-lg border border-ps-ink/10 bg-ps-cream p-3 text-xs text-ps-ink/60">
              <p className="font-semibold text-ps-ink/80">
                Tiebreaker hierarchy:
              </p>
              <ol className="mt-1 list-inside list-decimal space-y-0.5">
                {tiebreakers.map((rule, idx) => (
                  <li key={idx}>{formatTiebreakerLabel(rule.type)}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {highlightPositions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ps-ink/60">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-ps-green" />
            <span>Qualifies for knockout stage</span>
          </div>
          {tiedGroups.length > 0 && highlightTies && (
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-ps-amber" />
              <span>Tied on points</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
