import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchEvents } from "@/lib/sports/search-events";
import type { Sport } from "@/lib/sports/types";

const VALID_SPORTS: Sport[] = [
  "formula_1", "soccer", "golf", "rugby", "tennis",
  "gaa", "horse_racing", "snooker", "mlb", "nfl", "nba", "nhl",
];

/**
 * GET /api/sports/search?sport=soccer&q=liverpool&date=2026-05-01&limit=10
 * Admin-only: search external APIs for sporting events to link.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") as Sport | null;
  const query = searchParams.get("q");
  const date = searchParams.get("date") ?? undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!)
    : undefined;

  if (!sport || !VALID_SPORTS.includes(sport)) {
    return NextResponse.json(
      { error: "Invalid or missing sport parameter" },
      { status: 400 }
    );
  }
  if (!query) {
    return NextResponse.json(
      { error: "Missing q parameter" },
      { status: 400 }
    );
  }

  const events = await searchEvents(sport, query, { date, limit });
  return NextResponse.json({ events });
}
