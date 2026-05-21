'use client'

/**
 * Knockout Stage Predictor
 *
 * Guides user through picking winners for each knockout round.
 * Automatically populates next round based on previous picks.
 *
 * Flow:
 * 1. R32: Show all 16 matches with team names from groups
 * 2. R16: Show 8 matches, pre-filled with R32 winners
 * 3. QF: Show 4 matches, pre-filled with R16 winners
 * 4. SF: Show 2 matches
 * 5. Final + Third Place
 * 6. Champion
 */

import { useState, useEffect } from 'react'
import {
  KnockoutPrediction,
  BracketMatch,
} from '@/lib/tournament/bracket/types'
import { TournamentTemplate } from '@/lib/tournament/bracket/templates/types'
import KnockoutMatchCard from './KnockoutMatchCard'

interface KnockoutStagePredictorProps {
  template: TournamentTemplate
  initialMatches: Record<string, BracketMatch[]> // Pre-generated R32 matches from groups
  initialPredictions?: Record<string, KnockoutPrediction[]>
  onStageComplete: (stageId: string, predictions: KnockoutPrediction[]) => void
  onAllStagesComplete: (champion: string) => void
}

export default function KnockoutStagePredictor({
  template,
  initialMatches,
  initialPredictions = {},
  onStageComplete,
  onAllStagesComplete,
}: KnockoutStagePredictorProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [predictions, setPredictions] = useState<
    Record<string, KnockoutPrediction[]>
  >(initialPredictions)
  const [champion, setChampion] = useState<string | null>(null)

  const currentStage = template.knockoutStages[currentStageIndex]

  // Generate matches for current stage
  const currentMatches = getMatchesForStage(
    currentStage.id,
    initialMatches,
    predictions,
    template
  )

  // Handle winner selection
  function handleWinnerSelect(matchIndex: number, winner: string) {
    const updated = [...(predictions[currentStage.id] || [])]

    // Ensure array is long enough
    while (updated.length <= matchIndex) {
      updated.push({
        match_number: updated.length + 1,
        home_team: 'TBD',
        away_team: 'TBD',
        winner: null,
      })
    }

    const match = currentMatches[matchIndex]
    updated[matchIndex] = {
      match_number: matchIndex + 1,
      home_team: match.home_team,
      away_team: match.away_team,
      winner,
    }

    setPredictions((prev) => ({
      ...prev,
      [currentStage.id]: updated,
    }))
  }

  // Check if current stage is complete
  const isStageComplete = currentMatches.every((match) => {
    const prediction = predictions[currentStage.id]?.find(
      (p) => p.match_number === currentMatches.indexOf(match) + 1
    )
    return prediction?.winner != null
  })

  // Handle stage completion
  function handleContinue() {
    if (!isStageComplete) {
      alert('Please pick winners for all matches before continuing.')
      return
    }

    const stagePredictions = predictions[currentStage.id]
    onStageComplete(currentStage.id, stagePredictions)

    // Check if this is the final
    if (currentStage.id === 'final') {
      const finalWinner = stagePredictions.find((p) => p.match_number === 1)?.winner

      if (finalWinner) {
        setChampion(finalWinner)
        onAllStagesComplete(finalWinner)
      }
    } else if (currentStageIndex < template.knockoutStages.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1)
    }
  }

  // Progress indicator
  const completedStages = Object.keys(predictions).filter(
    (stageId) => stageId !== 'third_place' // Third place is optional
  ).length
  const totalStages = template.knockoutStages.filter(
    (s) => s.id !== 'third_place'
  ).length
  const progressPercentage = (completedStages / totalStages) * 100

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="rounded-lg border border-ps-ink/10 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-ps-ink">Knockout Progress</span>
          <span className="text-ps-ink/60">
            {completedStages} / {totalStages} stages
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ps-ink/5">
          <div
            className="h-full bg-ps-amber transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Stage header */}
      <div className="rounded-lg border border-ps-ink/10 bg-white p-4">
        <h2 className="font-display text-xl font-extrabold text-ps-ink">
          {currentStage.name}
        </h2>
        <p className="mt-1 text-sm text-ps-ink/60">
          Pick the winner for each match ({currentStage.matchCount}{' '}
          {currentStage.matchCount === 1 ? 'match' : 'matches'})
        </p>
      </div>

      {/* Matches */}
      <div className="space-y-3">
        {currentMatches.map((match, index) => {
          const prediction = predictions[currentStage.id]?.find(
            (p) => p.match_number === index + 1
          )

          return (
            <KnockoutMatchCard
              key={`${currentStage.id}-${index}`}
              matchNumber={index + 1}
              homeTeam={match.home_team || 'TBD'}
              awayTeam={match.away_team || 'TBD'}
              selectedWinner={prediction?.winner || null}
              onWinnerSelect={(winner) => handleWinnerSelect(index, winner)}
            />
          )
        })}
      </div>

      {/* Champion display (if final complete) */}
      {champion && (
        <div className="rounded-lg border border-ps-amber/30 bg-ps-amber/10 p-6 text-center">
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ps-ink/60">
            Your Predicted Champion
          </p>
          <p className="font-display text-2xl font-extrabold text-ps-ink">
            {champion}
          </p>
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!isStageComplete}
        className={`
          w-full rounded-lg px-6 py-4 font-semibold transition-all
          ${
            isStageComplete
              ? 'bg-ps-amber text-ps-ink hover:bg-ps-amber/90 hover:shadow-md'
              : 'cursor-not-allowed bg-ps-ink/10 text-ps-ink/40'
          }
        `}
      >
        {currentStage.id === 'final'
          ? 'Complete Bracket →'
          : `Continue to ${template.knockoutStages[currentStageIndex + 1]?.name || 'Next Stage'} →`}
      </button>
    </div>
  )
}

