import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BracketWizardV2Client from './BracketWizardV2Client'

export const metadata: Metadata = {
  title: 'Bracket Prediction - WC 2026',
  description: 'Predict the FIFA World Cup 2026 bracket',
}

/**
 * WC 2026 Bracket Prediction Page (V2)
 *
 * New W/D/L prediction flow with match-based predictions.
 * Route: /wc/bracket/v2
 */
export default async function BracketV2Page() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wc/bracket/v2')
  }

  // TODO: Fetch competition ID from URL or default WC 2026 competition
  const competitionId = 'wc-2026' // Placeholder

  // Fetch existing bracket if any
  const { data: existingBracket } = await supabase
    .from('bracket_predictions')
    .select('*')
    .eq('competition_id', competitionId)
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-ps-bg px-4 py-8">
      <div className="mx-auto max-w-[480px]">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-ps-text">
            FIFA World Cup 2026 Bracket
          </h1>
          <p className="mt-1 text-sm text-ps-text-sec">
            Predict match results for all 12 groups
          </p>
        </header>

        <BracketWizardV2Client
          competitionId={competitionId}
          classificationId="full-bracket"
          existingData={existingBracket?.bracket_data}
        />
      </div>
    </div>
  )
}
