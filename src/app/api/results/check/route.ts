import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  autoResolveEvent,
  type AutoResultEvent,
} from "@/lib/sports/auto-result";

/**
 * POST /api/results/check
 *
 * User-triggered result check for a single event. Runs the same
 * autoResolveEvent logic as the cron, but for one event only.
 * Requires the user to be a member of the event's competition.
 *
 * Notifications (chat message + push) are handled inside
 * autoResolveEvent — do NOT call notifyResultConfirmed here.
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

  if (!body.event_id || typeof body.event_id !== "string") {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  // Verify membership first, then fetch event details
  const { data: membership } = await supabase
    .from("competition_members")
    .select("competition_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Fetch the event (RLS scopes to visible events)
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, event_name, sport, start_time, external_event_id, provider_league, result_data, competition_id, result_confirmed"
    )
    .eq("id", body.event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.result_confirmed) {
    return NextResponse.json({ status: "already_confirmed" });
  }

  if (new Date(event.start_time) > new Date()) {
    return NextResponse.json(
      { error: "Match has not started yet" },
      { status: 400 }
    );
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

  return NextResponse.json({
    status: outcome.status,
    message: outcome.message ?? null,
  });
}
