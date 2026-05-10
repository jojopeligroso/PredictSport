import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import type { EventStatus, PredictionType } from "@/types/database";

interface PredictionTypeInput {
  prediction_type: PredictionType;
  points?: number;
  partial_points?: number;
  config?: Record<string, unknown> | null;
}

interface CreateEventBody {
  competition_id: string;
  round_id?: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  prediction_type_configs: PredictionTypeInput[];
  external_event_id?: string;
  nominated_by?: string;
}

interface UpdateEventBody {
  event_id: string;
  competition_id: string;
  event_name?: string;
  sport?: string;
  start_time?: string;
  lock_time?: string;
  prediction_type_configs?: PredictionTypeInput[];
  status?: EventStatus;
  result_data?: Record<string, unknown> | null;
  external_event_id?: string | null;
}

const VALID_SPORTS = [
  "formula_1", "soccer", "golf", "rugby", "tennis",
  "gaa", "horse_racing", "snooker", "cricket", "athletics", "mlb", "nfl", "nba", "nhl",
];

const VALID_PREDICTION_TYPES: PredictionType[] = [
  "winner", "top_n", "final_standings", "head_to_head", "margin",
  "over_under", "handicap", "yes_no", "progression",
];

const VALID_STATUSES: EventStatus[] = [
  "upcoming", "locked", "resulted", "postponed", "cancelled",
];

/** Default points per prediction type (used when competition scoring_rules has no override). */
const DEFAULT_POINTS: Record<PredictionType, number> = {
  winner: 10, top_n: 5, final_standings: 10, head_to_head: 5, margin: 10,
  over_under: 5, handicap: 5, yes_no: 10, progression: 10,
};

const DEFAULT_PARTIAL_POINTS: Record<string, number> = {
  margin: 5, top_n: 3,
};

/**
 * Resolve default points for a prediction type, falling back through:
 * 1. Explicit value in the request
 * 2. Competition scoring_rules
 * 3. Hard-coded defaults
 */
function resolvePoints(
  input: PredictionTypeInput,
  scoringRules: Record<string, unknown>,
): { points: number; partial_points: number } {
  const srPoints = (scoringRules.points as Record<string, number> | undefined);
  const srPartial = (scoringRules.partial_points as Record<string, number> | undefined);

  return {
    points: input.points
      ?? srPoints?.[input.prediction_type]
      ?? DEFAULT_POINTS[input.prediction_type],
    partial_points: input.partial_points
      ?? srPartial?.[input.prediction_type]
      ?? DEFAULT_PARTIAL_POINTS[input.prediction_type]
      ?? 0,
  };
}

