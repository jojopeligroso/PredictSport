import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { scorePrediction, buildScoreDerivedWinnerOverrides } from "@/lib/scoring";
import { requireDisplayName } from "@/lib/require-display-name";
import type { PredictionType, EventPredictionType } from "@/types/database";
import { notifyResultConfirmed } from "@/lib/notifications/result-confirmed";
import { processEventTags, checkRoundCompletionAndProcessTags } from "@/lib/reputation";

interface ConfirmResultBody {
  event_id: string;
  /** Optional: manually set result_data during confirmation */
  result_data?: Record<string, unknown>;
  /** Force re-score an already-confirmed event (dispute resolution) */
  force_rescore?: boolean;
}

/**
 * POST /api/admin/confirm-result
 * Confirm a result for an event, score all predictions, and finalize.
 *
 * Flow:
 * 1. Verify user is admin/co_admin of the event's competition
 * 2. Ensure event has result_data (either existing or provided in body)
 * 3. Set result_confirmed = true, status = 'resulted'
 * 4. Fetch event_prediction_types for per-type points
 * 5. Calculate and update points for all predictions on this event
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

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
    .select("*")
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

  // Force-rescore: dispute resolution path. Allows re-scoring an already-confirmed
  // event with corrected result_data. Resets all prediction scores first.
  const isForceRescore = body.force_rescore === true && event.result_confirmed === true;

  if (isForceRescore) {
    // Clear verification dispute and record admin override
    const overrideResultData: Record<string, unknown> = {
      ...(resultData as Record<string, unknown>),
      verification_status: "verified",
      verified_at: new Date().toISOString(),
      verification_provider: "admin_override",
      admin_override_by: user.id,
      admin_override_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("events")
      .update({
        result_data: overrideResultData,
        result_confirmed_by: user.id,
      })
      .eq("id", body.event_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update result", details: updateError.message },
        { status: 500 }
      );
    }

    // Reset all prediction scores for this event before re-scoring
    await supabase
      .from("predictions")
      .update({ is_correct: null, is_partial: false, points_awarded: 0 })
      .eq("event_id", body.event_id);

    // Post follow-up chat message
    const names = (event.event_name as string).split(/\s+vs?\s+/i);
    const score = overrideResultData.score as Record<string, unknown> | undefined;
    const chatContent =
      score && names.length === 2
        ? `Result confirmed: ${names[0].trim()} ${score.home_score}\u2013${score.away_score} ${names[1].trim()}`
        : `Result confirmed: ${event.event_name}`;

    const serviceClient = createServiceClient();
    await serviceClient.from("chat_messages").insert({
      competition_id: competitionId,
      content: chatContent,
      message_type: "system_result",
      user_id: null,
    });

    // Continue to re-score predictions below using overrideResultData
    Object.assign(resultData as Record<string, unknown>, overrideResultData);
  } else {
    // Normal path: atomically set result_confirmed = true only if currently false.
    const { data: confirmedEvent, error: updateError } = await supabase
      .from("events")
      .update({
        result_data: resultData,
        result_confirmed: true,
        result_confirmed_by: user.id,
        status: "resulted",
      })
      .eq("id", body.event_id)
      .eq("result_confirmed", false)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to confirm result", details: updateError.message },
        { status: 500 }
      );
    }

    if (!confirmedEvent) {
      return NextResponse.json(
        { error: "Result has already been confirmed for this event" },
        { status: 409 }
      );
    }
  }

  // Fetch event_prediction_types for this event
  const { data: eptRows } = await supabase
    .from("event_prediction_types")
    .select("*")
    .eq("event_id", body.event_id);

  const eptMap = new Map<string, EventPredictionType>();
  for (const row of eptRows ?? []) {
    eptMap.set(row.prediction_type, row as EventPredictionType);
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

  // Score is source of truth: derive winner from score when both exist
  const winnerEpt = eptMap.get("winner");
  const winnerOpts =
    ((winnerEpt?.config as Record<string, unknown> | null)?.options as
      | string[]
      | undefined) ?? [];
  const winnerOverrides = buildScoreDerivedWinnerOverrides(
    (predictions ?? []) as Array<{
      user_id: string;
      prediction_type: string;
      prediction_data: Record<string, unknown>;
    }>,
    winnerOpts,
    (event.sport as string) ?? "",
  );

  // Score each prediction in memory, then batch-update in a single transaction.
  // If any row fails, the entire batch rolls back — no partially scored events.
  const scores: Array<{
    id: string;
    is_correct: boolean | null;
    is_partial: boolean;
    points_awarded: number;
  }> = [];

  for (const prediction of predictions ?? []) {
    const predType = prediction.prediction_type as PredictionType;
    const ept = eptMap.get(predType);

    const eptData = ept ?? {
      points: 10,
      partial_points: 0,
      config: null,
    };

    // For winner predictions, use score-derived value if available
    let predData = prediction.prediction_data as Record<string, unknown>;
    if (predType === "winner") {
      const override = winnerOverrides.get(prediction.user_id as string);
      if (override) predData = override;
    }

    const result = scorePrediction(
      predType,
      predData,
      resultData as Record<string, unknown>,
      eptData
    );

    scores.push({
      id: prediction.id as string,
      is_correct: result.is_correct,
      is_partial: result.is_partial,
      points_awarded: result.points_awarded,
    });
  }

  let scored = 0;
  let errors = 0;

  if (scores.length > 0) {
    // H1: batch_score_predictions revoked from authenticated — use service client
    const svc = createServiceClient();
    const { data: batchResult, error: batchError } = await svc.rpc(
      "batch_score_predictions",
      { p_scores: scores }
    );

    if (batchError) {
      // Transaction failed — event is confirmed but no predictions scored.
      // Roll back the event confirmation so admin can retry.
      await supabase
        .from("events")
        .update({ result_confirmed: false, status: "live" })
        .eq("id", body.event_id);

      return NextResponse.json(
        { error: "Failed to score predictions — event rolled back", details: batchError.message },
        { status: 500 }
      );
    }

    const result = (batchResult as Array<{ scored: number; errors: number }>)?.[0];
    scored = result?.scored ?? scores.length;
    errors = result?.errors ?? 0;
  }

  // Broadcast scoring update so leaderboard clients can refetch
  await supabase.channel("scoring_events").send({
    type: "broadcast",
    event: "scores_updated",
    payload: { competition_id: competitionId, event_id: body.event_id },
  }).catch(() => {});

  // Notify competition members (chat + push — fire-and-forget)
  notifyResultConfirmed(
    body.event_id,
    competitionId,
    event.event_name as string,
    resultData as Record<string, unknown>,
  ).catch(() => {});

  // Process event-driven reputation tags (fire-and-forget)
  processEventTags(competitionId as string, body.event_id).catch((err) => {
    console.error("[confirm-result] Event tag processing failed:", err);
  });

  // Check if round is fully resulted → trigger behavioural tags (fire-and-forget)
  checkRoundCompletionAndProcessTags(competitionId as string, body.event_id).catch((err) => {
    console.error("[confirm-result] Round tag processing failed:", err);
  });

  return NextResponse.json({
    success: true,
    event_id: body.event_id,
    predictions_scored: scored,
    scoring_errors: errors,
  });
}
