'use client'

/**
 * Group Results Step - W/D/L Prediction
 *
 * User predicts 6 match results per group (Home Win / Draw / Away Win).
 * Smart tiebreaker detection triggers inline score collection when needed.
 *
 * Features:
 * - W/D/L buttons (mutually exclusive)
 * - Real-time standings preview
 * - Smart tiebreaker detection
 * - Inline score prompts (no modals)
 * - Score retention on changes
 * - Match highlighting
 * - Auto-save with debounce
 */

import { useState, useEffect, useCallback } from 'react'

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

export interface GroupData {
  group_id: string
  group_name: string
  teams: string[]
  matches: MatchPrediction[]
  has_tiebreaker_scores: boolean
}

interface GroupResultsStepProps {
  groups: GroupData[]
  onUpdate: (groupData: GroupData[]) => void
  onGroupComplete: (groupId: string) => void
}

export default function GroupResultsStep({
  groups,
  onUpdate,
  onGroupComplete,
}: GroupResultsStepProps) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null)
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null)

  const currentGroup = groups[selectedGroupIndex]
  const completedGroups = groups.filter((g) =>
    g.matches.every((m) => m.result !== null)
  ).length

  // Calculate standings for current group
  const standings = calculateStandings(currentGroup)
  const tiedTeams = detectTiebreakers(standings)
  const needsScores = tiedTeams.length > 0

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)

    const timer = setTimeout(() => {
      // Save to localStorage as backup
      localStorage.setItem('bracket_draft_groups', JSON.stringify(groups))

      // Trigger parent save (will call API)
      onUpdate(groups)
    }, 500)

    setAutoSaveTimer(timer)
  }, [groups, onUpdate, autoSaveTimer])

  // Handle result change
  function handleResultChange(matchId: string, newResult: MatchResult) {
    const match = currentGroup.matches.find((m) => m.match_id === matchId)
    if (!match) return

    const oldResult = match.result

    // Smart score retention: only clear if result TYPE changes
    if (oldResult && newResult && !resultsCompatible(oldResult, newResult)) {
      delete match.exact_score
    }

    match.result = newResult

    // Highlight this match
    setHighlightedMatchId(matchId)

    // Scroll to match
    setTimeout(() => {
      document.getElementById(`match-${matchId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 100)

    // Update groups and trigger auto-save
    const updatedGroups = [...groups]
    updatedGroups[selectedGroupIndex] = { ...currentGroup }
    onUpdate(updatedGroups)
    triggerAutoSave()
  }

  // Handle exact score entry
  function handleScoreEntry(
    matchId: string,
    homeScore: number,
    awayScore: number
  ) {
    const match = currentGroup.matches.find((m) => m.match_id === matchId)
    if (!match) return

    match.exact_score = { home_score: homeScore, away_score: awayScore }
    currentGroup.has_tiebreaker_scores = true

    const updatedGroups = [...groups]
    updatedGroups[selectedGroupIndex] = { ...currentGroup }
    onUpdate(updatedGroups)
    triggerAutoSave()
  }

  // Clear highlight on any interaction
  function handleInteraction() {
    if (highlightedMatchId) {
      setHighlightedMatchId(null)
    }
  }

  // Save group and move to next
  function handleSaveGroup() {
    const allResultsPicked = currentGroup.matches.every((m) => m.result !== null)

    if (!allResultsPicked) {
      alert('Please predict all 6 matches before continuing.')
      return
    }

    // Check if tiebreaker scores needed
    if (needsScores) {
      const matchesNeedingScores = getMatchesForTiebreaker(currentGroup, tiedTeams)
      const allScoresEntered = matchesNeedingScores.every(
        (matchId) => {
          const match = currentGroup.matches.find((m) => m.match_id === matchId)
          return match?.exact_score !== undefined
        }
      )

      if (!allScoresEntered) {
        alert('Please enter exact scores for tiebreaker matches.')
        return
      }
    }

    onGroupComplete(currentGroup.group_id)

    // Move to next group or finish
    if (selectedGroupIndex < groups.length - 1) {
      setSelectedGroupIndex(selectedGroupIndex + 1)
    }
  }

  return (
    <div onClick={handleInteraction}>
      {/* Progress indicator */}
      <div className="mb-4 rounded-lg border border-ps-border bg-ps-surface p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-ps-text">Group Stage Progress</span>
          <span className="font-mono text-xs font-semibold text-ps-amber">
            {completedGroups}/12
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ps-chip">
          <div
            className="h-full bg-ps-amber transition-all duration-300"
            style={{ width: `${(completedGroups / 12) * 100}%` }}
          />
        </div>
      </div>

      {/* Group selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {groups.map((group, index) => {
          const isSelected = index === selectedGroupIndex
          const isComplete = group.matches.every((m) => m.result !== null)

          return (
            <button
              key={group.group_id}
              onClick={() => setSelectedGroupIndex(index)}
              className={`
                rounded-lg px-3 py-2 text-sm font-semibold transition-all
                ${
                  isSelected
                    ? 'bg-ps-text text-ps-bg'
                    : isComplete
                      ? 'bg-ps-green/15 text-ps-green hover:bg-ps-green/20'
                      : 'border border-ps-border bg-ps-surface text-ps-text hover:bg-ps-chip'
                }
              `}
            >
              Group {group.group_id}
              {isComplete && ' ✓'}
            </button>
          )
        })}
      </div>

      {/* Current group header */}
      <div className="mb-4 rounded-lg border border-ps-border bg-ps-surface p-3">
        <h2 className="text-base font-bold text-ps-text">
          {currentGroup.group_name}
        </h2>
        <p className="mt-1 text-xs text-ps-text-sec">
          Pick the result for each match (6 matches)
        </p>
      </div>

      {/* Match cards */}
      <div className="mb-4 space-y-3">
        {currentGroup.matches.map((match) => (
          <MatchCard
            key={match.match_id}
            match={match}
            isHighlighted={highlightedMatchId === match.match_id}
            needsScore={needsScores && matchInvolvesTiedTeams(match, tiedTeams)}
            onResultChange={(result) => handleResultChange(match.match_id, result)}
            onScoreEntry={(home, away) => handleScoreEntry(match.match_id, home, away)}
          />
        ))}
      </div>

      {/* Standings preview */}
      {standings.length > 0 && (
        <div className="mb-4 rounded-lg border border-ps-border bg-ps-surface p-3">
          <h3 className="mb-2 text-sm font-semibold text-ps-text">
            Predicted Standings
          </h3>
          <StandingsTable standings={standings} />

          {tiedTeams.length > 0 && (
            <div className="mt-3 rounded border border-ps-amber/30 bg-ps-amber/10 p-2 text-xs text-ps-text-sec">
              ⚠️ Tiebreaker needed: Enter exact scores for matches involving{' '}
              {tiedTeams.map((t) => t.name).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSaveGroup}
        className="w-full rounded-lg bg-ps-text px-6 py-3 text-sm font-semibold text-ps-bg transition-all hover:opacity-90"
      >
        {selectedGroupIndex === groups.length - 1
          ? 'Complete Group Stage →'
          : 'Save & Next Group →'}
      </button>
    </div>
  )
}

// ============================================================================
// Match Card Component
// ============================================================================

interface MatchCardProps {
  match: MatchPrediction
  isHighlighted: boolean
  needsScore: boolean
  onResultChange: (result: MatchResult) => void
  onScoreEntry: (homeScore: number, awayScore: number) => void
}

function MatchCard({
  match,
  isHighlighted,
  needsScore,
  onResultChange,
  onScoreEntry,
}: MatchCardProps) {
  const [showScoreInput, setShowScoreInput] = useState(false)
  const [homeScore, setHomeScore] = useState(match.exact_score?.home_score?.toString() || '')
  const [awayScore, setAwayScore] = useState(match.exact_score?.away_score?.toString() || '')

  useEffect(() => {
    if (needsScore) setShowScoreInput(true)
  }, [needsScore])

  function handleScoreSubmit() {
    const home = parseInt(homeScore, 10)
    const away = parseInt(awayScore, 10)

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      alert('Please enter valid scores (0 or higher)')
      return
    }

    // Validate score matches result
    if (!scoreMatchesResult(match.result, home, away)) {
      alert('Score doesn\'t match your predicted result!')
      return
    }

    onScoreEntry(home, away)
    setShowScoreInput(false)
  }

  return (
    <div
      id={`match-${match.match_id}`}
      className={`
        rounded-lg border p-3 transition-all
        ${isHighlighted ? 'ring-2 ring-ps-amber animate-pulse' : ''}
        ${match.result ? 'border-ps-green/30 bg-ps-green/5' : 'border-ps-border bg-ps-surface'}
      `}
    >
      {/* Teams */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-semibold text-ps-text">{match.home_team}</span>
        <span className="font-mono text-xs text-ps-text-ter">vs</span>
        <span className="font-semibold text-ps-text">{match.away_team}</span>
      </div>

      {/* Result buttons */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => onResultChange('home_win')}
          className={`
            flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-all
            ${
              match.result === 'home_win'
                ? 'bg-ps-text text-ps-bg'
                : 'border border-ps-border bg-ps-bg text-ps-text hover:bg-ps-chip'
            }
          `}
        >
          Home Win
        </button>
        <button
          onClick={() => onResultChange('draw')}
          className={`
            flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-all
            ${
              match.result === 'draw'
                ? 'bg-ps-text text-ps-bg'
                : 'border border-ps-border bg-ps-bg text-ps-text hover:bg-ps-chip'
            }
          `}
        >
          Draw
        </button>
        <button
          onClick={() => onResultChange('away_win')}
          className={`
            flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-all
            ${
              match.result === 'away_win'
                ? 'bg-ps-text text-ps-bg'
                : 'border border-ps-border bg-ps-bg text-ps-text hover:bg-ps-chip'
            }
          `}
        >
          Away Win
        </button>
      </div>

      {/* Score input (inline, conditional) */}
      {showScoreInput && match.result && (
        <div className="rounded border border-ps-amber/30 bg-ps-amber/10 p-2">
          <p className="mb-2 text-xs text-ps-text-sec">
            Enter exact score (needed for tiebreaker):
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              placeholder="0"
              className="w-16 rounded border border-ps-border bg-ps-bg px-2 py-1 text-center font-mono text-sm"
            />
            <span className="text-xs text-ps-text-ter">-</span>
            <input
              type="number"
              min="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              placeholder="0"
              className="w-16 rounded border border-ps-border bg-ps-bg px-2 py-1 text-center font-mono text-sm"
            />
            <button
              onClick={handleScoreSubmit}
              className="ml-auto rounded bg-ps-text px-3 py-1 text-xs font-semibold text-ps-bg"
            >
              Save Score
            </button>
          </div>
        </div>
      )}

      {/* Show entered score */}
      {match.exact_score && !showScoreInput && (
        <div className="text-center font-mono text-xs text-ps-text-sec">
          Final Score: {match.exact_score.home_score} - {match.exact_score.away_score}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Standings Table
// ============================================================================

interface TeamStanding {
  name: string
  points: number
  position: number
}

function StandingsTable({ standings }: { standings: TeamStanding[] }) {
  return (
    <div className="space-y-1">
      {standings.map((team) => (
        <div
          key={team.name}
          className="flex items-center justify-between rounded bg-ps-bg px-2 py-1.5"
        >
          <div className="flex items-center gap-2">
            <span className="w-4 text-center font-mono text-xs font-bold text-ps-text-ter">
              {team.position}
            </span>
            <span className="text-sm text-ps-text">{team.name}</span>
          </div>
          <span className="font-mono text-xs font-semibold text-ps-text">
            {team.points} pts
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateStandings(group: GroupData): TeamStanding[] {
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

  // Assign positions
  standings.forEach((team, index) => {
    team.position = index + 1
  })

  return standings
}

function detectTiebreakers(standings: TeamStanding[]): TeamStanding[] {
  const tied: TeamStanding[] = []

  for (let i = 0; i < standings.length - 1; i++) {
    if (standings[i].points === standings[i + 1].points) {
      if (!tied.includes(standings[i])) tied.push(standings[i])
      tied.push(standings[i + 1])
    }
  }

  return tied
}

function matchInvolvesTiedTeams(
  match: MatchPrediction,
  tiedTeams: TeamStanding[]
): boolean {
  const tiedNames = tiedTeams.map((t) => t.name)
  return tiedNames.includes(match.home_team) || tiedNames.includes(match.away_team)
}

function getMatchesForTiebreaker(
  group: GroupData,
  tiedTeams: TeamStanding[]
): string[] {
  const tiedNames = tiedTeams.map((t) => t.name)
  return group.matches
    .filter(
      (m) => tiedNames.includes(m.home_team) || tiedNames.includes(m.away_team)
    )
    .map((m) => m.match_id)
}

function resultsCompatible(oldResult: MatchResult, newResult: MatchResult): boolean {
  // Same result type = compatible (score can stay)
  return oldResult === newResult
}

function scoreMatchesResult(
  result: MatchResult,
  homeScore: number,
  awayScore: number
): boolean {
  if (result === 'home_win') return homeScore > awayScore
  if (result === 'away_win') return awayScore > homeScore
  if (result === 'draw') return homeScore === awayScore
  return false
}
