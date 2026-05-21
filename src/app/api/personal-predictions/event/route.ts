import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePersonalCompetition } from "@/lib/personal-competition";
import { getPersonalDefaults } from "@/lib/personal-prediction-defaults";
import { hasTBAParticipant } from "@/lib/sports/tba-detection";
import type { Sport } from "@/lib/sports/types";

interface CreatePersonalEventBody {
  external_event_id: string;
  event_name: string;
  sport: string;
  start_time: string;
  participants: string[];
  competition_name?: string;
  provider_league?: string | null;
}

/**
 * POST /api/personal-predictions/event
 *
 * Atomically creates an event + event_prediction_types in the user's personal
 * competition. Idempotent on external_event_id — returns the existing event if
 * already created.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreatePersonalEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.external_event_id || !body.event_name?.trim() || !body.sport || !body.start_time) {
    return NextResponse.json(
      { error: "external_event_id, event_name, sport, and start_time are required" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.participants) || body.participants.length === 0) {
    return NextResponse.json(
      { error: "participants array is required and must be non-empty" },
      { status: 400 },
    );
  }

  if (hasTBAParticipant(body.participants)) {
    return NextResponse.json(
      { error: "tba_fixture", message: "Cannot create predictions for fixtures with unconfirmed participants" },
      { status: 422 },
    );
  }

  // Resolve personal competition
  let competitionId: string;
  try {
    competitionId = await getOrCreatePersonalCompetition(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve personal competition", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Idempotency: check if event already exists for this fixture in the user's personal competition
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("external_event_id", body.external_event_id)
    .single();

  if (existing) {
    // Return existing event with its prediction types
    const { data: epts } = await supabase
      .from("event_prediction_types")
      .select("*")
      .eq("event_id", existing.id);

    return NextResponse.json({
      event_id: existing.id,
      competition_id: competitionId,
      prediction_types: epts ?? [],
      created: false,
    });
  }

  // Build event_prediction_types based on sport/participants
  const predictionTypeRows = getPersonalDefaults(body.sport as Sport, body.participants);

  // Insert event (lock_time = start_time for personal predictions — no early lock needed)
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      competition_id: competitionId,
      round_id: null,
      event_name: body.event_name.trim(),
      sport: body.sport,
      start_time: body.start_time,
      lock_time: body.start_time,
      external_event_id: body.external_event_id,
      provider_league: body.provider_league ?? null,
      status: "upcoming",
    })
    .select("id")
    .single();

  if (eventError) {
    // Race condition: another request created it between our check and insert
    if (eventError.code === "23505") {
      const { data: raced } = await supabase
        .from("events")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("external_event_id", body.external_event_id)
        .single();

      if (raced) {
        const { data: epts } = await supabase
          .from("event_prediction_types")
          .select("*")
          .eq("event_id", raced.id);

        return NextResponse.json({
          event_id: raced.id,
          competition_id: competitionId,
          prediction_types: epts ?? [],
          created: false,
        });
      }
    }
    return NextResponse.json(
      { error: "Failed to create event", details: eventError.message },
      { status: 500 },
    );
  }

  // Insert event_prediction_types
  const eptInserts = predictionTypeRows.map((pt) => ({
    event_id: event.id,
    ...pt,
  }));

  const { data: predictionTypes, error: eptError } = await supabase
    .from("event_prediction_types")
    .insert(eptInserts)
    .select();

  if (eptError) {
    // Rollback the event
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json(
      { error: "Failed to create prediction types", details: eptError.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      event_id: event.id,
      competition_id: competitionId,
      prediction_types: predictionTypes,
      created: true,
    },
    { status: 201 },
  );
}
