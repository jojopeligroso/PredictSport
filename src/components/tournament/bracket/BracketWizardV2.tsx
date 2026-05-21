'use client'

/**
 * Bracket Wizard V2 - W/D/L Prediction Flow
 *
 * Replaces manual ranking with match prediction.
 * Uses GroupResultsStepV2, TiebreakerResolutionPage, ThirdPlaceRankingStep.
 *
 * Key differences from V1:
 * - Match predictions (W/D/L) instead of team rankings
 * - Auto-calculates standings from match results
 * - Smart tiebreaker detection and resolution
 * - Auto-calculates best thirds (no manual selection)
 * - Better mobile UX and accessibility
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import GroupResultsStepV2, { GroupData } from './GroupResultsStepV2'
import TiebreakerResolutionPage from './TiebreakerResolutionPage'
import ThirdPlaceRankingStep from './ThirdPlaceRankingStep'
import { WC2026_GROUPS } from '@/lib/bracket/adapters/fifa-world-cup-2026'

interface BracketWizardV2Props {
  classificationId: string
  competitionId: string
  existingData?: {
    groupsV2?: GroupData[]
    champion?: string
    thirdPlace?: string
  }
  onAutoSave?: (data: any) => Promise<void>
}

type Step = 'groups' | 'tiebreaker' | 'third_place' | 'complete'

export default function BracketWizardV2({
  classificationId,
  competitionId,
  existingData,
  onAutoSave,
}: BracketWizardV2Props) {
  const [currentStep, setCurrentStep] = useState<Step>('groups')
  const [groups, setGroups] = useState<GroupData[]>(() =>
    existingData?.groupsV2 || initializeGroups()
  )
  const [tiebreakerContext, setTiebreakerContext] = useState<{
    groupIndex: number
    teams: string[]
  } | null>(null)
  const [qualifiedThirds, setQualifiedThirds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Auto-save when groups change (skip initial mount)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (onAutoSave) {
      const timer = setTimeout(() => {
        onAutoSave({ groupsV2: groups }).catch(console.error)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [groups, onAutoSave])

  function handleGroupsUpdate(updated: GroupData[]) {
    setGroups(updated)
  }

  function handleGroupComplete(groupId: string) {
    console.log(`Group ${groupId} complete`)
  }

  function handleTiebreakerNeeded(groupIndex: number, tiedTeams: string[]) {
    setTiebreakerContext({ groupIndex, teams: tiedTeams })
    setCurrentStep('tiebreaker')
  }

  function handleTiebreakerResolved(updatedGroup: GroupData) {
    if (tiebreakerContext) {
      const updated = [...groups]
      updated[tiebreakerContext.groupIndex] = {
        ...updatedGroup,
        has_tiebreaker_scores: true,
      }
      setGroups(updated)
    }
    setCurrentStep('groups')
    setTiebreakerContext(null)
  }

  function handleAllGroupsComplete() {
    setCurrentStep('third_place')
  }

  function handleThirdPlaceComplete(qualified: string[]) {
    setQualifiedThirds(qualified)
    setCurrentStep('complete')
  }

  const allGroupsComplete = groups.every(g =>
    g.matches.every(m => m.result !== null)
  )

  return (
    <div className="mx-auto max-w-[480px]">
      {/* Step indicator */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto">
        <StepBadge label="Groups" active={currentStep === 'groups'} complete={allGroupsComplete} />
        <StepBadge label="Thirds" active={currentStep === 'third_place'} complete={qualifiedThirds.length === 8} />
        <StepBadge label="Done" active={currentStep === 'complete'} complete={currentStep === 'complete'} />
      </div>

      {/* Step content */}
      {currentStep === 'groups' && (
        <div>
          <GroupResultsStepV2
            groups={groups}
            pickColor="green"
            onUpdate={handleGroupsUpdate}
            onGroupComplete={handleGroupComplete}
            onTiebreakerNeeded={handleTiebreakerNeeded}
          />

          {/* Show "Continue to Third Place" button when all groups done */}
          {allGroupsComplete && (
            <button
              onClick={handleAllGroupsComplete}
              className="mt-4 w-full rounded-lg bg-ps-text px-6 py-3 text-sm font-semibold text-ps-bg hover:opacity-90"
            >
              Continue to Third-Place Ranking →
            </button>
          )}
        </div>
      )}

      {currentStep === 'tiebreaker' && tiebreakerContext && (
        <TiebreakerResolutionPage
          group={groups[tiebreakerContext.groupIndex]}
          tiedTeams={tiebreakerContext.teams}
          onResolve={handleTiebreakerResolved}
          onBack={() => {
            setCurrentStep('groups')
            setTiebreakerContext(null)
          }}
        />
      )}

      {currentStep === 'third_place' && (
        <ThirdPlaceRankingStep
          groups={groups}
          onComplete={handleThirdPlaceComplete}
          onBack={() => setCurrentStep('groups')}
        />
      )}

      {currentStep === 'complete' && (
        <div className="space-y-4 py-8">
          <div className="rounded-lg border border-ps-green/30 bg-ps-green/5 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ps-green/20">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="mb-2 text-lg font-bold text-ps-text">
              Group Stage Complete!
            </h2>
            <p className="text-sm text-ps-text-sec">
              Your predictions have been saved. You can continue to knockout stages.
            </p>
          </div>

          <div className="rounded-lg border border-ps-border bg-ps-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-ps-text">
              Qualified Third-Place Teams (Top 8)
            </h3>
            <div className="flex flex-wrap gap-2">
              {qualifiedThirds.map((team, i) => (
                <div
                  key={team}
                  className="rounded-full bg-ps-green/15 px-3 py-1 text-xs font-semibold text-ps-green"
                >
                  {i + 1}. {team}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              // TODO: Navigate to knockout stages or submit
              alert('Knockout stages coming soon!')
            }}
            className="w-full rounded-lg bg-ps-text px-6 py-3 text-sm font-semibold text-ps-bg hover:opacity-90"
          >
            Continue to Knockout Stages →
          </button>
        </div>
      )}
    </div>
  )
}

// Helper: Step badge
function StepBadge({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return (
    <div
      className={`
        whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors
        ${active ? 'bg-ps-text text-ps-bg' : complete ? 'bg-ps-green/15 text-ps-green' : 'bg-ps-chip text-ps-text-ter'}
      `}
    >
      {complete && !active && '✓ '}
      {label}
    </div>
  )
}

// Helper: Initialize empty groups
function initializeGroups(): GroupData[] {
  return WC2026_GROUPS.map(group => ({
    group_id: group.groupId,
    group_name: group.name,
    teams: group.teams.map(t => t.name),
    team_names: group.teams.map(t => t.name), // Compatibility
    matches: generateGroupMatches(group.groupId, group.teams.map(t => t.name)),
    match_predictions: [], // Compatibility
    has_tiebreaker_scores: false,
  }))
}

// Helper: Generate round-robin matches for a group
function generateGroupMatches(groupId: string, teams: string[]) {
  const matches: any[] = []
  let matchNum = 0

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchNum++
      matches.push({
        match_id: `${groupId}-m${matchNum}`,
        home_team: teams[i],
        away_team: teams[j],
        result: null,
        outcome: 'home', // Compatibility
      })
    }
  }

  return matches
}
