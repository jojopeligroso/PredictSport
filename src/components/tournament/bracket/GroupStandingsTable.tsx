/**
 * Group Standings Table
 *
 * Displays calculated group standings with position, points, and stats.
 * Highlights qualifying positions (winners, runners-up, thirds).
 */

import { TeamWithStats } from '@/lib/tournament/bracket/types'
import { CountryFlag } from '@/components/CountryFlag'

interface GroupStandingsTableProps {
  standings: TeamWithStats[]
  highlightPositions?: number[] // e.g., [1, 2] for winners and runners-up
}

export default function GroupStandingsTable({
  standings,
  highlightPositions = [1, 2],
}: GroupStandingsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ps-ink/10 text-left font-mono text-xs text-ps-ink/60">
            <th className="pb-2 pr-2">#</th>
            <th className="pb-2 pr-2">Team</th>
            <th className="pb-2 pr-1 text-center">P</th>
            <th className="pb-2 pr-1 text-center">W</th>
            <th className="pb-2 pr-1 text-center">D</th>
            <th className="pb-2 pr-1 text-center">L</th>
            <th className="pb-2 pr-1 text-center">GF</th>
            <th className="pb-2 pr-1 text-center">GA</th>
            <th className="pb-2 pr-1 text-center">GD</th>
            <th className="pb-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => {
            const isQualifying = highlightPositions.includes(team.position || 0)

            return (
              <tr
                key={team.name}
                className={`
                  border-b border-ps-ink/5 font-mono
                  ${isQualifying ? 'bg-ps-green/5' : ''}
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
                  </span>
                </td>

                {/* Stats */}
                <td className="py-2 pr-1 text-center text-ps-ink/80">
                  {team.played ?? ((team.wins ?? 0) + (team.draws ?? 0) + (team.losses ?? 0))}
                </td>
                <td className="py-2 pr-1 text-center text-ps-ink/80">
                  {team.wins}
                </td>
                <td className="py-2 pr-1 text-center text-ps-ink/80">
                  {team.draws}
                </td>
                <td className="py-2 pr-1 text-center text-ps-ink/80">
                  {team.losses}
                </td>
                <td className="py-2 pr-1 text-center text-ps-ink/80">
                  {team.goalsFor ?? team.gs}
                </td>
                <td className="py-2 pr-1 text-center text-ps-ink/80">
                  {team.goalsAgainst ?? team.gc}
                </td>
                <td
                  className={`py-2 pr-1 text-center ${
                    (team.goalDifference ?? team.gd ?? 0) > 0
                      ? 'text-ps-green'
                      : (team.goalDifference ?? team.gd ?? 0) < 0
                        ? 'text-ps-red'
                        : 'text-ps-ink/80'
                  }`}
                >
                  {(team.goalDifference ?? team.gd ?? 0) > 0 ? '+' : ''}
                  {team.goalDifference ?? team.gd ?? 0}
                </td>

                {/* Points */}
                <td className="py-2 text-center font-bold text-ps-ink">
                  {team.points}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Legend */}
      {highlightPositions.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-ps-ink/60">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-ps-green" />
            <span>Qualifies for knockout stage</span>
          </div>
        </div>
      )}
    </div>
  )
}
