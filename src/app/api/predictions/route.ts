import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDisplayName } from "@/lib/require-display-name";

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

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

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

  // Handle clear/delete request (e.g., removing exact_score prediction). This
  // is the only branch that still needs a separate existence read — DELETE
  // doesn't have an upsert analogue and we want a 200 (not an error) if the
  // row was never there in the first place.
  if (prediction_data._clear === true) {
    const { error: deleteError } = await supabase
      .from("predictions")
      .delete()
      .eq("event_prediction_type_id", event_prediction_type_id)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete prediction" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: true });
  }

  // Single race-safe upsert on the (event_prediction_type_id, user_id) unique
  // constraint. Replaces the previous read-then-insert-or-update which raced
  // under rapid taps (autosave-on-blur, bracket diff-loop) and returned a
  // 409 → misleading "event may have locked" message to the user even though
  // the first-winner write had succeeded.
  const { data: saved, error: upsertError } = await supabase
    .from("predictions")
    .upsert(
      {
        event_prediction_type_id,
        event_id,
        user_id: user.id,
        prediction_type,
        prediction_data,
        ...(note_text !== undefined && { note_text }),
        ...(note_visibility && { note_visibility }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_prediction_type_id,user_id" }
    )
    .select()
    .single();

  if (upsertError) {
    // PGRST116 = no row returned after the write succeeded at the SQL layer,
    // which means RLS hid the post-write row. Caused by: event lock_time
    // passed between the EPT lookup above and this write, the competition
    // disallowing updates, or the competition no longer being active.
    const isRlsReject = upsertError.code === "PGRST116";
    return NextResponse.json(
      {
        error: isRlsReject
          ? "Can't save that pick — the match may have locked or updates are disabled for this competition."
          : "Couldn't save that pick. Please try again.",
      },
      { status: isRlsReject ? 403 : 500 }
    );
  }

  return NextResponse.json({ prediction: saved });
}
