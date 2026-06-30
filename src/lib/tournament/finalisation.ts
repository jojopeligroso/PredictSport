import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResultFinalisation } from "@/types/tournament";
import type { PredictionType, EventPredictionType } from "@/types/database";
import { scorePrediction, buildScoreDerivedWinnerOverrides } from "@/lib/scoring";
import { eliminateFromFormat, type EliminationResult } from "@/lib/tournament/format/elimination";
import { computeAndPublishFinalisationTags } from "@/lib/reputation/assign-finalisation";
import { getProvidersForSport } from "@/lib/sports/registry";
import type { Sport } from "@/lib/sports/types";

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
  // Fetch event's competition_id, external_event_id, and sport for access checks
  const { data: eventRow } = await supabase
    .from("events")
    .select("competition_id, external_event_id, sport")
    .eq("id", eventId)
    .single();

  if (!eventRow) {
    throw new Error("Event not found");
  }

  // Verify super admin or competition admin (basic access)
  await verifyAdminAccess(supabase, confirmedBy, eventRow.competition_id);

  // Stricter guard: non-custom events or events with 2+ API providers
  // require super_admin — normal admins can only confirm custom/manual events
  // for sports with a single API source.
  await verifyConfirmPermission(
    supabase,
    confirmedBy,
    eventRow.external_event_id,
    eventRow.sport,
  );

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

  // Score is source of truth: derive winner from score when both exist
  const { data: eventForSport } = await supabase
    .from("events")
    .select("sport")
    .eq("id", eventId)
    .single();
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
    eventForSport?.sport ?? "",
  );

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

    let predData = prediction.prediction_data as Record<string, unknown>;
    if (predType === "winner") {
      const override = winnerOverrides.get(prediction.user_id as string);
      if (override) predData = override;
    }

    const result = scorePrediction(predType, predData, resultData, eptData);

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

  // Handle sibling competition instances (multi-instance tournaments).
  // Events/rounds are shared via tournament_id but each instance has its own
  // classifications and standings. Create finalisation records and snapshots
  // for sibling instances so their leaderboards stay current.
  const { data: ownerComp } = await supabase
    .from("competitions")
    .select("tournament_id")
    .eq("id", round.competition_id)
    .single();

  if (ownerComp?.tournament_id) {
    const { data: siblings } = await supabase
      .from("competitions")
      .select("id")
      .eq("tournament_id", ownerComp.tournament_id)
      .neq("id", round.competition_id)
      .in("status", ["active", "draft"]);

    for (const sibling of siblings ?? []) {
      // Check if already finalised for this sibling (idempotent)
      const { data: existing } = await supabase
        .from("result_finalisations")
        .select("id")
        .eq("competition_id", sibling.id)
        .eq("prediction_window_id", roundId)
        .maybeSingle();

      if (existing) continue;

      const { data: sibFinalisation } = await supabase
        .from("result_finalisations")
        .insert({
          competition_id: sibling.id,
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

      if (!sibFinalisation) continue;

      const { data: sibClassifications } = await supabase
        .from("classifications")
        .select("id, classification_type")
        .eq("competition_id", sibling.id)
        .in("status", ["active", "finalised"]);

      for (const cls of sibClassifications ?? []) {
        await generateWindowSnapshot(
          supabase,
          cls.id,
          sibling.id,
          roundId,
          round.sporting_stage_id,
          sibFinalisation.id,
          finalisedBy
        );
      }
    }
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
  finalisedBy: string | null
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

  // Verify super admin or admin of any linked competition (skip for automatic/cron finalisations where finalisedBy is null)
  if (finalisedBy) {
    await verifyAdminAccessForTournament(supabase, finalisedBy, competitions.map((c) => c.id));
  }

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
      finalisation_method: finalisedBy ? "manual" : "automatic",
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

  // Run format elimination for all format_elimination classifications
  // across all competition instances sharing this tournament.
  // This must happen BEFORE knockout bracket activation so that
  // eliminated entrants are removed before the next phase begins.
  const eliminationResults: { competitionId: string; classificationId: string; result: EliminationResult }[] = [];

  for (const comp of competitions) {
    const { data: formatClassifications } = await supabase
      .from("classifications")
      .select("id")
      .eq("competition_id", comp.id)
      .eq("classification_type", "format_elimination")
      .in("status", ["active"]);

    for (const cls of formatClassifications ?? []) {
      const result = await eliminateFromFormat(supabase, cls.id, stageId);
      eliminationResults.push({ competitionId: comp.id, classificationId: cls.id, result });
    }
  }

  // B4: Generate stage standings snapshots after elimination
  for (const { competitionId, classificationId, result } of eliminationResults) {
    await generateStageSnapshot(
      supabase,
      classificationId,
      competitionId,
      stageId,
      finalisation.id,
      finalisedBy,
      result
    );
  }

  // E1/E2: Compute and publish finalisation tags (Unluckiest 4th Place, Most Contested 3rd Place).
  // Fire-and-forget per competition instance — errors logged but don't block finalisation.
  for (const { competitionId, result } of eliminationResults) {
    computeAndPublishFinalisationTags(supabase, competitionId, stageId, result).catch((err) =>
      console.error(
        `[finaliseStage] Finalisation tag processing failed for comp ${competitionId}:`,
        err instanceof Error ? err.message : err
      )
    );
  }

  // D3: Post stage elimination system message in competition chat.
  // One message per competition instance: "Format: N eliminated after [Stage]. M advance to [Next Stage]."
  // Gated behind chat_enabled on the competition.
  await postStageEliminationChatMessages(supabase, competitions, eliminationResults, stage.slug, stage.tournament_id);

  // Check if this completes the group stage → activate knockout bracket
  const isGroupStageComplete = await checkGroupStageComplete(supabase, stage.tournament_id);
  if (isGroupStageComplete) {
    await activateKnockoutBracket(supabase, stage.tournament_id);
  }

  return finalisation as ResultFinalisation;
}

/**
 * D3: Post a system chat message in each competition after stage elimination.
 *
 * Message: "Format: N eliminated after [Stage Name]. M advance to [Next Stage]."
 * Only fires for competitions with chat_enabled = true.
 */
async function postStageEliminationChatMessages(
  supabase: SupabaseClient,
  competitions: { id: string }[],
  eliminationResults: { competitionId: string; classificationId: string; result: EliminationResult }[],
  stageSlug: string,
  tournamentId: string
): Promise<void> {
  if (eliminationResults.length === 0) return;

  // Determine stage display names
  const stageName = slugToDisplayName(stageSlug);

  // Find the next unfinalised stage after this one for context
  let nextStageName = "the next round";

  const { data: nextStages } = await supabase
    .from("sporting_stages")
    .select("slug")
    .eq("tournament_id", tournamentId)
    .neq("status", "finalised")
    .order("stage_order", { ascending: true })
    .limit(2);

  // The first unfinalised stage might be the one we just finalised (status update
  // may not have propagated yet), so skip it if it matches
  const nextStage = (nextStages ?? []).find(
    (s: { slug: string }) => s.slug !== stageSlug
  );
  if (nextStage) {
    nextStageName = slugToDisplayName(nextStage.slug);
  }

  // Aggregate per-competition: sum eliminated and survivors across classifications
  const compStats = new Map<string, { eliminated: number; survivors: number }>();
  for (const { competitionId, result } of eliminationResults) {
    const existing = compStats.get(competitionId) ?? { eliminated: 0, survivors: 0 };
    existing.eliminated = result.eliminated_user_ids.length;
    existing.survivors = result.survivor_user_ids.length;
    compStats.set(competitionId, existing);
  }

  for (const comp of competitions) {
    const stats = compStats.get(comp.id);
    if (!stats || (stats.eliminated === 0 && stats.survivors === 0)) continue;

    // Check if chat is enabled for this competition
    const { data: compRow } = await supabase
      .from("competitions")
      .select("chat_enabled")
      .eq("id", comp.id)
      .single();

    if (!compRow?.chat_enabled) continue;

    const content = `Format: ${stats.eliminated} eliminated after ${stageName}. ${stats.survivors} advance to ${nextStageName}.`;

    await supabase.from("chat_messages").insert({
      competition_id: comp.id,
      user_id: null,
      content,
      message_type: "system",
      metadata: {
        type: "stage_elimination",
        stage_slug: stageSlug,
        eliminated_count: stats.eliminated,
        survivor_count: stats.survivors,
      },
    });
  }
}

/**
 * Convert a DB slug (e.g. "group-matchday-3") to a human-readable name.
 */
function slugToDisplayName(slug: string): string {
  const DISPLAY_MAP: Record<string, string> = {
    "group-matchday-1": "Group Matchday 1",
    "group-matchday-2": "Group Matchday 2",
    "group-matchday-3": "Group Matchday 3",
    "round-of-32": "Round of 32",
    "round-of-16": "Round of 16",
    "quarter-finals": "Quarter-Finals",
    "semi-finals": "Semi-Finals",
    "final": "Final",
    "third-place": "Third Place",
  };
  return DISPLAY_MAP[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
 * Activate knockout bracket and r32_pick classifications when group stage is complete.
 *
 * knockout_bracket — the bracket prediction classification
 * r32_pick — the R32 team scoring classification (pick-a-team per round)
 *
 * Both start as "draft" and are activated together once all group stages are finalised.
 */
async function activateKnockoutBracket(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<void> {
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id")
    .eq("tournament_id", tournamentId);

  const now = new Date().toISOString();
  const knockoutClassificationKeys = ["knockout_bracket", "r32_pick"];

  for (const comp of competitions ?? []) {
    await supabase
      .from("classifications")
      .update({ status: "active", updated_at: now })
      .eq("competition_id", comp.id)
      .in("classification_key", knockoutClassificationKeys)
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
 * Guard: normal admins can only confirm results for custom events (no
 * external provider, or external_event_id starts with "manual:") whose
 * sport has fewer than 2 real API providers. Everything else requires
 * super_admin so that auto-result + cross-verification can do its job.
 */
async function verifyConfirmPermission(
  supabase: SupabaseClient,
  userId: string,
  externalEventId: string | null,
  sport: string | null,
): Promise<void> {
  // Super admins bypass all restrictions
  const { data: adminUser } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", userId)
    .single();

  if (adminUser?.is_super_admin) return;

  // Check 1: must be a custom/manual event
  const isCustom =
    !externalEventId || externalEventId.startsWith("manual:");

  if (!isCustom) {
    throw new Error(
      "Only super admins can confirm results for provider-linked events. " +
      "Use the auto-result system or ask a super admin.",
    );
  }

  // Check 2: sport must have fewer than 2 real API providers
  if (sport) {
    const providers = getProvidersForSport(sport as Sport);
    const realProviders = providers.filter(
      (p) => p.name !== "fixture-pool" && p.name !== "manual",
    );
    if (realProviders.length >= 2) {
      throw new Error(
        "Only super admins can confirm results for sports with multiple API providers. " +
        "Use the auto-result system or ask a super admin.",
      );
    }
  }
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

/**
 * B4: Generate a stage-level standings snapshot after elimination runs.
 * Captures the full ranked list, who was eliminated, who survived,
 * and the qualification cutoff position.
 */
async function generateStageSnapshot(
  supabase: SupabaseClient,
  classificationId: string,
  competitionId: string,
  stageId: string,
  finalisationId: string,
  generatedBy: string | null,
  eliminationResult: EliminationResult
): Promise<void> {
  const eliminatedSet = new Set(eliminationResult.eliminated_user_ids);
  const survivorSet = new Set(eliminationResult.survivor_user_ids);

  // Build standings data from the elimination result's standings
  // Annotate each row with elimination outcome
  const standings = eliminationResult.standings_at_elimination.map((row) => ({
    ...row,
    eliminated: eliminatedSet.has(row.user_id),
    metadata: {
      ...row.metadata,
      elimination_outcome: eliminatedSet.has(row.user_id)
        ? "eliminated"
        : survivorSet.has(row.user_id)
          ? "survived"
          : "unknown",
    },
  }));

  // Determine the qualification cutoff position (last survivor rank)
  const survivorPositions = standings
    .map((s, idx) => ({ idx, survived: survivorSet.has(s.user_id) }))
    .filter((s) => s.survived);
  const cutoffPosition = survivorPositions.length > 0
    ? survivorPositions[survivorPositions.length - 1].idx + 1
    : 0;

  const snapshotMetadata = {
    eliminated_count: eliminationResult.eliminated_user_ids.length,
    survivor_count: eliminationResult.survivor_user_ids.length,
    target_survivors: eliminationResult.target_survivors,
    tie_overflow: eliminationResult.tie_overflow,
    cutoff_position: cutoffPosition,
  };

  await supabase.from("classification_standings_snapshots").insert({
    classification_id: classificationId,
    competition_id: competitionId,
    sporting_stage_id: stageId,
    finalisation_id: finalisationId,
    snapshot_type: "stage",
    standings_data: {
      standings,
      elimination_summary: snapshotMetadata,
    },
    entrant_count: standings.length,
    generated_by: generatedBy,
    generation_method: "manual",
  });
}
