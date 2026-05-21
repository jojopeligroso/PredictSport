'use client'

/**
 * Group Stage Predictor
 *
 * Main component for predicting all group stage matches.
 * User flow:
 * 1. Select a group
 * 2. Predict all match scores
 * 3. View calculated standings
 * 4. Save and move to next group
 *
 * Features:
 * - Smart score collection (only ask for extras when needed)
 * - Real-time standings preview
 * - Checkpoint saves after each group
 * - Tiebreaker warnings
 */

import { useState, useEffect } from 'react'
import {
  GroupPredictionData,
  MatchPrediction,
  TeamWithStats,
} from '@/lib/tournament/bracket/types'
import { TournamentTemplate } from '@/lib/tournament/bracket/templates/types'
import {
  calculateGroupStandings,
  detectTiebreakersNeeded,
} from '@/lib/tournament/bracket/engine'
import GroupMatchCard from './GroupMatchCard'
import LiveGroupStandings from './LiveGroupStandings'

interface GroupStagePredictorProps {
  template: TournamentTemplate
  initialGroups?: Record<string, GroupPredictionData>
  onGroupComplete: (groupId: string, data: GroupPredictionData) => void
  onAllGroupsComplete: () => void
}

export default function GroupStagePredictor({
  template,
  initialGroups = {},
  onGroupComplete,
  onAllGroupsComplete,
}: GroupStagePredictorProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const [groupPredictions, setGroupPredictions] =
    useState<Record<string, GroupPredictionData>>(initialGroups)
  const [currentMatches, setCurrentMatches] = useState<MatchPrediction[]>([])
  const [currentStandings, setCurrentStandings] = useState<TeamWithStats[]>([])
  const [tiebreakerTypes, setTiebreakerTypes] = useState<Set<string>>(new Set())
  const [showStandings, setShowStandings] = useState(false)

  if (!template.groups) {
    return <div className="text-ps-ink">No group stage configured.</div>
  }

  const { count: groupCount, teamsPerGroup } = template.groups
  const groupLabels = Array.from({ length: groupCount }, (_, i) =>
    String.fromCharCode(65 + i)
  ) // A, B, C, ...

  // Initialize current group data
  useEffect(() => {
    const groupData = groupPredictions[selectedGroup]

    if (groupData) {
      // Load existing predictions
      setCurrentMatches(groupData.match_predictions)
      recalculateStandings(groupData.match_predictions, groupData.team_names)
    } else {
      // Initialize empty group
      const teams = generateTeamNames(selectedGroup, teamsPerGroup)
      const matches = generateGroupMatches(teams)
      setCurrentMatches(matches)
      setCurrentStandings([])
    }

    // Detect which tiebreakers might be needed
    const needed = detectTiebreakersNeeded(currentMatches, template.tiebreakers)
    setTiebreakerTypes(needed)
  }, [selectedGroup])

  // Recalculate standings when predictions change
  function recalculateStandings(matches: MatchPrediction[], teams: string[]) {
    // Only calculate if all matches have scores
    const allComplete = matches.every(
      (m) => m.home_score !== null && m.away_score !== null
    )

    if (allComplete) {
      const standings = calculateGroupStandings(matches, template.tiebreakers, teams)
      setCurrentStandings(standings)
      setShowStandings(true)
    } else {
      setCurrentStandings([])
      setShowStandings(false)
    }
  }

  // Handle score update
  function handleScoreUpdate(
    matchIndex: number,
    homeScore: number | null,
    awayScore: number | null,
    homeTries?: number,
    awayTries?: number
  ) {
    const updated = [...currentMatches]
    updated[matchIndex] = {
      ...updated[matchIndex],
      home_score: homeScore,
      away_score: awayScore,
      home_tries: homeTries,
      away_tries: awayTries,
    }

    setCurrentMatches(updated)

    // Recalculate standings
    const groupData = groupPredictions[selectedGroup]
    const teams = groupData?.team_names || generateTeamNames(selectedGroup, teamsPerGroup)
    recalculateStandings(updated, teams)
  }

  // Save group and move to next
  function handleSaveGroup() {
    const allComplete = currentMatches.every(
      (m) => m.home_score !== null && m.away_score !== null
    )

    if (!allComplete) {
      alert('Please predict all matches before saving this group.')
      return
    }

    const groupData: GroupPredictionData = {
      group_id: selectedGroup,
      team_names:
        groupPredictions[selectedGroup]?.team_names ||
        generateTeamNames(selectedGroup, teamsPerGroup),
      match_predictions: currentMatches,
    }

    setGroupPredictions((prev) => ({
      ...prev,
      [selectedGroup]: groupData,
    }))

    onGroupComplete(selectedGroup, groupData)

    // Move to next group or complete
    const currentIndex = groupLabels.indexOf(selectedGroup)
    if (currentIndex < groupLabels.length - 1) {
      setSelectedGroup(groupLabels[currentIndex + 1])
      setShowStandings(false)
    } else {
      // All groups complete
      onAllGroupsComplete()
    }
  }

  // Progress indicator
  const completedGroups = Object.keys(groupPredictions).length
  const progressPercentage = (completedGroups / groupCount) * 100

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="rounded-lg border border-ps-ink/10 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-ps-ink">Group Stage Progress</span>
          <span className="text-ps-ink/60">
            {completedGroups} / {groupCount} groups
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ps-ink/5">
          <div
            className="h-full bg-ps-amber transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Group selector */}
      <div className="flex flex-wrap gap-2">
        {groupLabels.map((label) => {
          const isSelected = label === selectedGroup
          const isComplete = !!groupPredictions[label]

          return (
            <button
              key={label}
              onClick={() => {
                setSelectedGroup(label)
                setShowStandings(false)
              }}
              className={`
                rounded-lg px-4 py-2 font-semibold transition-all
                ${
                  isSelected
                    ? 'bg-ps-amber text-ps-ink shadow-md'
                    : isComplete
                      ? 'bg-ps-green/10 text-ps-green hover:bg-ps-green/20'
                      : 'bg-white text-ps-ink/60 hover:bg-ps-ink/5'
                }
                border ${isSelected ? 'border-ps-amber' : 'border-ps-ink/10'}
              `}
            >
              Group {label}
              {isComplete && ' ✓'}
            </button>
          )
        })}
      </div>

      {/* Current group header */}
      <div className="rounded-lg border border-ps-ink/10 bg-white p-4">
        <h2 className="font-display text-xl font-extrabold text-ps-ink">
          Group {selectedGroup}
        </h2>
        <p className="mt-1 text-sm text-ps-ink/60">
          Predict all {currentMatches.length} match scores
        </p>
      </div>

      {/* Match predictions */}
      <div className="space-y-3">
        {currentMatches.map((match, index) => (
          <GroupMatchCard
            key={index}
            match={match}
            onScoreUpdate={(homeScore, awayScore, homeTries, awayTries) =>
              handleScoreUpdate(index, homeScore, awayScore, homeTries, awayTries)
            }
            needsTries={tiebreakerTypes.has('tries_scored')}
          />
        ))}
      </div>

      {/* Standings preview */}
      {showStandings && currentStandings.length > 0 && (
        <div className="rounded-lg border border-ps-green/20 bg-ps-green/5 p-4">
          <h3 className="mb-3 font-semibold text-ps-ink">
            Predicted Standings (Group {selectedGroup})
          </h3>
          <LiveGroupStandings
            standings={currentStandings}
            tiebreakers={template.tiebreakers}
            highlightTies={true}
            highlightPositions={[1, 2]}
          />

          {/* Tiebreaker warning */}
          {currentStandings.some((team, index) => {
            const nextTeam = currentStandings[index + 1]
            return (
              nextTeam &&
              team.points === nextTeam.points &&
              team.goalDifference === nextTeam.goalDifference &&
              team.goalsFor === nextTeam.goalsFor
            )
          }) && (
            <div className="mt-3 rounded border border-ps-amber/30 bg-ps-amber/10 p-3 text-xs text-ps-ink/80">
              ⚠️ Warning: Some teams have identical stats. Tiebreakers were applied.
              Consider adjusting scores to make standings more realistic.
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSaveGroup}
        disabled={!showStandings}
        className={`
          w-full rounded-lg px-6 py-4 font-semibold transition-all
          ${
            showStandings
              ? 'bg-ps-amber text-ps-ink hover:bg-ps-amber/90 hover:shadow-md'
              : 'cursor-not-allowed bg-ps-ink/10 text-ps-ink/40'
          }
        `}
      >
        {completedGroups === groupCount - 1 ? 'Complete Group Stage →' : 'Save & Next Group →'}
      </button>

      {/* Help text */}
      <p className="text-center text-xs text-ps-ink/60">
        Your progress is saved automatically. You can return later to continue.
      </p>
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate team names for a group (placeholder until actual teams loaded)
 */
function generateTeamNames(groupLabel: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Team ${groupLabel}${i + 1}`)
}

/**
 * Generate all matches for a group (round-robin)
 */
function generateGroupMatches(teams: string[]): MatchPrediction[] {
  const matches: MatchPrediction[] = []
  let matchCounter = 0

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        match_id: `match_${matchCounter++}`,
        home_team: teams[i],
        away_team: teams[j],
        outcome: 'draw',  // Default outcome
        home_score: null,
        away_score: null,
      })
    }
  }

  return matches
}
