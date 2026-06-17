import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResultFinalisation } from "@/types/tournament";
import type { PredictionType, EventPredictionType } from "@/types/database";
import { scorePrediction } from "@/lib/scoring";

/**
 * Step 1: Confirm individual fixture result for tournament competitions.
 * Reuses the existing scoring flow. Requires super admin or competition admin/co_admin.
 */
export async function confirmTournamentResult(
  supabase: SupabaseClient,
  eventId: string,
  resultData: Record<string, unknown>,
  confirmedBy: string
): Promise<{ scored: number; errors: number }> {
  // Fetch event's competition_id for admin check
  const { data: eventRow } = await supabase
    .from("events")
    .select("competition_id")
    .eq("id", eventId)
    .single();

  if (!eventRow) {
    throw new Error("Event not found");
  }

  // Verify super admin or competition admin
  await verifyAdminAccess(supabase, confirmedBy, eventRow.competition_id);

  // Atomically confirm (prevent double-scoring)
  const { data: confirmedEvent, error: updateError } = await supabase
    .from("events")
    .update({
      result_data: resultData,
      result_confirmed: true,
      result_confirmed_by: confirmedBy,
      status: "resulted",
    })
    .eq("id", eventId)
    .eq("result_confirmed", false)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to confirm result: ${updateError.message}`);
  }

  if (!confirmedEvent) {
    throw new Error("Result already confirmed for this event");
  }

  // Score all predictions for this event
  return scoreEventPredictions(supabase, eventId, resultData);
}

/**
 * Score all predictions for an event using its EPT configuration.
 */
async function scoreEventPredictions(
  supabase: SupabaseClient,
  eventId: string,
  resultData: Record<string, unknown>
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

  // Score in memory, then batch-update in a single transaction
  const scores: Array<{
    id: string;
    is_correct: boolean | null;
    is_partial: boolean;
    points_awarded: number;
  }> = [];

  for (const prediction of predictions ?? []) {
    const predType = prediction.prediction_type as PredictionType;
    const ept = eptMap.get(predType);
    const eptData = ept ?? { points: 10, partial_points: 0, config: null };

    const result = scorePrediction(predType, prediction.prediction_data, resultData, eptData);

    scores.push({
      id: prediction.id as string,
      is_correct: result.is_correct,
      is_partial: result.is_partial,
      points_awarded: result.points_awarded,
    });
  }

  if (scores.length === 0) return { scored: 0, errors: 0 };

  const { error: batchError } = await supabase.rpc(
    "batch_score_predictions",
    { p_scores: scores }
  );

  if (batchError) {
    throw new Error(`Batch scoring failed: ${batchError.message}`);
  }

  return { scored: scores.length, errors: 0 };
}

/**
 * Step 2a: Finalise a prediction window.
 * All results in the window must be confirmed first.
 * Creates finalisation record, generates standing snapshots for each classification.
 */
export async function finaliseWindow(
  supabase: SupabaseClient,
  roundId: string,
  finalisedBy: string | null
): Promise<ResultFinalisation> {
  // Get the round and its competition (fetch first so we can check admin membership)
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, competition_id, sporting_stage_id, status")
    .eq("id", roundId)
    .single();

  if (roundError || !round) {
    throw new Error("Prediction window not found");
  }

  // Verify super admin or competition admin (skip for automatic/cron finalisations where finalisedBy is null)
  if (finalisedBy) {
    await verifyAdminAccess(supabase, finalisedBy, round.competition_id);
  }

  if (round.status === "scored") {
    throw new Error("Prediction window is already finalised");
  }

  // Verify all events in this window are resulted
  const { data: events } = await supabase
    .from("events")
    .select("id, status, result_confirmed")
    .eq("round_id", roundId);

  const unconfirmed = (events ?? []).filter(
    (e: { result_confirmed: boolean }) => !e.result_confirmed
  );

  if (unconfirmed.length > 0) {
    throw new Error(
      `Cannot finalise: ${unconfirmed.length} event(s) have unconfirmed results`
    );
  }

  // Create finalisation record
  const { data: finalisation, error: finError } = await supabase
    .from("result_finalisations")
    .insert({
      competition_id: round.competition_id,
      prediction_window_id: roundId,
      sporting_stage_id: round.sporting_stage_id,
      finalisation_type: "window",
      status: "finalised",
      finalised_at: new Date().toISOString(),
      finalised_by: finalisedBy,
      finalisation_method: finalisedBy ? "manual" : "automatic",
    })
    .select()
    .single();

  if (finError || !finalisation) {
    throw new Error(`Failed to create finalisation record: ${finError?.message}`);
  }

  // Update round status to scored
  await supabase
    .from("rounds")
    .update({ status: "scored" })
    .eq("id", roundId);

  // Generate standing snapshots for each classification in this competition
  const { data: classifications } = await supabase
    .from("classifications")
    .select("id, classification_type")
    .eq("competition_id", round.competition_id)
    .in("status", ["active", "finalised"]);

  for (const classification of classifications ?? []) {
    await generateWindowSnapshot(
      supabase,
      classification.id,
      round.competition_id,
      roundId,
      round.sporting_stage_id,
      finalisation.id,
      finalisedBy
    );
  }

  return finalisation as ResultFinalisation;
}

/**
 * Step 2b: Finalise a sporting stage.
 * All prediction windows for this stage must be finalised first.
 */
export async function finaliseStage(
  supabase: SupabaseClient,
  stageId: string,
  finalisedBy: string
): Promise<ResultFinalisation> {
  // Get the stage
  const { data: stage, error: stageError } = await supabase
    .from("sporting_stages")
    .select("id, tournament_id, status, slug")
    .eq("id", stageId)
    .single();

  if (stageError || !stage) {
    throw new Error("Sporting stage not found");
  }

  if (stage.status === "finalised") {
    throw new Error("Sporting stage is already finalised");
  }

  // Find competitions linked to this tournament
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id")
    .eq("tournament_id", stage.tournament_id);

  if (!competitions || competitions.length === 0) {
    throw new Error("No competitions linked to this tournament");
  }

  // Verify super admin or admin of any linked competition
  await verifyAdminAccessForTournament(supabase, finalisedBy, competitions.map((c) => c.id));

  // For each competition, verify all windows for this stage are scored
  for (const comp of competitions) {
    const { data: windows } = await supabase
      .from("rounds")
      .select("id, status")
      .eq("competition_id", comp.id)
      .eq("sporting_stage_id", stageId);

    const unscored = (windows ?? []).filter(
      (w: { status: string }) => w.status !== "scored"
    );

    if (unscored.length > 0) {
      throw new Error(
        `Cannot finalise stage: ${unscored.length} prediction window(s) not yet scored`
      );
    }
  }

  // Create stage finalisation record (using first competition for now)
  const { data: finalisation, error: finError } = await supabase
    .from("result_finalisations")
    .insert({
      competition_id: competitions[0].id,
      sporting_stage_id: stageId,
      finalisation_type: "stage",
      status: "finalised",
      finalised_at: new Date().toISOString(),
      finalised_by: finalisedBy,
      finalisation_method: "manual",
    })
    .select()
    .single();

  if (finError || !finalisation) {
    throw new Error(`Failed to create stage finalisation: ${finError?.message}`);
  }

  // Update sporting stage status
  await supabase
    .from("sporting_stages")
    .update({
      status: "finalised",
      finalised_at: new Date().toISOString(),
      finalised_by: finalisedBy,
    })
    .eq("id", stageId);

  // Check if this completes the group stage → activate knockout bracket
  const isGroupStageComplete = await checkGroupStageComplete(supabase, stage.tournament_id);
  if (isGroupStageComplete) {
    await activateKnockoutBracket(supabase, stage.tournament_id);
  }

  return finalisation as ResultFinalisation;
}

/**
 * Check if all group stages for a tournament are finalised.
 */
async function checkGroupStageComplete(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<boolean> {
  const { data: groupStages } = await supabase
    .from("sporting_stages")
    .select("status")
    .eq("tournament_id", tournamentId)
    .eq("stage_type", "group");

  if (!groupStages || groupStages.length === 0) return false;

  return groupStages.every((s: { status: string }) => s.status === "finalised");
}

/**
 * Activate knockout bracket classifications when group stage is complete.
 */
async function activateKnockoutBracket(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<void> {
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id")
    .eq("tournament_id", tournamentId);

  for (const comp of competitions ?? []) {
    await supabase
      .from("classifications")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("competition_id", comp.id)
      .eq("classification_key", "knockout_bracket")
      .eq("status", "draft");
  }
}

/**
 * Verify that the user is a super admin or a competition admin/co_admin.
 */
async function verifyAdminAccess(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string
): Promise<void> {
  const { data: adminUser } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", userId)
    .single();

  if (adminUser?.is_super_admin) return;

  const { data: member } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .single();

  if (member?.role === "admin" || member?.role === "co_admin") return;

  throw new Error("Only super admins or competition admins can perform this action");
}

/**
 * Verify that the user is a super admin or admin of any of the given competitions.
 */
async function verifyAdminAccessForTournament(
  supabase: SupabaseClient,
  userId: string,
  competitionIds: string[]
): Promise<void> {
  const { data: adminUser } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", userId)
    .single();

  if (adminUser?.is_super_admin) return;

  const { data: memberships } = await supabase
    .from("competition_members")
    .select("role")
    .in("competition_id", competitionIds)
    .eq("user_id", userId)
    .in("role", ["admin", "co_admin"]);

  if (memberships && memberships.length > 0) return;

  throw new Error("Only super admins or competition admins can perform this action");
}

/**
 * Generate a standing snapshot for a classification after window finalisation.
 */
async function generateWindowSnapshot(
  supabase: SupabaseClient,
  classificationId: string,
  competitionId: string,
  windowId: string,
  stageId: string | null,
  finalisationId: string,
  generatedBy: string | null
): Promise<void> {
  // Get all active members
  const { data: memberships } = await supabase
    .from("classification_memberships")
    .select("user_id, status")
    .eq("classification_id", classificationId)
    .in("status", ["active", "winner"]);

  if (!memberships || memberships.length === 0) return;

  // Get events in this prediction window, then fetch their predictions
  const { data: windowEvents } = await supabase
    .from("events")
    .select("id")
    .eq("round_id", windowId);

  const eventIds = (windowEvents ?? []).map((e: { id: string }) => e.id);

  const { data: predictions } = eventIds.length > 0
    ? await supabase
        .from("predictions")
        .select("user_id, points_awarded, is_correct, prediction_type")
        .in("event_id", eventIds)
        .not("is_correct", "is", null)
        .limit(10000)
    : { data: [] };

  // Aggregate points per user
  const pointsMap = new Map<string, number>();
  for (const m of memberships) {
    pointsMap.set(m.user_id, 0);
  }

  for (const p of predictions ?? []) {
    const current = pointsMap.get(p.user_id) ?? 0;
    pointsMap.set(p.user_id, current + (p.points_awarded ?? 0));
  }

  // Build standings sorted by points descending
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", memberships.map((m: { user_id: string }) => m.user_id));

  const userNames = new Map(
    (users ?? []).map((u: { id: string; display_name: string }) => [u.id, u.display_name])
  );

  const standings = [...pointsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId, points], idx) => ({
      rank: idx + 1,
      user_id: userId,
      display_name: userNames.get(userId) ?? "Unknown",
      points,
      status: memberships.find((m: { user_id: string }) => m.user_id === userId)?.status ?? "active",
      tie_break_values: {},
      movement: null,
      eliminated: false,
      metadata: {},
    }));

  await supabase.from("classification_standings_snapshots").insert({
    classification_id: classificationId,
    competition_id: competitionId,
    prediction_window_id: windowId,
    sporting_stage_id: stageId,
    finalisation_id: finalisationId,
    snapshot_type: "window",
    standings_data: standings,
    entrant_count: standings.length,
    generated_by: generatedBy,
    generation_method: "manual",
  });
}
