import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PredictionRequestBody {
  event_id?: string;
  competition_id?: string;
  prediction_type?: string;
  prediction_data?: Record<string, unknown>;
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

  const { event_id, competition_id, prediction_type, prediction_data } = body;

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

  // Verify user is a member of the competition
  const { data: membership, error: membershipError } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competition_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "You are not a member of this competition" },
      { status: 403 }
    );
  }

  // Verify event exists, belongs to the competition, and is not locked
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, competition_id, lock_time, status")
    .eq("id", event_id)
    .eq("competition_id", competition_id)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json(
      { error: "Event not found in this competition" },
      { status: 404 }
    );
  }

  // Server-side lock check
  const now = new Date();
  const lockTime = new Date(event.lock_time);

  if (lockTime <= now) {
    return NextResponse.json(
      { error: "This event is locked. Predictions can no longer be submitted." },
      { status: 403 }
    );
  }

  if (event.status !== "upcoming") {
    return NextResponse.json(
      {
        error: `Event status is "${event.status}". Predictions can only be submitted for upcoming events.`,
      },
      { status: 403 }
    );
  }

  // Check for existing prediction (upsert)
  const { data: existing } = await supabase
    .from("predictions")
    .select("id")
    .eq("event_id", event_id)
    .eq("user_id", user.id)
    .eq("prediction_type", prediction_type)
    .maybeSingle();

  if (existing) {
    // Update existing prediction
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
        { status: 500 }
      );
    }

    return NextResponse.json({ prediction: updated });
  }

  // Insert new prediction
  const { data: created, error: insertError } = await supabase
    .from("predictions")
    .insert({
      event_id,
      user_id: user.id,
      prediction_type,
      prediction_data,
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
