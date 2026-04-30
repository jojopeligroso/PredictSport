import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchResult } from "@/lib/sports/fetch-result";
import type { Sport } from "@/lib/sports/types";

const VALID_SPORTS: Sport[] = [
  "formula_1", "soccer", "golf", "rugby", "tennis",
  "gaa", "horse_racing", "snooker", "mlb", "nfl", "nba", "nhl",
];

interface FetchResultBody {
  sport: Sport;
  externalEventId: string;
  eventId?: string; // DB event ID to update
}

/**
 * POST /api/sports/fetch-result
 * Admin-only: trigger a result fetch from external APIs.
 * Optionally updates the event in the database with provisional result.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as FetchResultBody;
  const { sport, externalEventId, eventId } = body;

  if (!sport || !VALID_SPORTS.includes(sport)) {
    return NextResponse.json(
      { error: "Invalid or missing sport" },
      { status: 400 }
    );
  }
  if (!externalEventId) {
    return NextResponse.json(
      { error: "Missing externalEventId" },
      { status: 400 }
    );
  }

  const result = await fetchResult(sport, externalEventId);

  if (!result) {
    return NextResponse.json({
      result: null,
      manual: true,
      message: "No result from any provider — manual entry required",
    });
  }

  // If an event ID was provided, update it with the provisional result
  if (eventId) {
    const { error } = await supabase
      .from("events")
      .update({
        result_data: result,
        status: "resulted",
        // result_confirmed stays false — admin must confirm
      })
      .eq("id", eventId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update event", details: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ result, manual: false });
}
