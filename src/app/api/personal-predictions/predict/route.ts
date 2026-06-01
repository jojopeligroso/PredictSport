import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePersonalCompetition } from "@/lib/personal-competition";
import { requireDisplayName } from "@/lib/require-display-name";

interface PredictBody {
  event_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
}

/**
 * POST /api/personal-predictions/predict
 *
 * Upserts a prediction row in the user's personal competition.
 * No lock time enforcement — personal predictions can be changed freely
 * before the event starts.
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

  let body: PredictBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { event_id, prediction_type, prediction_data } = body;

  if (!event_id || !prediction_type || !prediction_data) {
    return NextResponse.json(
      { error: "event_id, prediction_type, and prediction_data are required" },
      { status: 400 },
    );
  }

  // Resolve personal competition (ensures user owns this context)
  let competitionId: string;
  try {
    competitionId = await getOrCreatePersonalCompetition(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve personal competition", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Verify the event belongs to the user's personal competition
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, start_time, status")
    .eq("id", event_id)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json(
      { error: "Event not found in your personal competition" },
      { status: 404 },
    );
  }

  // Block predictions after the event has started
  if (new Date(event.start_time) <= new Date()) {
    return NextResponse.json(
      { error: "This event has already started" },
      { status: 403 },
    );
  }

  if (event.status !== "upcoming") {
    return NextResponse.json(
      { error: `Event status is "${event.status}". Predictions can only be submitted for upcoming events.` },
      { status: 403 },
    );
  }

  // Resolve event_prediction_type_id
  const { data: ept, error: eptError } = await supabase
    .from("event_prediction_types")
    .select("id")
    .eq("event_id", event_id)
    .eq("prediction_type", prediction_type)
    .maybeSingle();

  if (eptError || !ept) {
    return NextResponse.json(
      { error: `Prediction type "${prediction_type}" is not configured for this event` },
      { status: 400 },
    );
  }

  // Handle clear/delete request
  if (prediction_data._clear === true) {
    const { data: existing } = await supabase
      .from("predictions")
      .select("id")
      .eq("event_prediction_type_id", ept.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("predictions").delete().eq("id", existing.id);
    }
    return NextResponse.json({ deleted: true });
  }

  // Upsert: check for existing prediction
  const { data: existing } = await supabase
    .from("predictions")
    .select("id")
    .eq("event_prediction_type_id", ept.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("predictions")
      .update({
        prediction_data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update prediction" },
        { status: 500 },
      );
    }

    return NextResponse.json({ prediction: updated });
  }

  // Insert new prediction
  const { data: created, error: insertError } = await supabase
    .from("predictions")
    .insert({
      event_prediction_type_id: ept.id,
      event_id,
      user_id: user.id,
      prediction_type,
      prediction_data,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to submit prediction" },
      { status: 500 },
    );
  }

  return NextResponse.json({ prediction: created }, { status: 201 });
}
