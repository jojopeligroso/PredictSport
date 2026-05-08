import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Sport } from "@/lib/sports/types";

const LEAGUE_SPORT_MAP: Record<string, Sport> = {
  // Soccer — England
  "4328": "soccer", // Premier League
  "4329": "soccer", // Championship
  "4350": "soccer", // League Cup
  // Soccer — Europe
  "4480": "soccer", // Champions League
  "4481": "soccer", // Europa League
  "4335": "soccer", // La Liga
  "4331": "soccer", // Bundesliga
  "4332": "soccer", // Serie A
  "4334": "soccer", // Ligue 1
  "4337": "soccer", // Eredivisie
  "4338": "soccer", // Pro League (Belgium)
  "4336": "soccer", // Super League (Greece)
  // Soccer — Ireland
  "4643": "soccer", // League of Ireland Premier
  "4757": "soccer", // League of Ireland First Division
  // Soccer — Scotland
  "4330": "soccer", // Scottish Premiership
  // Soccer — International
  "4429": "soccer", // FIFA World Cup
  "4501": "soccer", // Copa Libertadores
  // GAA — Football
  "5564": "gaa",    // All-Ireland Senior Football Championship
  "5566": "gaa",    // Connacht Senior Football Championship
  "5567": "gaa",    // Leinster Senior Football Championship
  "5568": "gaa",    // Munster Senior Football Championship
  "5569": "gaa",    // Ulster Senior Football Championship
  "5576": "gaa",    // Tailteann Cup
  // GAA — Hurling
  "5565": "gaa",    // All-Ireland Senior Hurling Championship
  "5570": "gaa",    // Munster Senior Hurling Championship
  "5571": "gaa",    // Leinster Senior Hurling Championship
  "5572": "gaa",    // Joe McDonagh Cup
  "5573": "gaa",    // Christy Ring Cup
  // US Sports
  "4387": "nba",    // NBA
  "4424": "mlb",    // MLB
  "4380": "nhl",    // NHL
  "4391": "nfl",    // NFL
  // Motorsport
  "4370": "formula_1", // Formula 1
  "4407": "formula_1", // MotoGP
  // Combat Sports
  "4443": "soccer", // UFC
  // Snooker
  "4555": "soccer", // World Snooker
  // Darts
  "4554": "soccer", // PDC Darts
  // Cycling
  "4465": "soccer", // UCI World Tour
  // Cricket — International
  "4844": "soccer", // Test Match Series
  "4801": "soccer", // ODI Series
  "4979": "soccer", // T20I Series
  "4575": "soccer", // Cricket World Cup
  "5587": "soccer", // ICC Champions Trophy
  "5103": "soccer", // ICC Men's T20 World Cup
  "5100": "soccer", // ICC World Test Championship
  // Cricket — T20 Leagues
  "4460": "soccer", // IPL
  "4461": "soccer", // Big Bash League
  "4463": "soccer", // English T20 Blast
  "5177": "soccer", // The Hundred
  "5176": "soccer", // Caribbean Premier League
  "5067": "soccer", // Pakistan Super League
  "5532": "soccer", // SA20
  "5175": "soccer", // Lanka Premier League
  "5174": "soccer", // NZ Super Smash
  "5490": "soccer", // International League T20
  "5401": "soccer", // Major League Cricket
  // Cricket — Domestic
  "4458": "soccer", // County Championship Div 1
  "4459": "soccer", // County Championship Div 2
  "5530": "soccer", // Sheffield Shield
  "5606": "soccer", // Cricket Ireland Inter-Provincial T20
  // Rugby
  "4415": "rugby",  // Super League
  "4416": "rugby",  // NRL
  "4446": "rugby",  // United Rugby Championship
  "4550": "rugby",  // European Rugby Champions Cup
  // Tennis
  "4464": "tennis", // ATP Tour
  "4517": "tennis", // WTA Tour
  // Golf
  "4758": "golf",   // European Tour
};

const VALID_LEAGUE_IDS = new Set(Object.keys(LEAGUE_SPORT_MAP));

interface TSDBFixture {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  dateEvent: string;
  strTime: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  strStatus: string | null;
  intRound: string | null;
  strSeason: string | null;
}

