import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchEvents } from "@/lib/sports/search-events";
import type { Sport } from "@/lib/sports/types";

const VALID_SPORTS: Sport[] = [
  "formula_1", "soccer", "golf", "rugby", "tennis",
  "gaa", "horse_racing", "snooker", "cricket", "athletics", "mlb", "nfl", "nba", "nhl",
];

/**
 * GET /api/sports/search
 *
 * Search external APIs for sporting events.
 *
 * Params:
 *   sport    — required, one of VALID_SPORTS
 *   q        — optional text query (team/competition name)
 *   date     — optional single date (YYYY-MM-DD), shorthand for dateFrom=date&dateTo=date
 *   dateFrom — optional start of date range (YYYY-MM-DD)
 *   dateTo   — optional end of date range (YYYY-MM-DD)
 *   league   — optional TheSportsDB league ID for bulk fixture fetch
 *   limit    — optional max results (default 25)
 *
 * At least one of: q, date, dateFrom, or league must be provided.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") as Sport | null;
  const query = searchParams.get("q") ?? "";
  const date = searchParams.get("date") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? date;
  const dateTo = searchParams.get("dateTo") ?? date;
  const league = searchParams.get("league") ?? undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!)
    : 25;

  if (!sport || !VALID_SPORTS.includes(sport)) {
    return NextResponse.json(
      { error: "Invalid or missing sport parameter" },
      { status: 400 }
    );
  }

  if (!query && !dateFrom && !league) {
    return NextResponse.json(
      { error: "At least one of q, date, dateFrom, or league is required" },
      { status: 400 }
    );
  }

  // If a league ID is provided, fetch fixtures for that league directly
  if (league) {
    const fixtures = await fetchLeagueFixtures(league, sport);
    return NextResponse.json({ events: fixtures });
  }

  // Use provider search with date range
  const events = await searchEvents(sport, query, {
    date: dateFrom,
    dateTo,
    limit,
  });

  return NextResponse.json({ events });
}

/**
 * Fetch all upcoming fixtures for a specific league via TheSportsDB.
 * Used for bulk gameweek selection (e.g., "show me all PL fixtures this weekend").
 */
async function fetchLeagueFixtures(leagueId: string, sport: Sport) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${leagueId}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PredictSport/1.0" },
      next: { revalidate: 300 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.events?.length) return [];

    return data.events.map((e: Record<string, string | null>) => ({
      external_event_id: e.idEvent,
      event_name: e.strEvent,
      sport,
      start_time: e.dateEvent
        ? `${e.dateEvent}T${e.strTime ?? "00:00:00"}Z`
        : new Date().toISOString(),
      competition_name: e.strLeague ?? "",
      participants: [e.strHomeTeam, e.strAwayTeam].filter(Boolean),
      round: e.intRound ?? null,
      provider: "thesportsdb",
    }));
  } catch {
    return [];
  }
}
