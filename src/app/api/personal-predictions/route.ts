import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
