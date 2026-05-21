'use client'

/**
 * Test client for W/D/L bracket flow
 *
 * Provides isolated testing environment with mock data
 * to verify group prediction and third-place ranking logic.
 */

import { useState } from 'react'
import GroupResultsStepV2, {
  GroupData,
  MatchPrediction,
} from '@/components/tournament/bracket/GroupResultsStepV2'
import TiebreakerResolutionPage from '@/components/tournament/bracket/TiebreakerResolutionPage'
import ThirdPlaceRankingStep from '@/components/tournament/bracket/ThirdPlaceRankingStep'

type TestStep = 'groups' | 'tiebreaker' | 'third_place' | 'complete'

// Mock FIFA WC 2026 groups (simplified to 3 groups for testing)
const MOCK_GROUPS: GroupData[] = [
  {
    group_id: 'A',
    group_name: 'Group A',
    teams: ['France', 'Denmark', 'Peru', 'Australia'],
    matches: generateMatches('A', ['France', 'Denmark', 'Peru', 'Australia']),
    has_tiebreaker_scores: false,
  },
  {
    group_id: 'B',
    group_name: 'Group B',
    teams: ['Spain', 'Portugal', 'Iran', 'Morocco'],
    matches: generateMatches('B', ['Spain', 'Portugal', 'Iran', 'Morocco']),
    has_tiebreaker_scores: false,
  },
  {
    group_id: 'C',
    group_name: 'Group C',
    teams: ['Brazil', 'Switzerland', 'Costa Rica', 'Serbia'],
    matches: generateMatches('C', ['Brazil', 'Switzerland', 'Costa Rica', 'Serbia']),
    has_tiebreaker_scores: false,
  },
]

