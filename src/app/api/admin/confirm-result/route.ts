import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { scorePrediction } from "@/lib/scoring";
import { requireDisplayName } from "@/lib/require-display-name";
import type { PredictionType, EventPredictionType } from "@/types/database";

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

  // Atomically set result_confirmed = true only if it is currently false.
  // This prevents two concurrent requests both scoring predictions.
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
    // No row was updated — result was already confirmed by a concurrent request
    return NextResponse.json(
      { error: "Result has already been confirmed for this event" },
      { status: 409 }
    );
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

  // Score each prediction
  let scored = 0;
  let errors = 0;

  for (const prediction of predictions ?? []) {
    const predType = prediction.prediction_type as PredictionType;
    const ept = eptMap.get(predType);

    // Use event_prediction_types row if available, otherwise fall back to defaults
    const eptData = ept ?? {
      points: 10,
      partial_points: 0,
      config: null,
    };

    const result = scorePrediction(
      predType,
      prediction.prediction_data as Record<string, unknown>,
      resultData as Record<string, unknown>,
      eptData
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

  // Notify Telegram group (fire-and-forget — don't block the response)
  const telegramGroupId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (telegramGroupId) {
    notifyResultsToGroup(supabase, telegramGroupId, event, predictions ?? []).catch((err) => {
      console.error("Telegram notify failed:", err instanceof Error ? err.message : err);
    });
  }

  return NextResponse.json({
    success: true,
    event_id: body.event_id,
    predictions_scored: scored,
    scoring_errors: errors,
  });
}

/**
 * Build a leaderboard from scored predictions and send to the Telegram group.
 */
async function notifyResultsToGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  chatId: string,
  event: Record<string, unknown>,
  predictions: Array<Record<string, unknown>>
) {
  // Aggregate points per user from this event's predictions
  const pointsByUser = new Map<string, number>();
  for (const p of predictions) {
    const userId = p.user_id as string;
    const pts = (p.points_awarded as number) ?? 0;
    pointsByUser.set(userId, (pointsByUser.get(userId) ?? 0) + pts);
  }

  if (pointsByUser.size === 0) return;

  // Fetch display names for scorers
  const userIds = [...pointsByUser.keys()];
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", userIds);

  const topScorers = [...pointsByUser.entries()]
    .map(([id, points]) => ({
      name: users?.find((u) => u.id === id)?.display_name || "Unknown",
      points,
    }))
    .sort((a, b) => b.points - a.points);

  const { notifyResults } = await import("@/lib/telegram/notify");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";
  await notifyResults(chatId, event.event_name as string, topScorers, appUrl);
}
