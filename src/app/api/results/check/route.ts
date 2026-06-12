import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  autoResolveEvent,
  type AutoResultEvent,
} from "@/lib/sports/auto-result";
import { notifyResultConfirmed } from "@/lib/notifications/result-confirmed";

/**
 * POST /api/results/check
 *
 * User-triggered result check for a single event. Runs the same
 * autoResolveEvent logic as the cron, but for one event only.
 * Requires the user to be a member of the event's competition.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { event_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event_id) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  // Fetch the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, event_name, sport, start_time, lock_time, external_event_id, provider_league, result_data, competition_id, result_confirmed, status"
    )
    .eq("id", body.event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Already confirmed — nothing to do
  if (event.result_confirmed) {
    return NextResponse.json({ status: "already_confirmed" });
  }

  // Must be past start time
  if (new Date(event.start_time) > new Date()) {
    return NextResponse.json(
      { error: "Match has not started yet" },
      { status: 400 }
    );
  }

  // Verify user is a competition member
  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", event.competition_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Use service client for autoResolveEvent (needs write access)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Service config missing" },
      { status: 500 }
    );
  }
  const serviceClient = createServiceClient(url, key);

  const outcome = await autoResolveEvent(
    serviceClient,
    event as AutoResultEvent,
    new Date()
  );

  // If confirmed, fire notifications
  if (outcome.status === "confirmed") {
    const resultData = (
      await serviceClient
        .from("events")
        .select("result_data")
        .eq("id", event.id)
        .single()
    ).data?.result_data as Record<string, unknown>;

    notifyResultConfirmed(
      event.id,
      event.competition_id,
      event.event_name,
      resultData ?? {},
    ).catch(() => {});
  }

  return NextResponse.json({
    status: outcome.status,
    message: outcome.message ?? null,
  });
}
