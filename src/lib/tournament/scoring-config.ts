import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventPredictionType } from "@/types/database";

/**
 * Creates the correct EventPredictionType rows for a World Cup event.
 * Group stage: winner (2pts) + exact_score (3pts) = max 5pts
 * Knockout: winner (2pts) + exact_score (3pts) + head_to_head advancing team (1pt) = max 6pts
 */
export async function createWorldCupEventEPTs(
  supabase: SupabaseClient,
  eventId: string,
  stageType: "group" | "knockout",
  teams: [string, string]
): Promise<EventPredictionType[]> {
  const rows: Array<{
    event_id: string;
    prediction_type: string;
    points: number;
    partial_points: number;
    config: Record<string, unknown>;
  }> = [
    // Match outcome (winner prediction type)
    {
      event_id: eventId,
      prediction_type: "winner",
      points: 2,
      partial_points: 0,
      config: { allow_draw: true, options: [teams[0], teams[1]] },
    },
    // Exact score bonus
    {
      event_id: eventId,
      prediction_type: "exact_score",
      points: 3,
      partial_points: 0,
      config: {},
    },
  ];

  // Knockout matches get an additional advancing team prediction
  if (stageType === "knockout") {
    rows.push({
      event_id: eventId,
      prediction_type: "head_to_head",
      points: 1,
      partial_points: 0,
      config: { options: [teams[0], teams[1]], allow_draw: false },
    });
  }

  const { data, error } = await supabase
    .from("event_prediction_types")
    .insert(rows)
    .select();

  if (error) {
    throw new Error(`Failed to create EPTs for event ${eventId}: ${error.message}`);
  }

  return data as EventPredictionType[];
}

/**
 * Classification-aware scoring aggregation.
 * Overall: sum all points across all finalised windows (cumulative).
 */
export async function aggregateOverallPoints(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string
): Promise<number> {
  // Resolve tournament_id for shared fixture scoring
  const { data: comp } = await supabase
    .from("competitions")
    .select("tournament_id")
    .eq("id", competitionId)
    .single();

  const { data, error } = comp?.tournament_id
    ? await supabase
        .from("predictions")
        .select("points_awarded, events!inner(tournament_id, status)")
        .eq("user_id", userId)
        .eq("events.tournament_id", comp.tournament_id)
        .eq("events.status", "resulted")
    : await supabase
        .from("predictions")
        .select("points_awarded, events!inner(competition_id, status)")
        .eq("user_id", userId)
        .eq("events.competition_id", competitionId)
        .eq("events.status", "resulted");

  if (error) {
    throw new Error(`Failed to aggregate overall points: ${error.message}`);
  }

  return (data ?? []).reduce(
    (sum: number, p: { points_awarded: number }) => sum + p.points_awarded,
    0
  );
}

/**
 * Format: sum points only for events in a specific sporting stage (stage-local, resets per stage).
 */
export async function aggregateFormatStagePoints(
  supabase: SupabaseClient,
  userId: string,
  classificationId: string,
  stageId: string
): Promise<number> {
  // Get events mapped to this classification + stage
  const { data: classEvents, error: ceError } = await supabase
    .from("classification_events")
    .select("event_id")
    .eq("classification_id", classificationId)
    .eq("sporting_stage_id", stageId)
    .eq("counts_for_scoring", true);

  if (ceError) {
    throw new Error(`Failed to get classification events: ${ceError.message}`);
  }

  if (!classEvents || classEvents.length === 0) return 0;

  const eventIds = classEvents.map((ce: { event_id: string | null }) => ce.event_id).filter(Boolean) as string[];

  const { data: predictions, error: predError } = await supabase
    .from("predictions")
    .select("points_awarded")
    .eq("user_id", userId)
    .in("event_id", eventIds);

  if (predError) {
    throw new Error(`Failed to aggregate format stage points: ${predError.message}`);
  }

  return (predictions ?? []).reduce(
    (sum: number, p: { points_awarded: number }) => sum + p.points_awarded,
    0
  );
}
