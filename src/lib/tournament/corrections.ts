import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResultCorrection } from "@/types/tournament";
import type { PredictionType, EventPredictionType } from "@/types/database";
import { scorePrediction } from "@/lib/scoring";

/**
 * Emergency result correction workflow.
 * Re-scores affected predictions and generates a correction snapshot.
 */
export async function correctResult(
  supabase: SupabaseClient,
  finalisationId: string,
  eventId: string,
  newResult: Record<string, unknown>,
  reason: string,
  correctedBy: string
): Promise<ResultCorrection> {
  // Verify super admin
  const { data: adminUser } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", correctedBy)
    .single();

  if (!adminUser?.is_super_admin) {
    throw new Error("Only super admins can correct results");
  }

  // Get the current event result
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, result_data, competition_id, round_id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    throw new Error("Event not found");
  }

  const oldResult = event.result_data ?? {};

  // Update the event with new result data
  const { error: updateError } = await supabase
    .from("events")
    .update({ result_data: newResult })
    .eq("id", eventId);

  if (updateError) {
    throw new Error(`Failed to update event result: ${updateError.message}`);
  }

  // Re-score all predictions for this event
  const { scored } = await rescoreEventPredictions(supabase, eventId, newResult);

  // Get the latest snapshot for this classification before correction
  const { data: latestSnapshot } = await supabase
    .from("classification_standings_snapshots")
    .select("id")
    .eq("competition_id", event.competition_id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Create correction record
  const { data: correction, error: corrError } = await supabase
    .from("result_corrections")
    .insert({
      finalisation_id: finalisationId,
      corrected_by: correctedBy,
      reason,
      old_result_data: oldResult,
      new_result_data: newResult,
      affected_event_ids: [eventId],
      affected_window_ids: event.round_id ? [event.round_id] : null,
      scoring_recalculated: scored > 0,
      eliminations_changed: false, // Caller determines this separately
      previous_snapshot_id: latestSnapshot?.id ?? null,
    })
    .select()
    .single();

  if (corrError || !correction) {
    throw new Error(`Failed to create correction record: ${corrError?.message}`);
  }

  // Update finalisation status
  await supabase
    .from("result_finalisations")
    .update({ status: "corrected" })
    .eq("id", finalisationId);

  // Generate correction snapshot
  if (event.competition_id) {
    const { data: classifications } = await supabase
      .from("classifications")
      .select("id")
      .eq("competition_id", event.competition_id)
      .in("status", ["active", "finalised"]);

    for (const cls of classifications ?? []) {
      await supabase.from("classification_standings_snapshots").insert({
        classification_id: cls.id,
        competition_id: event.competition_id,
        prediction_window_id: event.round_id,
        finalisation_id: finalisationId,
        snapshot_type: "correction",
        standings_data: [], // Will be populated by standings recalculation
        entrant_count: 0,
        generated_by: correctedBy,
        generation_method: "correction",
      });
    }
  }

  return correction as ResultCorrection;
}

/**
 * Re-score all predictions for an event with new result data.
 */
async function rescoreEventPredictions(
  supabase: SupabaseClient,
  eventId: string,
  newResult: Record<string, unknown>
): Promise<{ scored: number; errors: number }> {
  const { data: eptRows } = await supabase
    .from("event_prediction_types")
    .select("*")
    .eq("event_id", eventId);

  const eptMap = new Map<string, EventPredictionType>();
  for (const row of eptRows ?? []) {
    eptMap.set(row.prediction_type, row as EventPredictionType);
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("event_id", eventId);

  let scored = 0;
  let errors = 0;

  for (const prediction of predictions ?? []) {
    const predType = prediction.prediction_type as PredictionType;
    const ept = eptMap.get(predType);
    const eptData = ept ?? { points: 10, partial_points: 0, config: null };

    const result = scorePrediction(predType, prediction.prediction_data, newResult, eptData);

    const { error } = await supabase
      .from("predictions")
      .update({
        is_correct: result.is_correct,
        is_partial: result.is_partial,
        points_awarded: result.points_awarded,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prediction.id);

    if (error) errors++;
    else scored++;
  }

  return { scored, errors };
}
