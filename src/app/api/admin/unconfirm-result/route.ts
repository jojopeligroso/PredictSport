import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { requireDisplayName } from "@/lib/require-display-name";

interface UnconfirmResultBody {
  event_id: string;
}

/**
 * POST /api/admin/unconfirm-result
 * Reverse a confirmed result. Resets result_confirmed to false, status back
 * to 'locked', clears result_confirmed_by, and nullifies all prediction scores.
 *
 * This is the inverse of /api/admin/confirm-result. No time window restriction
 * — admins need this as an unconditional escape hatch.
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

  let body: UnconfirmResultBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.event_id) {
    return NextResponse.json(
      { error: "event_id is required" },
      { status: 400 }
    );
  }

  // Fetch the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, competition_id, result_confirmed, event_name")
    .eq("id", body.event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Verify caller is admin/co_admin of the event's competition
  const member = await verifyCompetitionAdmin(
    supabase,
    user.id,
    event.competition_id
  );
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  // Guard: result must already be confirmed
  if (!event.result_confirmed) {
    return NextResponse.json(
      { error: "Result not confirmed" },
      { status: 400 }
    );
  }

  // Atomically revert — only if result_confirmed is still true (race condition guard)
  const { data: revertedEvent, error: updateError } = await supabase
    .from("events")
    .update({
      result_confirmed: false,
      status: "locked",
      result_confirmed_by: null,
    })
    .eq("id", body.event_id)
    .eq("result_confirmed", true)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to unconfirm result", details: updateError.message },
      { status: 500 }
    );
  }

  if (!revertedEvent) {
    // Concurrent request already unconfirmed it
    return NextResponse.json(
      { error: "Result was already unconfirmed by a concurrent request" },
      { status: 409 }
    );
  }

  // Reset all predictions for this event
  const { data: resetPredictions, error: predError } = await supabase
    .from("predictions")
    .update({
      is_correct: null,
      is_partial: false,
      points_awarded: 0,
    })
    .eq("event_id", body.event_id)
    .select("id");

  if (predError) {
    return NextResponse.json(
      { error: "Event unconfirmed but failed to reset predictions", details: predError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    event_id: body.event_id,
    predictions_reset: (resetPredictions ?? []).length,
  });
}
