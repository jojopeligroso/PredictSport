import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import type { NominationStatus } from "@/types/database";

interface ReviewNominationBody {
  nomination_id: string;
  competition_id: string;
  action: "approved" | "rejected";
  admin_note?: string;
  /** When approving, optionally override nomination details for the created event */
  event_overrides?: {
    event_name?: string;
    sport?: string;
    start_time?: string;
    lock_time?: string;
    prediction_types?: Record<string, unknown>;
  };
}

/**
 * PATCH /api/admin/nominations
 * Approve or reject an event nomination.
 * When approved, automatically creates an event in the competition.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReviewNominationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.nomination_id || !body.competition_id || !body.action) {
    return NextResponse.json(
      { error: "nomination_id, competition_id, and action are required" },
      { status: 400 }
    );
  }

  const validActions: NominationStatus[] = ["approved", "rejected"];
  if (!validActions.includes(body.action)) {
    return NextResponse.json(
      { error: "action must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  // Verify admin
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

  // Fetch the nomination
  const { data: nomination, error: nomError } = await supabase
    .from("event_nominations")
    .select("*")
    .eq("id", body.nomination_id)
    .eq("competition_id", body.competition_id)
    .single();

  if (nomError || !nomination) {
    return NextResponse.json(
      { error: "Nomination not found" },
      { status: 404 }
    );
  }

  if (nomination.status !== "pending") {
    return NextResponse.json(
      { error: "Nomination has already been reviewed" },
      { status: 409 }
    );
  }

  // Update nomination status
  const { error: updateError } = await supabase
    .from("event_nominations")
    .update({
      status: body.action,
      admin_note: body.admin_note?.trim() || null,
      reviewed_by: user.id,
    })
    .eq("id", body.nomination_id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update nomination", details: updateError.message },
      { status: 500 }
    );
  }

  // If approved, create the event
  let createdEvent = null;
  if (body.action === "approved") {
    const overrides = body.event_overrides ?? {};

    // Get competition defaults for lock_time calculation
    const { data: comp } = await supabase
      .from("competitions")
      .select("lock_default_minutes")
      .eq("id", body.competition_id)
      .single();

    const lockDefaultMinutes = comp?.lock_default_minutes ?? 5;

    const startTime =
      overrides.start_time ??
      new Date(`${nomination.proposed_date}T12:00:00Z`).toISOString();

    const lockTime =
      overrides.lock_time ??
      new Date(
        new Date(startTime).getTime() - lockDefaultMinutes * 60 * 1000
      ).toISOString();

    const predictionTypes = overrides.prediction_types ??
      (nomination.proposed_prediction_type
        ? { types: [nomination.proposed_prediction_type] }
        : {});

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        competition_id: body.competition_id,
        event_name: overrides.event_name ?? nomination.event_name,
        sport: overrides.sport ?? nomination.sport,
        start_time: startTime,
        lock_time: lockTime,
        prediction_types: predictionTypes,
        nominated_by: nomination.nominated_by,
        status: "upcoming",
      })
      .select()
      .single();

    if (eventError) {
      return NextResponse.json(
        {
          error: "Nomination approved but failed to create event",
          details: eventError.message,
        },
        { status: 500 }
      );
    }

    createdEvent = event;
  }

  return NextResponse.json({
    nomination: {
      id: body.nomination_id,
      status: body.action,
      admin_note: body.admin_note || null,
    },
    event: createdEvent,
  });
}
