import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import type { EventStatus } from "@/types/database";

interface CreateEventBody {
  competition_id: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  prediction_types: Record<string, unknown>;
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
  prediction_types?: Record<string, unknown>;
  status?: EventStatus;
  result_data?: Record<string, unknown> | null;
  external_event_id?: string | null;
}

const VALID_SPORTS = [
  "formula_1", "soccer", "golf", "rugby", "tennis",
  "gaa", "horse_racing", "snooker", "mlb", "nfl", "nba", "nhl",
];

const VALID_STATUSES: EventStatus[] = [
  "upcoming", "locked", "resulted", "postponed", "cancelled",
];

/**
 * POST /api/admin/events
 * Create a new event in a competition.
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

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      competition_id: body.competition_id,
      event_name: body.event_name.trim(),
      sport: body.sport,
      start_time: body.start_time,
      lock_time: body.lock_time,
      prediction_types: body.prediction_types || {},
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

  return NextResponse.json({ event }, { status: 201 });
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
  if (body.prediction_types !== undefined)
    updates.prediction_types = body.prediction_types;
  if (body.status !== undefined) updates.status = body.status;
  if (body.result_data !== undefined) updates.result_data = body.result_data;
  if (body.external_event_id !== undefined)
    updates.external_event_id = body.external_event_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data: event, error } = await supabase
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

  return NextResponse.json({ event });
}
