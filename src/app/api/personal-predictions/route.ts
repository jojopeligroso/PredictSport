import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchResult } from "@/lib/sports/fetch-result";
import type { Sport } from "@/lib/sports/types";

function determineIsCorrect(predictionValue: string, winner: string | null, participants: string[]): boolean {
  if (predictionValue === "draw") return winner === null;
  if (predictionValue === "home") {
    const home = participants[0] ?? "";
    return winner !== null && (
      winner.toLowerCase() === home.toLowerCase() ||
      winner.toLowerCase().includes(home.toLowerCase()) ||
      home.toLowerCase().includes(winner.toLowerCase())
    );
  }
  if (predictionValue === "away") {
    const away = participants[1] ?? "";
    return winner !== null && (
      winner.toLowerCase() === away.toLowerCase() ||
      winner.toLowerCase().includes(away.toLowerCase()) ||
      away.toLowerCase().includes(winner.toLowerCase())
    );
  }
  // Direct name match (race sports)
  return winner !== null && winner.toLowerCase() === predictionValue.toLowerCase();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("personal_predictions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-fetch results for past picks that have no result yet
  const now = new Date();
  const needsResult = (data ?? []).filter(
    (p) => p.result_value === null && new Date(p.start_time) <= now
  );

  if (needsResult.length > 0) {
    const toFetch = needsResult.slice(0, 10);
    const results = await Promise.allSettled(
      toFetch.map(async (pick) => {
        const result = await fetchResult(pick.sport as Sport, pick.external_event_id, pick.provider_league ?? undefined);
        if (!result?.is_final) return; // skip non-final / no result

        const participants: string[] = Array.isArray(pick.participants) ? pick.participants as string[] : [];
        const isCorrect = determineIsCorrect(pick.prediction_value, result.winner, participants);

        await supabase
          .from("personal_predictions")
          .update({ result_value: result.winner ?? "draw", is_correct: isCorrect })
          .eq("id", pick.id);

        // Mutate in-memory so the response reflects updated state
        pick.result_value = result.winner ?? "draw";
        pick.is_correct = isCorrect;
      })
    );
    void results; // allSettled — we don't care about individual failures
  }

  return NextResponse.json({ predictions: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    external_event_id?: string;
    event_name?: string;
    sport?: string;
    competition_name?: string;
    participants?: string[];
    start_time?: string;
    prediction_value?: string;
    provider_league?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    external_event_id,
    event_name,
    sport,
    competition_name,
    participants,
    start_time,
    prediction_value,
    provider_league,
  } = body;

  if (!external_event_id || !event_name || !sport || !start_time || !prediction_value) {
    return NextResponse.json(
      { error: "Missing required fields: external_event_id, event_name, sport, start_time, prediction_value" },
      { status: 400 }
    );
  }

  // Lock at start_time — can't predict once the event has started
  if (new Date(start_time) <= new Date()) {
    return NextResponse.json(
      { error: "This fixture has already started" },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("personal_predictions")
    .upsert(
      {
        user_id: user.id,
        external_event_id,
        event_name,
        sport,
        competition_name: competition_name ?? null,
        participants: participants ?? [],
        start_time,
        prediction_value,
        provider_league: provider_league ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,external_event_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prediction: data });
}
