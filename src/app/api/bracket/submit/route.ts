import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BracketData } from '@/lib/tournament/bracket/types'
import { getTemplate } from '@/lib/tournament/bracket/templates'
import { validateBracketCompleteness } from '@/lib/tournament/bracket/engine'
import { isV2Format, ensureLegacyFormat } from '@/lib/tournament/bracket/adapters/format-converter'

/**
 * POST /api/bracket/submit
 *
 * Submit final bracket prediction (locks bracket).
 * Validates completeness before accepting.
 *
 * Body:
 * - competition_id: Competition ID
 * - bracket_data: Complete bracket predictions
 *
 * Response:
 * - success: boolean
 * - errors?: string[] (validation errors)
 * - prediction_id?: string
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const body = await request.json()
    let { competition_id, bracket_data } = body as {
      competition_id: string
      bracket_data: BracketData
    }

    if (!competition_id || !bracket_data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Convert V2 format to legacy if needed (for validation and storage)
    if (bracket_data.groups && isV2Format(Object.values(bracket_data.groups))) {
      console.log('[API] Detected V2 format in bracket submission, converting to legacy')
      const legacyGroups = ensureLegacyFormat(Object.values(bracket_data.groups))
      bracket_data = {
        ...bracket_data,
        groups: Object.fromEntries(
          legacyGroups.map((g, i) => [g.group_id, g])
        ),
      }
    }

    // Check if user is a member
    const { data: membership, error: memberError } = await supabase
      .from('competition_members')
      .select('id')
      .eq('competition_id', competition_id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json(
        { error: 'Not a member of this competition' },
        { status: 403 }
      )
    }

    // Get tournament template
    const template = getTemplate(bracket_data.template_id)

    if (!template) {
      return NextResponse.json(
        { error: 'Invalid tournament template' },
        { status: 400 }
      )
    }

    // Validate bracket completeness
    const validationErrors = validateBracketCompleteness(bracket_data, template)

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Bracket validation failed',
          errors: validationErrors,
        },
        { status: 400 }
      )
    }

    // Check lock time (if competition has started)
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('status, start_time')
      .eq('id', competition_id)
      .single()

    if (compError || !competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      )
    }

    // If competition has started, reject submission
    const now = new Date()
    const startTime = new Date(competition.start_time)

    if (now >= startTime) {
      return NextResponse.json(
        { error: 'Competition has started. Bracket is locked.' },
        { status: 400 }
      )
    }

    // Submit bracket
    const { data: prediction, error: submitError } = await supabase
      .from('bracket_predictions')
      .upsert(
        {
          competition_id,
          user_id: user.id,
          bracket_data,
          is_draft: false,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'competition_id,user_id',
        }
      )
      .select()
      .single()

    if (submitError) {
      console.error('Bracket submission error:', submitError)
      return NextResponse.json(
        { error: 'Failed to submit bracket' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bracket submitted successfully',
      prediction_id: prediction.id,
    })
  } catch (error) {
    console.error('Submit route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
