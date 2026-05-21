'use client'

/**
 * Third-Place Ranking Step
 *
 * Ranks all 12 third-place teams to determine which 8 qualify for R32.
 * Uses FIFA tiebreaker rules: Points → GD → GS → Fair Play → Ranking
 *
 * Smart score collection: Only asks for exact scores when:
 * 1. Teams are tied on points
 * 2. We don't already have scores from within-group tiebreakers
 * 3. Only requests the 3 matches that team played (not all 6 group matches)
 *
 * This is the most complex logic in the entire bracket classification.
 */

import { useState, useEffect } from 'react'
import { GroupData, MatchPrediction } from './GroupResultsStepV2'

interface ThirdPlaceTeam {
  team_name: string
  group_id: string
  points: number
  goal_difference: number | null
  goals_scored: number | null
  matches: MatchPrediction[] // Only the 3 matches this team played
  needs_scores: boolean
  rank: number
}

interface ThirdPlaceRankingStepProps {
  groups: GroupData[]
  onComplete: (qualifiedTeams: string[]) => void
  onBack: () => void
}

export default function ThirdPlaceRankingStep({
  groups,
  onComplete,
  onBack,
}: ThirdPlaceRankingStepProps) {
  const [thirdPlaceTeams, setThirdPlaceTeams] = useState<ThirdPlaceTeam[]>([])
  const [collectingScoresFor, setCollectingScoresFor] = useState<string | null>(null)

  useEffect(() => {
    // Extract third-place teams from all groups
    const teams = extractThirdPlaceTeams(groups)
    setThirdPlaceTeams(teams)
  }, [groups])

  // Calculate final rankings with tiebreakers
  const rankedTeams = rankThirdPlaceTeams(thirdPlaceTeams)
  const top8 = rankedTeams.slice(0, 8)
  const teamsNeedingScores = rankedTeams.filter((t) => t.needs_scores)

  function handleScoreEntry(
    teamName: string,
    matchId: string,
    homeScore: number,
    awayScore: number
  ) {
    const team = thirdPlaceTeams.find((t) => t.team_name === teamName)
    if (!team) return

    const match = team.matches.find((m) => m.match_id === matchId)
    if (!match) return

    match.exact_score = { home_score: homeScore, away_score: awayScore }

    // Recalculate GD and GS for this team
    const { gd, gs } = calculateTeamStats(team.matches, teamName)
    team.goal_difference = gd
    team.goals_scored = gs
    team.needs_scores = false

    setThirdPlaceTeams([...thirdPlaceTeams])

    // Clear collection modal if all scores entered
    const allEntered = team.matches.every((m) => m.exact_score !== undefined)
    if (allEntered) {
      setCollectingScoresFor(null)
    }
  }

  function handleContinue() {
    if (teamsNeedingScores.length > 0) {
      alert('Please enter exact scores for all tied teams.')
      return
    }

    // Extract qualified team names (top 8)
    const qualifiedNames = top8.map((t) => t.team_name)
    onComplete(qualifiedNames)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 rounded-lg border border-ps-border bg-ps-surface p-3">
        <h2 className="text-base font-bold text-ps-text">
          Third-Place Team Ranking
        </h2>
        <p className="mt-1 text-xs text-ps-text-sec">
          The top 8 third-place teams advance to the Round of 32
        </p>
      </div>

      {/* Rankings table */}
      <div className="mb-4 rounded-lg border border-ps-border bg-ps-surface p-3">
        <h3 className="mb-3 text-sm font-semibold text-ps-text">
          Third-Place Teams (Ranked)
        </h3>
        <div className="space-y-2">
          {rankedTeams.map((team) => (
            <ThirdPlaceTeamCard
              key={team.team_name}
              team={team}
              isQualified={team.rank <= 8}
              isCollectingScores={collectingScoresFor === team.team_name}
              onStartScoreCollection={() => setCollectingScoresFor(team.team_name)}
              onScoreEntry={(matchId, home, away) =>
                handleScoreEntry(team.team_name, matchId, home, away)
              }
            />
          ))}
        </div>
      </div>

      {/* Warning if scores needed */}
      {teamsNeedingScores.length > 0 && (
        <div className="mb-4 rounded border border-ps-amber/30 bg-ps-amber/10 p-3 text-xs text-ps-text">
          ⚠️ Some teams are tied on points. Click "Enter Scores" to provide exact
          match scores for tiebreaker calculation.
        </div>
      )}

      {/* Qualification summary */}
      <div className="mb-4 rounded-lg border border-ps-green/30 bg-ps-green/5 p-3">
        <h3 className="mb-2 text-sm font-semibold text-ps-green">
          ✅ Qualified for Round of 32
        </h3>
        <div className="flex flex-wrap gap-2">
          {top8.map((team) => (
            <div
              key={team.team_name}
              className="rounded bg-ps-green/20 px-2 py-1 text-xs font-semibold text-ps-green"
            >
              {team.team_name} (Group {team.group_id})
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between gap-2">
        <button
          onClick={onBack}
          className="rounded-lg border border-ps-border px-4 py-2 text-sm font-semibold text-ps-text hover:bg-ps-chip"
        >
          ← Back to Groups
        </button>
        <button
          onClick={handleContinue}
          disabled={teamsNeedingScores.length > 0}
          className={`
            rounded-lg px-6 py-2 text-sm font-semibold transition-all
            ${
              teamsNeedingScores.length === 0
                ? 'bg-ps-text text-ps-bg hover:opacity-90'
                : 'cursor-not-allowed bg-ps-chip text-ps-text-ter'
            }
          `}
        >
          Continue to Knockouts →
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Third Place Team Card
// ============================================================================

interface ThirdPlaceTeamCardProps {
  team: ThirdPlaceTeam
  isQualified: boolean
  isCollectingScores: boolean
  onStartScoreCollection: () => void
  onScoreEntry: (matchId: string, homeScore: number, awayScore: number) => void
}

function ThirdPlaceTeamCard({
  team,
  isQualified,
  isCollectingScores,
  onStartScoreCollection,
  onScoreEntry,
}: ThirdPlaceTeamCardProps) {
  return (
    <div
      className={`
        rounded-lg border p-3 transition-all
        ${
          isQualified
            ? 'border-ps-green/30 bg-ps-green/5'
            : 'border-ps-border bg-ps-bg'
        }
      `}
    >
      {/* Team info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`
              flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
              ${
                isQualified
                  ? 'bg-ps-green text-white'
                  : 'bg-ps-chip text-ps-text-ter'
              }
            `}
          >
            {team.rank}
          </span>
          <div>
            <p className="text-sm font-semibold text-ps-text">{team.team_name}</p>
            <p className="font-mono text-xs text-ps-text-sec">
              Group {team.group_id} 3rd
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="font-mono text-xs font-semibold text-ps-text">
            {team.points} pts
          </p>
          {team.goal_difference !== null && (
            <p className="font-mono text-xs text-ps-text-sec">
              GD: {team.goal_difference > 0 ? '+' : ''}
              {team.goal_difference} | GS: {team.goals_scored}
            </p>
          )}
        </div>
      </div>

      {/* Score collection button */}
      {team.needs_scores && !isCollectingScores && (
        <button
          onClick={onStartScoreCollection}
          className="mt-2 w-full rounded bg-ps-amber/20 px-3 py-1.5 text-xs font-semibold text-ps-amber hover:bg-ps-amber/30"
        >
          Enter Scores for Tiebreaker
        </button>
      )}

      {/* Score collection form */}
      {isCollectingScores && (
        <div className="mt-3 space-y-2 rounded border border-ps-amber/30 bg-ps-amber/10 p-2">
          <p className="text-xs font-semibold text-ps-text">
            Enter exact scores for {team.team_name}'s 3 matches:
          </p>
          {team.matches.map((match) => (
            <MatchScoreInput
              key={match.match_id}
              match={match}
              teamName={team.team_name}
              onScoreEntry={(home, away) => onScoreEntry(match.match_id, home, away)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Match Score Input
// ============================================================================

interface MatchScoreInputProps {
  match: MatchPrediction
  teamName: string
  onScoreEntry: (homeScore: number, awayScore: number) => void
}

function MatchScoreInput({ match, teamName, onScoreEntry }: MatchScoreInputProps) {
  const [homeScore, setHomeScore] = useState(
    match.exact_score?.home_score?.toString() || ''
  )
  const [awayScore, setAwayScore] = useState(
    match.exact_score?.away_score?.toString() || ''
  )

  function handleSubmit() {
    const home = parseInt(homeScore, 10)
    const away = parseInt(awayScore, 10)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      alert('Please enter valid scores')
      return
    }

    // Validate score matches result
    const resultType = getResultType(home, away)
    if (resultType !== match.result) {
      alert('Score must match your predicted result!')
      return
    }

    onScoreEntry(home, away)
  }

  const hasScore = match.exact_score !== undefined

  return (
    <div className="rounded bg-ps-bg p-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-ps-text">
          {match.home_team}
        </span>
        <span className="text-ps-text-ter">vs</span>
        <span className="font-semibold text-ps-text">
          {match.away_team}
        </span>
      </div>
      <p className="mb-2 text-[10px] text-ps-text-ter">
        Your prediction: {formatResult(match.result)}
      </p>

      {hasScore ? (
        <div className="text-center font-mono text-xs text-ps-green">
          ✓ {match.exact_score?.home_score} - {match.exact_score?.away_score}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            placeholder="0"
            className="w-12 rounded border border-ps-border bg-ps-surface px-1 py-0.5 text-center font-mono text-xs"
          />
          <span className="text-xs text-ps-text-ter">-</span>
          <input
            type="number"
            min="0"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            placeholder="0"
            className="w-12 rounded border border-ps-border bg-ps-surface px-1 py-0.5 text-center font-mono text-xs"
          />
          <button
            onClick={handleSubmit}
            className="ml-auto rounded bg-ps-text px-2 py-0.5 text-[10px] font-semibold text-ps-bg"
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract third-place teams from all groups
 */
function extractThirdPlaceTeams(groups: GroupData[]): ThirdPlaceTeam[] {
  const teams: ThirdPlaceTeam[] = []

  groups.forEach((group) => {
    // Calculate standings
    const standings = calculateGroupStandings(group)
    const thirdPlace = standings.find((s) => s.position === 3)

    if (!thirdPlace) return

    // Get matches involving this team
    const teamMatches = group.matches.filter(
      (m) => m.home_team === thirdPlace.name || m.away_team === thirdPlace.name
    )

    // Check if we already have exact scores for all 3 matches
    const hasAllScores = teamMatches.every((m) => m.exact_score !== undefined)

    let gd: number | null = null
    let gs: number | null = null

    if (hasAllScores) {
      const stats = calculateTeamStats(teamMatches, thirdPlace.name)
      gd = stats.gd
      gs = stats.gs
    }

    teams.push({
      team_name: thirdPlace.name,
      group_id: group.group_id,
      points: thirdPlace.points,
      goal_difference: gd,
      goals_scored: gs,
      matches: teamMatches,
      needs_scores: !hasAllScores,
      rank: 0, // Will be assigned in ranking function
    })
  })

  return teams
}

/**
 * Rank third-place teams using FIFA rules
 */
function rankThirdPlaceTeams(teams: ThirdPlaceTeam[]): ThirdPlaceTeam[] {
  const sorted = [...teams].sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) return b.points - a.points

    // 2. Goal difference (if available)
    if (a.goal_difference !== null && b.goal_difference !== null) {
      if (b.goal_difference !== a.goal_difference) {
        return b.goal_difference - a.goal_difference
      }
    }

    // 3. Goals scored (if available)
    if (a.goals_scored !== null && b.goals_scored !== null) {
      if (b.goals_scored !== a.goals_scored) {
        return b.goals_scored - a.goals_scored
      }
    }

    // 4. Fair play (Phase 2)
    // 5. FIFA ranking (Phase 2)

    // 6. Alphabetical as fallback
    return a.team_name.localeCompare(b.team_name)
  })

  // Assign ranks
  sorted.forEach((team, index) => {
    team.rank = index + 1
  })

  return sorted
}

/**
 * Calculate standings for a group (points only)
 */
function calculateGroupStandings(
  group: GroupData
): Array<{ name: string; points: number; position: number }> {
  const points: Record<string, number> = {}
  group.teams.forEach((team) => (points[team] = 0))

  group.matches.forEach((match) => {
    if (!match.result) return

    if (match.result === 'home_win') {
      points[match.home_team] += 3
    } else if (match.result === 'away_win') {
      points[match.away_team] += 3
    } else if (match.result === 'draw') {
      points[match.home_team] += 1
      points[match.away_team] += 1
    }
  })

  const standings = Object.entries(points)
    .map(([name, pts]) => ({ name, points: pts, position: 0 }))
    .sort((a, b) => b.points - a.points)

  standings.forEach((team, index) => {
    team.position = index + 1
  })

  return standings
}

/**
 * Calculate GD and GS for a specific team from their matches
 */
function calculateTeamStats(
  matches: MatchPrediction[],
  teamName: string
): { gd: number; gs: number } {
  let goalsFor = 0
  let goalsAgainst = 0

  matches.forEach((match) => {
    if (!match.exact_score) return

    if (match.home_team === teamName) {
      goalsFor += match.exact_score.home_score
      goalsAgainst += match.exact_score.away_score
    } else if (match.away_team === teamName) {
      goalsFor += match.exact_score.away_score
      goalsAgainst += match.exact_score.home_score
    }
  })

  return {
    gd: goalsFor - goalsAgainst,
    gs: goalsFor,
  }
}

function getResultType(homeScore: number, awayScore: number): string {
  if (homeScore > awayScore) return 'home_win'
  if (awayScore > homeScore) return 'away_win'
  return 'draw'
}

function formatResult(result: string | null): string {
  if (result === 'home_win') return 'Home Win'
  if (result === 'away_win') return 'Away Win'
  if (result === 'draw') return 'Draw'
  return 'Not predicted'
}