export default function BracketTestClient() {
  const [currentStep, setCurrentStep] = useState<TestStep>('groups')
  const [groups, setGroups] = useState<GroupData[]>(MOCK_GROUPS)
  const [qualifiedThirds, setQualifiedThirds] = useState<string[]>([])
  const [saveLog, setSaveLog] = useState<string[]>([])
  const [tiebreakerGroupIndex, setTiebreakerGroupIndex] = useState<number | null>(null)
  const [tiebreakerTeams, setTiebreakerTeams] = useState<string[]>([])
  const [pickColor] = useState<'green' | 'amber'>('green')

  function handleGroupUpdate(updatedGroups: GroupData[]) {
    setGroups(updatedGroups)
    logSave('Groups auto-saved')
  }

  function handleGroupComplete(groupId: string) {
    logSave(`Group ${groupId} completed`)
  }

  function handleTiebreakerNeeded(groupIndex: number, tiedTeams: string[]) {
    logSave(`Tiebreaker needed for Group ${groups[groupIndex].group_id} - ${tiedTeams.join(', ')}`)
    setTiebreakerGroupIndex(groupIndex)
    setTiebreakerTeams(tiedTeams)
    setCurrentStep('tiebreaker')
  }

  function handleTiebreakerResolved(updatedGroup: GroupData) {
    const updatedGroups = [...groups]
    if (tiebreakerGroupIndex !== null) {
      updatedGroups[tiebreakerGroupIndex] = {
        ...updatedGroup,
        has_tiebreaker_scores: true,
      }
    }
    setGroups(updatedGroups)
    logSave(`Tiebreaker resolved for Group ${updatedGroup.group_id}`)
    setCurrentStep('groups')
    setTiebreakerGroupIndex(null)
    setTiebreakerTeams([])
  }

  function handleAllGroupsComplete() {
    logSave('All groups complete - moving to third-place ranking')
    setCurrentStep('third_place')
  }

  function handleThirdPlaceComplete(qualified: string[]) {
    setQualifiedThirds(qualified)
    logSave(`Third-place ranking complete - ${qualified.length} teams qualified`)
    setCurrentStep('complete')
  }

  function logSave(message: string) {
    const timestamp = new Date().toLocaleTimeString()
    setSaveLog((prev) => [...prev, `[${timestamp}] ${message}`])
  }

  function reset() {
    setCurrentStep('groups')
    setGroups(MOCK_GROUPS.map(g => ({
      ...g,
      matches: generateMatches(g.group_id, g.teams),
      has_tiebreaker_scores: false,
    })))
    setQualifiedThirds([])
    setSaveLog([])
  }

  return (
    <div className="min-h-screen bg-ps-bg px-4 py-8">
      <div className="mx-auto max-w-[480px]">
        {/* Test header */}
        <div className="mb-6 rounded-lg border-2 border-ps-amber/50 bg-ps-amber/10 p-4">
          <h1 className="mb-2 font-display text-2xl font-extrabold text-ps-text">
            🧪 Bracket Test Page
          </h1>
          <p className="text-sm text-ps-text-sec">
            Testing W/D/L group prediction flow with smart tiebreakers
          </p>
          <div className="mt-3 flex gap-2">
            <div className="rounded bg-ps-surface px-2 py-1 text-xs">
              <span className="font-semibold">Step:</span> {currentStep}
            </div>
            <button
              onClick={reset}
              className="ml-auto rounded bg-ps-text px-3 py-1 text-xs font-semibold text-ps-bg"
            >
              Reset Test
            </button>
          </div>
        </div>

        {/* Step content */}
        {currentStep === 'groups' && (
          <div>
            <GroupResultsStepV2
              groups={groups}
              pickColor={pickColor}
              onUpdate={handleGroupUpdate}
              onGroupComplete={handleGroupComplete}
              onTiebreakerNeeded={handleTiebreakerNeeded}
            />

            {/* Manual trigger for testing third-place */}
            {groups.every(g => g.matches.every(m => m.result)) && (
              <button
                onClick={handleAllGroupsComplete}
                className="mt-4 w-full rounded-lg border-2 border-ps-green bg-ps-green/10 px-6 py-3 text-sm font-semibold text-ps-green"
              >
                🧪 Test: Move to Third-Place Ranking →
              </button>
            )}
          </div>
        )}

        {currentStep === 'tiebreaker' && tiebreakerGroupIndex !== null && (
          <TiebreakerResolutionPage
            group={groups[tiebreakerGroupIndex]}
            tiedTeams={tiebreakerTeams}
            onResolve={handleTiebreakerResolved}
            onBack={() => setCurrentStep('groups')}
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
          <div className="space-y-4">
            <div className="rounded-lg border border-ps-green/30 bg-ps-green/5 p-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ps-green/20 mx-auto">
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="mb-2 text-lg font-bold text-ps-text">
                Test Complete!
              </h2>
              <p className="text-sm text-ps-text-sec">
                Group stage and third-place ranking flow completed successfully
              </p>
            </div>

            <div className="rounded-lg border border-ps-border bg-ps-surface p-4">
              <h3 className="mb-3 text-sm font-semibold text-ps-text">
                Qualified Third-Place Teams
              </h3>
              <div className="space-y-1">
                {qualifiedThirds.map((team, index) => (
                  <div
                    key={team}
                    className="flex items-center gap-2 rounded bg-ps-bg px-3 py-2"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ps-green text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm text-ps-text">{team}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={reset}
              className="w-full rounded-lg bg-ps-text px-6 py-3 text-sm font-semibold text-ps-bg"
            >
              Run Test Again
            </button>
          </div>
        )}

        {/* Save log */}
        <div className="mt-8 rounded-lg border border-ps-border bg-ps-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ps-text">
            <span>📝</span>
            <span>Auto-Save Log</span>
            {saveLog.length > 0 && (
              <span className="ml-auto font-mono text-xs text-ps-green">
                {saveLog.length} events
              </span>
            )}
          </h3>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {saveLog.length === 0 ? (
              <p className="text-xs text-ps-text-ter">No saves yet</p>
            ) : (
              saveLog.map((log, index) => (
                <div
                  key={index}
                  className="rounded bg-ps-bg px-2 py-1 font-mono text-xs text-ps-text-sec"
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Debug: Group data */}
        <details className="mt-4 rounded-lg border border-ps-border bg-ps-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ps-text">
            🐛 Debug: Group Data (JSON)
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded bg-ps-bg p-3 text-xs">
            {JSON.stringify(groups, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}

// ============================================================================
// Helper: Generate matches for a group
// ============================================================================

function generateMatches(groupId: string, teams: string[]): MatchPrediction[] {
  const matches: MatchPrediction[] = []
  let matchNum = 0

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchNum++
      matches.push({
        match_id: `${groupId}-m${matchNum}`,
        home_team: teams[i],
        away_team: teams[j],
        result: null,
      })
    }
  }

  return matches
}
