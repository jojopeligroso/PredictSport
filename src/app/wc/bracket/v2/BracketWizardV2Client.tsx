'use client'

/**
 * Client component wrapper for BracketWizardV2
 *
 * Handles API calls for saving drafts.
 */

import { useCallback } from 'react'
import BracketWizardV2 from '@/components/tournament/bracket/BracketWizardV2'

interface BracketWizardV2ClientProps {
  competitionId: string
  classificationId: string
  existingData?: any
}

export default function BracketWizardV2Client({
  competitionId,
  classificationId,
  existingData,
}: BracketWizardV2ClientProps) {
  const handleAutoSave = useCallback(
    async (data: any) => {
      try {
        const response = await fetch('/api/bracket/checkpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competition_id: competitionId,
            bracket_data: {
              template_id: 'fifa-world-cup-2026',
              ...data,
            },
          }),
        })

        if (!response.ok) {
          console.error('Auto-save failed:', await response.text())
        }
      } catch (error) {
        console.error('Auto-save error:', error)
      }
    },
    [competitionId]
  )

  return (
    <BracketWizardV2
      competitionId={competitionId}
      classificationId={classificationId}
      existingData={existingData}
      onAutoSave={handleAutoSave}
    />
  )
}
