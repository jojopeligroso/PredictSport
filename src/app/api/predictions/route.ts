import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PredictionRequestBody {
  event_id?: string;
  competition_id?: string;
  prediction_type?: string;
  prediction_data?: Record<string, unknown>;
  note_text?: string;
  note_visibility?: "public" | "private";
}

const VALID_PREDICTION_TYPES = [
  "winner",
  "top_n",
  "final_standings",
  "head_to_head",
  "margin",
  "over_under",
  "handicap",
  "yes_no",
  "progression",
  "exact_score",
] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Parse body
  let body: PredictionRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { event_id, competition_id, prediction_type, prediction_data, note_text, note_visibility } = body;

  // Validate required fields
  if (!event_id || !competition_id || !prediction_type || !prediction_data) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: event_id, competition_id, prediction_type, prediction_data",
      },
      { status: 400 }
    );
  }

  // Validate prediction type
  if (
    !VALID_PREDICTION_TYPES.includes(
      prediction_type as (typeof VALID_PREDICTION_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      { error: `Invalid prediction type: ${prediction_type}` },
      { status: 400 }
    );
  }

  // Resolve event_prediction_type + event in one round-trip. The embedded
  // event lets us also sanity-check competition_id and surface a useful error
  // before we hand the write to RLS. RLS itself enforces membership, lock_time,
  // competition.status='active', and allow_prediction_updates — so the
  // previous separate membership/competition/event/lock pre-checks were
  // redundant latency. They added ~4 round-trips per tap and contributed to
  // the "selection is too slow" feel.
  const { data: ept, error: eptError } = await supabase
    .from("event_prediction_types")
    .select(
      "id, event:events!inner(id, competition_id, lock_time, status)"
    )
    .eq("event_id", event_id)
    .eq("prediction_type", prediction_type)
    .maybeSingle();

  if (eptError || !ept) {
    return NextResponse.json(
      { error: `Prediction type "${prediction_type}" is not configured for this event` },
      { status: 400 }
    );
  }

  const eptEvent = (ept as unknown as {
    event: { id: string; competition_id: string; lock_time: string; status: string };
  }).event;

  if (eptEvent.competition_id !== competition_id) {
    return NextResponse.json(
      { error: "Event not found in this competition" },
      { status: 404 }
    );
  }

  if (new Date(eptEvent.lock_time) <= new Date()) {
    return NextResponse.json(
      { error: "This event is locked. Predictions can no longer be submitted." },
      { status: 403 }
    );
  }

  if (eptEvent.status !== "upcoming") {
    return NextResponse.json(
      {
        error: `Event status is "${eptEvent.status}". Predictions can only be submitted for upcoming events.`,
      },
      { status: 403 }
    );
  }

  const event_prediction_type_id = ept.id;

  // Check for existing prediction (upsert). RLS will block the actual write if
  // the competition disallows updates, so we don't need a separate competition
  // lookup just to check that flag.
  const { data: existing } = await supabase
    .from("predictions")
    .select("id")
    .eq("event_prediction_type_id", event_prediction_type_id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Handle clear/delete request (e.g., removing exact_score prediction)
  if (prediction_data._clear === true && existing) {
    const { error: deleteError } = await supabase
      .from("predictions")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete prediction" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true });
  }

  // If clearing a non-existent prediction, just return success
  if (prediction_data._clear === true) {
    return NextResponse.json({ deleted: true });
  }

  if (existing) {
    // Update existing prediction
    const { data: updated, error: updateError } = await supabase
      .from("predictions")
      .update({
        prediction_data,
        ...(note_text !== undefined && { note_text }),
        ...(note_visibility && { note_visibility }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      // PGRST116 = no row returned, which after a successful WHERE-id update
      // means RLS hid the row from us. That happens when the competition
      // disallows prediction updates, when the event has locked between this
      // request and the prior read, or when the competition is no longer
      // active.
      const isRlsReject = updateError.code === "PGRST116";
      return NextResponse.json(
        {
          error: isRlsReject
            ? "Can't change this pick — the match may have locked or updates are disabled for this competition."
            : "Failed to update prediction",
        },
        { status: isRlsReject ? 403 : 500 }
      );
    }

    return NextResponse.json({ prediction: updated });
  }

  // Insert new prediction
  const { data: created, error: insertError } = await supabase
    .from("predictions")
    .insert({
      event_prediction_type_id,
      event_id,
      user_id: user.id,
      prediction_type,
      prediction_data,
      ...(note_text !== undefined && { note_text }),
      ...(note_visibility && { note_visibility }),
    })
    .select()
    .single();

  if (insertError) {
    // Could be RLS rejection if lock_time has passed between check and insert
    return NextResponse.json(
      { error: "Failed to submit prediction. The event may have locked." },
      { status: 500 }
    );
  }

  return NextResponse.json({ prediction: created }, { status: 201 });
}
