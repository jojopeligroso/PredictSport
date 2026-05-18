import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePersonalCompetition } from "@/lib/personal-competition";

interface EventRow {
  id: string;
  external_event_id: string;
  event_name: string;
  sport: string;
  start_time: string;
  status: string;
  provider_league: string | null;
  result_data: Record<string, unknown> | null;
}

interface EptRow {
  id: string;
  event_id: string;
  prediction_type: string;
  config: Record<string, unknown> | null;
}

interface PredictionRow {
  id: string;
  event_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
  is_correct: boolean | null;
  event_prediction_type_id: string;
}

/**
 * GET /api/personal-predictions/list
 *
 * Returns all events in the user's personal competition with their
 * prediction types and the user's predictions, assembled per-event.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let competitionId: string;
  try {
    competitionId = await getOrCreatePersonalCompetition(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve personal competition", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Fetch events for this personal competition
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, external_event_id, event_name, sport, start_time, status, provider_league, result_data")
    .eq("competition_id", competitionId)
    .order("start_time", { ascending: false });

  if (eventsError) {
    return NextResponse.json(
      { error: "Failed to fetch events", details: eventsError.message },
      { status: 500 },
    );
  }

  const typedEvents = (events ?? []) as EventRow[];

  if (typedEvents.length === 0) {
    return NextResponse.json({ events: [] });
  }

  const eventIds = typedEvents.map((e) => e.id);

  // Fetch EPTs and predictions in parallel
  const [eptsResult, predsResult] = await Promise.all([
    supabase
      .from("event_prediction_types")
      .select("id, event_id, prediction_type, config")
      .in("event_id", eventIds),
    supabase
      .from("predictions")
      .select("id, event_id, prediction_type, prediction_data, is_correct, event_prediction_type_id")
      .eq("user_id", user.id)
      .in("event_id", eventIds),
  ]);

  if (eptsResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch prediction types", details: eptsResult.error.message },
      { status: 500 },
    );
  }

  if (predsResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch predictions", details: predsResult.error.message },
      { status: 500 },
    );
  }

  const epts = (eptsResult.data ?? []) as EptRow[];
  const preds = (predsResult.data ?? []) as PredictionRow[];

  // Index EPTs by event_id
  const eptsByEvent = new Map<string, EptRow[]>();
  for (const ept of epts) {
    const list = eptsByEvent.get(ept.event_id) ?? [];
    list.push(ept);
    eptsByEvent.set(ept.event_id, list);
  }

  // Index predictions by event_id
  const predsByEvent = new Map<string, PredictionRow[]>();
  for (const pred of preds) {
    const list = predsByEvent.get(pred.event_id) ?? [];
    list.push(pred);
    predsByEvent.set(pred.event_id, list);
  }

  // Assemble response
  const result = typedEvents.map((event) => {
    const eventEpts = eptsByEvent.get(event.id) ?? [];
    const eventPreds = predsByEvent.get(event.id) ?? [];

    // Extract participants from winner EPT config.options (filter out "Draw")
    const winnerEpt = eventEpts.find((e) => e.prediction_type === "winner");
    const rawOptions = (winnerEpt?.config?.options ?? []) as string[];
    const participants = rawOptions.filter((o) => o !== "Draw");

    // Build predictions map by type
    const predictions: Record<string, {
      id: string;
      data: Record<string, unknown>;
      is_correct: boolean | null;
      ept_id: string;
    }> = {};

    for (const pred of eventPreds) {
      let normalizedData = pred.prediction_data;

      // Normalize legacy positional identifiers to team names
      if (pred.prediction_type === "winner" && normalizedData.value) {
        const val = String(normalizedData.value).toLowerCase();
        if (val === "home" && participants.length >= 1) {
          normalizedData = { ...normalizedData, value: participants[0] };
        } else if (val === "away" && participants.length >= 2) {
          normalizedData = { ...normalizedData, value: participants[participants.length - 1] };
        } else if (val === "draw") {
          normalizedData = { ...normalizedData, value: "Draw" };
        }
      }

      predictions[pred.prediction_type] = {
        id: pred.id,
        data: normalizedData,
        is_correct: pred.is_correct,
        ept_id: pred.event_prediction_type_id,
      };
    }

    // Prediction types list (id + type)
    const predictionTypes = eventEpts.map((e) => ({
      id: e.id,
      prediction_type: e.prediction_type,
    }));

    return {
      event_id: event.id,
      external_event_id: event.external_event_id,
      event_name: event.event_name,
      sport: event.sport,
      start_time: event.start_time,
      status: event.status,
      provider_league: event.provider_league,
      result_data: event.result_data,
      participants,
      predictions,
      prediction_types: predictionTypes,
    };
  });

  return NextResponse.json({ events: result });
}
