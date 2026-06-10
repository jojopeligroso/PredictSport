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
      "id, event:events!inner(id, competition_id, tournament_id, lock_time, status)"
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
    event: { id: string; competition_id: string; tournament_id: string | null; lock_time: string; status: string };
  }).event;

  if (eptEvent.competition_id !== competition_id) {
    // For tournament events, verify user's competition shares the same blueprint
    if (!eptEvent.tournament_id) {
      return NextResponse.json(
        { error: "Event not found in this competition" },
        { status: 404 }
      );
    }
    const { data: userComp } = await supabase
      .from("competitions")
      .select("tournament_id")
      .eq("id", competition_id)
      .single();
    if (userComp?.tournament_id !== eptEvent.tournament_id) {
      return NextResponse.json(
        { error: "Event not found in this competition" },
        { status: 404 }
      );
    }
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

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { event_id, competition_id } = body as {
    event_id?: string;
    competition_id?: string;
  };

  if (!event_id) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  // Verify event exists and is not locked
  const { data: event } = await supabase
    .from("events")
    .select("lock_time, status")
    .eq("id", event_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (new Date(event.lock_time) <= new Date() || event.status !== "upcoming") {
    return NextResponse.json({ error: "Event is locked" }, { status: 403 });
  }

  // Delete all predictions for this event/user (or scoped to competition if provided)
  let query = supabase
    .from("predictions")
    .delete()
    .eq("event_id", event_id)
    .eq("user_id", user.id);

  // If competition_id provided, scope deletion (for shared events across competitions)
  if (competition_id) {
    query = query.eq("competition_id", competition_id);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to reset prediction:", error);
    return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
