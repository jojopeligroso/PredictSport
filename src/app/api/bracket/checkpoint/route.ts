import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BracketData } from '@/lib/tournament/bracket/types'
import { isV2Format, ensureLegacyFormat } from '@/lib/tournament/bracket/adapters/format-converter'

/**
 * POST /api/bracket/checkpoint
 *
 * Save bracket prediction progress (draft mode).
 * Allows user to resume later.
 *
 * Body:
 * - competition_id: Competition ID
 * - bracket_data: Partial or complete bracket predictions
 *
 * Response:
 * - success: boolean
 * - message: string
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

    // Convert V2 format to legacy if needed (for storage consistency)
    if (bracket_data.groups && isV2Format(Object.values(bracket_data.groups))) {
      console.log('[API] Detected V2 format in checkpoint, converting to legacy')
      const legacyGroups = ensureLegacyFormat(Object.values(bracket_data.groups))
      bracket_data = {
        ...bracket_data,
        groups: Object.fromEntries(
          legacyGroups.map((g, i) => [g.group_id, g])
        ),
      }
    }

    // Check if user is a member of this competition
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

    // Upsert bracket checkpoint
    // (Using a dedicated table or storing in predictions table with draft=true)
    const { error: upsertError } = await supabase
      .from('bracket_predictions')
      .upsert(
        {
          competition_id,
          user_id: user.id,
          bracket_data,
          is_draft: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'competition_id,user_id',
        }
      )

    if (upsertError) {
      console.error('Checkpoint save error:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save checkpoint' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Checkpoint saved',
    })
  } catch (error) {
    console.error('Checkpoint route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