/**
 * POST /api/admin/events
 * Create a new event with event_prediction_types rows.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id) {
    return NextResponse.json(
      { error: "competition_id is required" },
      { status: 400 }
    );
  }

  // Verify admin role
  const member = await verifyCompetitionAdmin(
    supabase,
    user.id,
    body.competition_id
  );
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  // Validate fields
  if (!body.event_name?.trim()) {
    return NextResponse.json(
      { error: "Event name is required" },
      { status: 400 }
    );
  }

  if (!body.sport || !VALID_SPORTS.includes(body.sport)) {
    return NextResponse.json(
      { error: "Invalid or missing sport" },
      { status: 400 }
    );
  }

  if (!body.start_time) {
    return NextResponse.json(
      { error: "Start time is required" },
      { status: 400 }
    );
  }

  if (!body.lock_time) {
    return NextResponse.json(
      { error: "Lock time is required" },
      { status: 400 }
    );
  }

  if (!body.prediction_type_configs || body.prediction_type_configs.length === 0) {
    return NextResponse.json(
      { error: "At least one prediction type is required" },
      { status: 400 }
    );
  }

  // Validate prediction types
  for (const ptc of body.prediction_type_configs) {
    if (!VALID_PREDICTION_TYPES.includes(ptc.prediction_type)) {
      return NextResponse.json(
        { error: `Invalid prediction type: ${ptc.prediction_type}` },
        { status: 400 }
      );
    }
  }

  // Fetch competition scoring_rules for defaults
  const { data: competition } = await supabase
    .from("competitions")
    .select("scoring_rules")
    .eq("id", body.competition_id)
    .single();

  const scoringRules = (competition?.scoring_rules ?? {}) as Record<string, unknown>;

  // Insert the event
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      competition_id: body.competition_id,
      round_id: body.round_id || null,
      event_name: body.event_name.trim(),
      sport: body.sport,
      start_time: body.start_time,
      lock_time: body.lock_time,
      external_event_id: body.external_event_id || null,
      nominated_by: body.nominated_by || null,
      status: "upcoming",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create event", details: error.message },
      { status: 500 }
    );
  }

  // Insert event_prediction_types rows
  const eptRows = body.prediction_type_configs.map((ptc) => {
    const { points, partial_points } = resolvePoints(ptc, scoringRules);
    return {
      event_id: event.id,
      prediction_type: ptc.prediction_type,
      points,
      partial_points,
      config: ptc.config ?? null,
    };
  });

  const { data: predictionTypes, error: eptError } = await supabase
    .from("event_prediction_types")
    .insert(eptRows)
    .select();

  if (eptError) {
    // Rollback: delete the event if prediction types fail
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json(
      { error: "Failed to create prediction types", details: eptError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { event, prediction_types: predictionTypes },
    { status: 201 }
  );
}

/**
 * PATCH /api/admin/events
 * Update an existing event.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpdateEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.event_id || !body.competition_id) {
    return NextResponse.json(
      { error: "event_id and competition_id are required" },
      { status: 400 }
    );
  }

  const member = await verifyCompetitionAdmin(
    supabase,
    user.id,
    body.competition_id
  );
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid event status" },
      { status: 400 }
    );
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {};
  if (body.event_name !== undefined) updates.event_name = body.event_name.trim();
  if (body.sport !== undefined) updates.sport = body.sport;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.lock_time !== undefined) updates.lock_time = body.lock_time;
  if (body.status !== undefined) updates.status = body.status;
  if (body.result_data !== undefined) updates.result_data = body.result_data;
  if (body.external_event_id !== undefined)
    updates.external_event_id = body.external_event_id;

  if (Object.keys(updates).length === 0 && !body.prediction_type_configs) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  let event = null;
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", body.event_id)
      .eq("competition_id", body.competition_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update event", details: error.message },
        { status: 500 }
      );
    }
    event = data;
  }

  // Update prediction types if provided (replace all)
  if (body.prediction_type_configs) {
    // Check that no predictions exist yet (immutable once predictions are made)
    const { count } = await supabase
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", body.event_id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Cannot modify prediction types after predictions have been submitted" },
        { status: 409 }
      );
    }

    // Fetch competition scoring_rules for defaults
    const { data: competition } = await supabase
      .from("competitions")
      .select("scoring_rules")
      .eq("id", body.competition_id)
      .single();

    const scoringRules = (competition?.scoring_rules ?? {}) as Record<string, unknown>;

    // Insert new rows first, then delete the old ones only on success.
    // This avoids a window where the event has zero prediction types
    // if the insert fails after the delete has already run.
    const eptRows = body.prediction_type_configs.map((ptc) => {
      const { points, partial_points } = resolvePoints(ptc, scoringRules);
      return {
        event_id: body.event_id,
        prediction_type: ptc.prediction_type,
        points,
        partial_points,
        config: ptc.config ?? null,
      };
    });

    // Fetch existing prediction type ids so we can delete them after the insert succeeds
    const { data: existingEpts } = await supabase
      .from("event_prediction_types")
      .select("id")
      .eq("event_id", body.event_id);

    const { error: eptError } = await supabase
      .from("event_prediction_types")
      .insert(eptRows);

    if (eptError) {
      return NextResponse.json(
        { error: "Failed to update prediction types", details: eptError.message },
        { status: 500 }
      );
    }

    // Insert succeeded — now safe to remove the old rows
    if (existingEpts && existingEpts.length > 0) {
      await supabase
        .from("event_prediction_types")
        .delete()
        .in("id", existingEpts.map((r) => r.id));
    }
  }

  // Re-fetch event if not already fetched
  if (!event) {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", body.event_id)
      .single();
    event = data;
  }

  return NextResponse.json({ event });
}

/**
 * DELETE /api/admin/events
 *
 * Delete an event and its prediction types. Only allowed if the event has no
 * predictions submitted against it.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { event_id, competition_id } = body as {
    event_id: string;
    competition_id: string;
  };

  if (!event_id || !competition_id) {
    return NextResponse.json(
      { error: "event_id and competition_id are required" },
      { status: 400 }
    );
  }

  // Verify admin access
  const adminError = await verifyCompetitionAdmin(supabase, user.id, competition_id);
  if (adminError) {
    return NextResponse.json({ error: adminError }, { status: 403 });
  }

  // Verify the event belongs to this competition
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, competition_id")
    .eq("id", event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.competition_id !== competition_id) {
    return NextResponse.json(
      { error: "Event does not belong to this competition" },
      { status: 403 }
    );
  }

  // Check for existing predictions — block deletion if any exist
  const { count } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event_id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} prediction(s) already submitted. Cancel the event instead.` },
      { status: 409 }
    );
  }

  // Delete prediction types first (FK constraint)
  await supabase
    .from("event_prediction_types")
    .delete()
    .eq("event_id", event_id);

  // Delete the event
  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", event_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete event", details: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
