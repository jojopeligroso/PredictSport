import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { scorePrediction } from "@/lib/scoring";
import type { PredictionType } from "@/types/database";

interface ConfirmResultBody {
  event_id: string;
  /** Optional: manually set result_data during confirmation */
  result_data?: Record<string, unknown>;
}

/**
 * POST /api/admin/confirm-result
 * Confirm a result for an event, score all predictions, and finalize.
 *
 * Flow:
 * 1. Verify user is admin/co_admin of the event's competition
 * 2. Ensure event has result_data (either existing or provided in body)
 * 3. Set result_confirmed = true, status = 'resulted'
 * 4. Calculate and update points for all predictions on this event
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ConfirmResultBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.event_id) {
    return NextResponse.json(
      { error: "event_id is required" },
      { status: 400 }
    );
  }

  // Fetch the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*, competitions!inner(id, scoring_rules)")
    .eq("id", body.event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { error: "Event not found" },
      { status: 404 }
    );
  }

  // Verify admin role on the competition
  const competitionId = event.competition_id;
  const member = await verifyCompetitionAdmin(supabase, user.id, competitionId);
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  // Determine result data
  const resultData = body.result_data ?? event.result_data;
  if (!resultData || Object.keys(resultData).length === 0) {
    return NextResponse.json(
      { error: "No result data available. Provide result_data or fetch the result first." },
      { status: 400 }
    );
  }

  if (event.result_confirmed) {
    return NextResponse.json(
      { error: "Result has already been confirmed for this event" },
      { status: 409 }
    );
  }

  // Update event: set result as confirmed
  const { error: updateError } = await supabase
    .from("events")
    .update({
      result_data: resultData,
      result_confirmed: true,
      result_confirmed_by: user.id,
      status: "resulted",
    })
    .eq("id", body.event_id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to confirm result", details: updateError.message },
      { status: 500 }
    );
  }

  // Fetch all predictions for this event
  const { data: predictions, error: predError } = await supabase
    .from("predictions")
    .select("*")
    .eq("event_id", body.event_id);

  if (predError) {
    return NextResponse.json(
      { error: "Failed to fetch predictions", details: predError.message },
      { status: 500 }
    );
  }

  const scoringRules = (event.competitions as unknown as { scoring_rules: Record<string, unknown> })
    ?.scoring_rules ?? {};

  // Score each prediction
  let scored = 0;
  let errors = 0;

  for (const prediction of predictions ?? []) {
    const result = scorePrediction(
      prediction.prediction_type as PredictionType,
      prediction.prediction_data as Record<string, unknown>,
      resultData as Record<string, unknown>,
      scoringRules as Record<string, unknown>
    );

    const { error: scoreError } = await supabase
      .from("predictions")
      .update({
        is_correct: result.is_correct,
        is_partial: result.is_partial,
        points_awarded: result.points_awarded,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prediction.id);

    if (scoreError) {
      errors++;
    } else {
      scored++;
    }
  }

  return NextResponse.json({
    success: true,
    event_id: body.event_id,
    predictions_scored: scored,
    scoring_errors: errors,
  });
}
