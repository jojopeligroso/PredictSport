import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { fetchResult } from "@/lib/sports/fetch-result";
import type { Sport } from "@/lib/sports/types";

const VALID_SPORTS: Sport[] = [
  "formula_1", "soccer", "golf", "rugby", "rugby_league", "tennis",
  "gaa", "horse_racing", "snooker", "cricket", "athletics", "baseball", "american_football", "basketball", "ice_hockey",
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

  // H4: If writing to DB, verify caller is competition admin
  if (eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("competition_id")
      .eq("id", eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const admin = await verifyCompetitionAdmin(supabase, user.id, event.competition_id);
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required to update event results" },
        { status: 403 }
      );
    }
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
