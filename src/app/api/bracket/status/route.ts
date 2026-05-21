import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/bracket/status?competition_id=xxx
 *
 * Fetch user's bracket prediction status and data.
 * Returns draft or submitted bracket.
 *
 * Query params:
 * - competition_id: Competition ID
 *
 * Response:
 * - exists: boolean
 * - is_draft: boolean
 * - bracket_data: BracketData | null
 * - submitted_at: string | null
 * - lock_time: string (competition start time)
 * - is_locked: boolean
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get competition_id from query
    const { searchParams } = new URL(request.url)
    const competition_id = searchParams.get('competition_id')

    if (!competition_id) {
      return NextResponse.json(
        { error: 'Missing competition_id' },
        { status: 400 }
      )
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

    // Fetch bracket prediction
    const { data: bracket, error: bracketError } = await supabase
      .from('bracket_predictions')
      .select('bracket_data, is_draft, submitted_at, updated_at')
      .eq('competition_id', competition_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (bracketError) {
      console.error('Bracket fetch error:', bracketError)
      return NextResponse.json(
        { error: 'Failed to fetch bracket' },
        { status: 500 }
      )
    }

    // Fetch competition lock time
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('start_time, status')
      .eq('id', competition_id)
      .single()

    if (compError || !competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      )
    }

    const lockTime = new Date(competition.start_time)
    const now = new Date()
    const isLocked = now >= lockTime

    return NextResponse.json({
      exists: !!bracket,
      is_draft: bracket?.is_draft ?? true,
      bracket_data: bracket?.bracket_data || null,
      submitted_at: bracket?.submitted_at || null,
      updated_at: bracket?.updated_at || null,
      lock_time: competition.start_time,
      is_locked: isLocked,
    })
  } catch (error) {
    console.error('Status route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