interface TSDBFixturesResponse {
  events: TSDBFixture[] | null;
}

export interface NormalizedFixture {
  external_event_id: string;
  event_name: string;
  sport: Sport;
  competition_name: string;
  start_time: string;
  participants: string[];
  round: string | null;
  season: string | null;
}

function normalizeFixture(e: TSDBFixture, sport: Sport): NormalizedFixture {
  const timeStr = e.strTime ?? "00:00:00";
  const startTime = e.dateEvent
    ? `${e.dateEvent}T${timeStr}Z`
    : new Date().toISOString();

  return {
    external_event_id: e.idEvent,
    event_name: e.strEvent,
    sport,
    competition_name: e.strLeague,
    start_time: startTime,
    participants: [e.strHomeTeam, e.strAwayTeam].filter(Boolean),
    round: e.intRound ?? null,
    season: e.strSeason ?? null,
  };
}

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const FETCH_OPTS = {
  headers: { "User-Agent": "PredictSport/1.0" },
  next: { revalidate: 300 } as NextFetchRequestConfig,
};

/**
 * GET /api/sports/fixtures?league={leagueId}
 *
 * Strategy:
 * 1. Call eventsnextleague to get the current round number and season
 * 2. Call eventsround for the current round AND the next 2 rounds in parallel
 * 3. Merge, deduplicate, filter to future events only, sort by date
 *
 * This returns 10-30+ fixtures instead of the 1 that eventsnextleague gives
 * on the free tier.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get("league");

  if (!leagueId || !VALID_LEAGUE_IDS.has(leagueId)) {
    return NextResponse.json(
      { error: "Invalid or missing league parameter" },
      { status: 400 }
    );
  }

  const sport = LEAGUE_SPORT_MAP[leagueId] ?? "soccer";

  try {
    // Step 1: Get current round + season from eventsnextleague
    const nextRes = await fetch(
      `${TSDB_BASE}/eventsnextleague.php?id=${leagueId}`,
      FETCH_OPTS
    );

    if (!nextRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch fixtures from TheSportsDB" },
        { status: 502 }
      );
    }

    const nextData: TSDBFixturesResponse = await nextRes.json();

    // If no upcoming events at all, return empty
    if (!nextData.events?.length) {
      return NextResponse.json({ fixtures: [] });
    }

    const firstEvent = nextData.events[0];
    const currentRound = parseInt(firstEvent.intRound ?? "0", 10);
    const season = firstEvent.strSeason ?? "";

    // If we can't determine the round (e.g. cup competitions), fall back to
    // just the eventsnextleague result
    if (!currentRound || !season) {
      const fixtures = nextData.events.map((e) => normalizeFixture(e, sport));
      return NextResponse.json({ fixtures });
    }

    // Step 2: Fetch current round + next 2 rounds in parallel
    const roundNumbers = [currentRound, currentRound + 1, currentRound + 2];

    const roundResults = await Promise.allSettled(
      roundNumbers.map(async (r) => {
        const res = await fetch(
          `${TSDB_BASE}/eventsround.php?id=${leagueId}&r=${r}&s=${season}`,
          FETCH_OPTS
        );
        if (!res.ok) return [];
        const data: TSDBFixturesResponse = await res.json();
        return data.events ?? [];
      })
    );

    // Step 3: Merge all events, deduplicate by event ID
    const seen = new Set<string>();
    const allEvents: TSDBFixture[] = [];

    for (const result of roundResults) {
      if (result.status !== "fulfilled") continue;
      for (const event of result.value) {
        if (!seen.has(event.idEvent)) {
          seen.add(event.idEvent);
          allEvents.push(event);
        }
      }
    }

    // Also include anything from eventsnextleague that might not be in a round
    for (const event of nextData.events) {
      if (!seen.has(event.idEvent)) {
        seen.add(event.idEvent);
        allEvents.push(event);
      }
    }

    // Filter to today and future only
    const today = new Date().toISOString().slice(0, 10);
    const futureEvents = allEvents.filter((e) => (e.dateEvent ?? "") >= today);

    const fixtures = futureEvents.map((e) => normalizeFixture(e, sport));

    // Sort by start_time ascending
    fixtures.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    return NextResponse.json({ fixtures });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
