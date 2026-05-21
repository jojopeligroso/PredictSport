'use client'

/**
 * Group Results Step V2 - Refactored for new UX
 *
 * Key changes from V1:
 * - Uses new MatchCard component with team name buttons
 * - "Continue" button instead of "Save & Next Group"
 * - No inline tiebreaker warnings
 * - Navigates to separate TiebreakerResolutionPage when needed
 * - Cleaner, more compact design
 *
 * Features:
 * - Team name selection (color-driven)
 * - Real-time standings preview
 * - Smart tiebreaker detection
 * - Score retention on changes
 * - Auto-save with debounce
 */

import { useState, useCallback } from 'react'
import MatchCard, {
  type MatchResult,
  type MatchPrediction,
} from './MatchCard'

export type { MatchResult, MatchPrediction }

export interface GroupData {
  group_id: string
  group_name: string
  teams: string[]
  matches: MatchPrediction[]
  has_tiebreaker_scores: boolean
}

interface GroupResultsStepV2Props {
  groups: GroupData[]
  pickColor?: 'green' | 'amber'
  onUpdate: (groupData: GroupData[]) => void
  onGroupComplete: (groupId: string) => void
  onTiebreakerNeeded: (groupIndex: number, tiedTeams: string[]) => void
}

export default function GroupResultsStepV2({
  groups,
  pickColor = 'green',
  onUpdate,
  onGroupComplete,
  onTiebreakerNeeded,
}: GroupResultsStepV2Props) {
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

  // Check if current group is complete (all results entered)
  const currentGroupComplete = currentGroup.matches.every((m) => m.result !== null)

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

    // Clear highlight after 2s
    setTimeout(() => setHighlightedMatchId(null), 2000)

    // Trigger auto-save
    triggerAutoSave()
  }

  // Handle score entry
  function handleScoreEntry(matchId: string, homeScore: number, awayScore: number) {
    const match = currentGroup.matches.find((m) => m.match_id === matchId)
    if (!match) return

    match.exact_score = { home_score: homeScore, away_score: awayScore }

    // Trigger auto-save
    triggerAutoSave()
  }

  // Handle Continue button
  function handleContinue() {
    if (!currentGroupComplete) {
      alert('Please complete all matches before continuing')
      return
    }

    // Check if tiebreaker needed
    if (needsScores) {
      // Check if all required scores are entered
      const allScoresEntered = currentGroup.matches
        .filter((m) => matchInvolvesTiedTeams(m, tiedTeams))
        .every((m) => m.exact_score !== undefined)

      if (!allScoresEntered) {
        // Navigate to tiebreaker resolution page
        onTiebreakerNeeded(
          selectedGroupIndex,
          tiedTeams.map((t) => t.name)
        )
        return
      }
    }

    // Mark group as complete
    onGroupComplete(currentGroup.group_id)

    // Move to next group or finish
    if (selectedGroupIndex < groups.length - 1) {
      setSelectedGroupIndex(selectedGroupIndex + 1)
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="rounded-lg border border-ps-border bg-ps-surface p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-ps-text">Group Stage Progress</span>
          <span className="font-mono text-xs font-semibold text-ps-amber">
            {completedGroups}/{groups.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ps-chip">
          <div
            className={`h-full transition-all duration-300 ${pickColor === 'amber' ? 'bg-ps-amber' : 'bg-ps-green'}`}
            style={{ width: `${(completedGroups / groups.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Group selector tabs */}
      <div className="flex flex-wrap gap-2">
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
                      ? `${pickColor === 'amber' ? 'bg-ps-amber/15 text-ps-amber hover:bg-ps-amber/20' : 'bg-ps-green/15 text-ps-green hover:bg-ps-green/20'}`
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
      <div className="rounded-lg border border-ps-border bg-ps-surface p-3">
        <h2 className="text-base font-bold text-ps-text">
          {currentGroup.group_name}
        </h2>
        <p className="mt-1 text-xs text-ps-text-sec">
          Pick the result for each match (6 matches)
        </p>
      </div>

      {/* Match cards */}
      <div className="space-y-3">
        {currentGroup.matches.map((match) => (
          <MatchCard
            key={match.match_id}
            match={match}
            isHighlighted={highlightedMatchId === match.match_id}
            needsScore={needsScores && matchInvolvesTiedTeams(match, tiedTeams)}
            pickColor={pickColor}
            onResultChange={(result) => handleResultChange(match.match_id, result)}
            onScoreEntry={(home, away) => handleScoreEntry(match.match_id, home, away)}
          />
        ))}
      </div>

      {/* Standings preview */}
      {standings.length > 0 && (
        <div className="rounded-lg border border-ps-border bg-ps-surface p-3">
          <h3 className="mb-2 text-sm font-semibold text-ps-text">
            Predicted Standings
          </h3>
          <StandingsTable standings={standings} />
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!currentGroupComplete}
        className={`
          w-full rounded-lg px-6 py-3 text-sm font-semibold transition-all
          ${
            currentGroupComplete
              ? 'bg-ps-text text-ps-bg hover:opacity-90'
              : 'cursor-not-allowed bg-ps-chip text-ps-text-ter'
          }
        `}
      >
        {needsScores && !currentGroup.has_tiebreaker_scores ? (
          <>
            Continue
            <span className="ml-2 text-xs">⚠️ Tiebreaker needed</span>
          </>
        ) : selectedGroupIndex === groups.length - 1 ? (
          'Complete Group Stage →'
        ) : (
          `Continue to Group ${groups[selectedGroupIndex + 1]?.group_id} →`
        )}
      </button>
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
            <span className="w-6 text-center font-mono text-xs font-semibold text-ps-text-sec">
              {team.position}
            </span>
            <span className="text-sm font-semibold text-ps-text">{team.name}</span>
          </div>
          <span className="font-mono text-xs font-semibold text-ps-text-sec">
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

/**
 * Check if two results are compatible (same type)
 * Compatible means we can keep the exact score
 */
function resultsCompatible(oldResult: MatchResult, newResult: MatchResult): boolean {
  if (!oldResult || !newResult) return false
  return oldResult === newResult
}

/**
 * Check if a match involves any of the tied teams
 */
function matchInvolvesTiedTeams(
  match: MatchPrediction,
  tiedTeams: TeamStanding[]
): boolean {
  return tiedTeams.some(
    (t) => t.name === match.home_team || t.name === match.away_team
  )
}

/**
 * Calculate standings from match results
 */
function calculateStandings(group: GroupData): TeamStanding[] {
  const points: Record<string, number> = {}

  // Initialize points for all teams
  group.teams.forEach((team) => {
    points[team] = 0
  })

  // Calculate points from match results
  group.matches.forEach((match) => {
    if (!match.result) return

    if (match.result === 'home_win') {
      points[match.home_team] = (points[match.home_team] || 0) + 3
    } else if (match.result === 'away_win') {
      points[match.away_team] = (points[match.away_team] || 0) + 3
    } else if (match.result === 'draw') {
      points[match.home_team] = (points[match.home_team] || 0) + 1
      points[match.away_team] = (points[match.away_team] || 0) + 1
    }
  })

  // Convert to array and sort by points
  const standings = Object.entries(points)
    .map(([name, pts]) => ({ name, points: pts, position: 0 }))
    .sort((a, b) => b.points - a.points)

  // Assign positions
  standings.forEach((team, index) => {
    team.position = index + 1
  })

  return standings
}

/**
 * Detect teams that are tied on points
 */
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