// ============================================================================
// Helper: Generate Matches for Stage
// ============================================================================

/**
 * Generate or derive matches for a knockout stage
 *
 * - First stage (R32): Uses pre-generated matches from groups
 * - Later stages: Derives from previous stage winners
 */
function getMatchesForStage(
  stageId: string,
  initialMatches: Record<string, BracketMatch[]>,
  predictions: Record<string, KnockoutPrediction[]>,
  template: TournamentTemplate
): BracketMatch[] {
  // For first knockout stage (usually R32), use initial matches
  if (initialMatches[stageId]) {
    return initialMatches[stageId]
  }

  // For later stages, derive from previous stage winners
  const stage = template.knockoutStages.find((s) => s.id === stageId)
  if (!stage) return []

  // Find previous stage
  const previousStageId = findPreviousStageId(stageId, template)
  if (!previousStageId) return []

  const previousPredictions = predictions[previousStageId]
  if (!previousPredictions) {
    // Previous stage not complete yet, return TBD matches
    return Array.from({ length: stage.matchCount }, (_, i) => ({
      match_id: `${stageId}-${i + 1}`,
      home_team: 'TBD',
      away_team: 'TBD',
      slot_info: {
        home_source: `Winner of ${previousStageId} Match ${i * 2 + 1}`,
        away_source: `Winner of ${previousStageId} Match ${i * 2 + 2}`,
      },
    }))
  }

  // Generate matches from previous winners
  const matches: BracketMatch[] = []
  for (let i = 0; i < stage.matchCount; i++) {
    const homeTeam = previousPredictions[i * 2]?.winner || 'TBD'
    const awayTeam = previousPredictions[i * 2 + 1]?.winner || 'TBD'

    matches.push({
      match_id: `${stageId}-${i + 1}`,
      home_team: homeTeam,
      away_team: awayTeam,
      slot_info: {
        home_source: `Winner of ${previousStageId} Match ${i * 2 + 1}`,
        away_source: `Winner of ${previousStageId} Match ${i * 2 + 2}`,
      },
    })
  }

  return matches
}

/**
 * Find the stage that feeds into this stage
 */
function findPreviousStageId(
  stageId: string,
  template: TournamentTemplate
): string | null {
  const currentIndex = template.knockoutStages.findIndex((s) => s.id === stageId)
  if (currentIndex <= 0) return null

  // Special case: Final is fed by Semi Finals (skip third place)
  if (stageId === 'final') {
    const sfStage = template.knockoutStages.find((s) => s.id === 'sf')
    return sfStage?.id || null
  }

  return template.knockoutStages[currentIndex - 1].id
}
