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
  // GAA — routed through Foireann API
  "gaa-football": "gaa",
  "gaa-hurling": "gaa",
  "gaa-camogie": "gaa",
  // US Sports
  "4387": "nba",    // NBA
  "4424": "mlb",    // MLB
  "4380": "nhl",    // NHL
  "4391": "nfl",    // NFL
  // Motorsport
  "4370": "formula_1", // Formula 1
  "4407": "formula_1", // MotoGP
  // Snooker
  "4555": "snooker", // World Snooker
  // Cricket — International
  "4844": "cricket", // Test Match Series
  "4801": "cricket", // ODI Series
  "4979": "cricket", // T20I Series
  "4575": "cricket", // Cricket World Cup
  "5587": "cricket", // ICC Champions Trophy
  "5103": "cricket", // ICC Men's T20 World Cup
  "5100": "cricket", // ICC World Test Championship
  // Cricket — T20 Leagues
  "4460": "cricket", // IPL
  "4461": "cricket", // Big Bash League
  "4463": "cricket", // English T20 Blast
  "5177": "cricket", // The Hundred
  "5176": "cricket", // Caribbean Premier League
  "5067": "cricket", // Pakistan Super League
  "5532": "cricket", // SA20
  // Cricket — Domestic
  "4458": "cricket", // County Championship Div 1
  "4459": "cricket", // County Championship Div 2
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

// ---------- ESPN routing ----------
// Maps our league IDs to ESPN scoreboard paths for sports where ESPN
// returns better fixture data than TheSportsDB.

const ESPN_LEAGUE_MAP: Record<string, string> = {
  // Soccer — England (espn slug → confirmed working)
  "4328": "soccer/eng.1",          // Premier League
  "4329": "soccer/eng.2",          // Championship
  "4350": "soccer/eng.league_cup", // Carabao Cup
  // Soccer — Europe
  "4480": "soccer/uefa.champions", // Champions League
  "4481": "soccer/uefa.europa",    // Europa League
  "4335": "soccer/esp.1",          // La Liga
  "4331": "soccer/ger.1",          // Bundesliga
  "4332": "soccer/ita.1",          // Serie A
  "4334": "soccer/fra.1",          // Ligue 1
  "4337": "soccer/ned.1",          // Eredivisie
  "4338": "soccer/bel.1",          // Pro League (Belgium)
  "4336": "soccer/gre.1",          // Super League (Greece)
  // Soccer — Ireland / Scotland
  "4643": "soccer/irl.1",          // League of Ireland Premier
  "4330": "soccer/sco.1",          // Scottish Premiership
  // Soccer — International
  "4429": "soccer/fifa.world",             // FIFA World Cup
  "4501": "soccer/conmebol.libertadores",  // Copa Libertadores
  // Rugby union — ESPN numeric league IDs (confirmed via live API tests)
  // NRL (4416) and Super League (4415) are rugby league — NOT on ESPN
  // ERCC (4550) ID not found on ESPN — falls through to TheSportsDB
  "4446": "rugby/270557",  // United Rugby Championship
  // Tennis
  "4464": "tennis/atp",   // ATP Tour
  "4517": "tennis/wta",   // WTA Tour
  // Golf
  "4758": "golf/eur",     // DP World Tour (European Tour)
  // US Sports — ESPN is authoritative
  "4387": "basketball/nba",
  "4424": "baseball/mlb",
  "4380": "hockey/nhl",
  "4391": "football/nfl",
  // Motorsport
  "4370": "racing/f1",        // Formula 1 (confirmed working)
  // MotoGP (4407) — ESPN racing/motogp returns 404; falls through to TheSportsDB.
};

// ---------- ESPN cricket routing ----------
// Cricket requires a different fetch strategy: the date-range format (YYYYMMDD-YYYYMMDD)
// returns 404. Instead we fetch the calendar first, then query each upcoming match date
// individually. Maps TheSportsDB league IDs → ESPN cricket numeric league IDs.
const ESPN_CRICKET_MAP: Record<string, string> = {
  "4460": "8048",  // IPL
  "4461": "8044",  // Big Bash League
  "4463": "8053",  // T20 Blast (England)
  "5532": "8041",  // SA20 → SuperSport Series (closest match; update if better ID found)
  // The Hundred (5177), CPL (5176), PSL (5067) — ESPN IDs not yet confirmed; fall through to TheSportsDB
};

// ---------- Human-readable display names ----------
// Fallback league names used when ESPN's API response doesn't include leagues[0].name.
// Ensures competition_name is always a friendly string — never a raw API path or numeric ID.

const ESPN_PATH_DISPLAY: Record<string, string> = {
  "soccer/eng.1":                   "Premier League",
  "soccer/eng.2":                   "Championship",
  "soccer/eng.league_cup":          "League Cup",
  "soccer/uefa.champions":          "Champions League",
  "soccer/uefa.europa":             "Europa League",
  "soccer/esp.1":                   "La Liga",
  "soccer/ger.1":                   "Bundesliga",
  "soccer/ita.1":                   "Serie A",
  "soccer/fra.1":                   "Ligue 1",
  "soccer/ned.1":                   "Eredivisie",
  "soccer/bel.1":                   "Pro League",
  "soccer/gre.1":                   "Super League",
  "soccer/irl.1":                   "League of Ireland",
  "soccer/sco.1":                   "Scottish Premiership",
  "soccer/fifa.world":              "FIFA World Cup",
  "soccer/conmebol.libertadores":   "Copa Libertadores",
  "rugby/270557":                   "United Rugby Championship",
  "tennis/atp":                     "ATP Tour",
  "tennis/wta":                     "WTA Tour",
  "golf/eur":                       "DP World Tour",
  "basketball/nba":                 "NBA",
  "baseball/mlb":                   "MLB",
  "hockey/nhl":                     "NHL",
  "football/nfl":                   "NFL",
  "racing/f1":                      "Formula 1",
};

const ESPN_CRICKET_DISPLAY: Record<string, string> = {
  "8048": "IPL",
  "8044": "Big Bash League",
  "8053": "T20 Blast",
  "8041": "SA20",
};

// ---------- Foireann routing ----------
// Maps GAA league IDs to Foireann API activity filters.

const FOIREANN_LEAGUE_MAP: Record<string, { activity?: string }> = {
  "gaa-football": { activity: "football" },
  "gaa-hurling": { activity: "hurling" },
  "gaa-camogie": { activity: "camogie" },
};

// ---------- Shared types ----------

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

// ---------- ESPN fixture fetching ----------

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_FETCH_OPTS = {
  headers: { "User-Agent": "PredictSport/1.0" },
  next: { revalidate: 300 } as NextFetchRequestConfig,
};

interface ESPNCompetitor {
  team?: { displayName: string };
  athlete?: { displayName: string };
  homeAway?: string;
}

interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  shortName?: string;
  status: { type: { completed: boolean; description: string } };
  competitions: Array<{
    competitors: ESPNCompetitor[];
    venue?: { fullName: string };
  }>;
  season?: { year: number };
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[];
  leagues?: Array<{ name: string; season?: { year: number } }>;
}

async function fetchESPNFixtures(
  espnPath: string,
  sport: Sport,
): Promise<NormalizedFixture[]> {
  // ESPN scoreboard defaults to the current day only — pass a 30-day window
  // so upcoming fixtures always appear regardless of today's schedule.
  const today = new Date();
  const end = new Date(today.getTime() + 30 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const dates = `${fmt(today)}-${fmt(end)}`;
  const url = `${ESPN_BASE}/${espnPath}/scoreboard?dates=${dates}`;

  try {
    const res = await fetch(url, ESPN_FETCH_OPTS);
    if (!res.ok) {
      console.error(`[fixtures] ESPN ${espnPath} → HTTP ${res.status} ${res.statusText} (url: ${url})`);
      return [];
    }

    const data: ESPNScoreboardResponse = await res.json();
    const total = data?.events?.length ?? 0;
    const upcoming = data?.events?.filter((e) => !e.status.type.completed) ?? [];
    console.log(`[fixtures] ESPN ${espnPath}: ${upcoming.length} upcoming / ${total} total events`);

    if (!total) return [];

    const leagueName = data.leagues?.[0]?.name ?? ESPN_PATH_DISPLAY[espnPath] ?? espnPath;
    const season = data.leagues?.[0]?.season?.year?.toString() ?? null;

    return upcoming.map((e) => {
      const competitors = e.competitions[0]?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      const homeName = home?.team?.displayName ?? home?.athlete?.displayName ?? "";
      const awayName = away?.team?.displayName ?? away?.athlete?.displayName ?? "";
      const participants = [homeName, awayName].filter(Boolean);

      return {
        external_event_id: e.id,
        event_name: e.name,
        sport,
        competition_name: leagueName,
        start_time: e.date,
        participants,
        round: null,
        season,
      };
    });
  } catch (err) {
    console.error(`[fixtures] ESPN fetch threw for ${url}:`, err);
    return [];
  }
}

// ---------- ESPN cricket fixture fetching ----------

/**
 * Cricket scoreboards 404 with a date-range parameter (YYYYMMDD-YYYYMMDD).
 * ESPN has no forward-looking calendar endpoint for cricket, so we probe each
 * day in the next 14-day window individually in parallel.
 * All requests carry Next.js revalidate:300 cache, so cold load costs ≤14 ESPN
 * calls; subsequent loads within 5 minutes cost 0.
 */
async function fetchESPNCricketFixtures(
  espnLeagueId: string,
  sport: Sport,
): Promise<NormalizedFixture[]> {
  const base = `${ESPN_BASE}/cricket/${espnLeagueId}/scoreboard`;

  // Build list of dates to probe: today through today+14 days
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i <= 14; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ""));
  }

  // Fetch all dates in parallel
  const results = await Promise.allSettled(
    dates.map(async (fmt) => {
      const res = await fetch(`${base}?dates=${fmt}`, ESPN_FETCH_OPTS);
      if (!res.ok) return [] as ESPNEvent[];
      const data: ESPNScoreboardResponse = await res.json();
      // Capture league metadata from first successful response
      return { events: data.events ?? [], leagues: data.leagues };
    }),
  );

  // Extract league name + season from first result that has leagues data
  let leagueName = ESPN_CRICKET_DISPLAY[espnLeagueId] ?? `Cricket ${espnLeagueId}`;
  let season: string | null = null;
  for (const r of results) {
    if (r.status === "fulfilled" && !Array.isArray(r.value) && r.value.leagues?.[0]) {
      leagueName = r.value.leagues[0].name ?? leagueName;
      season = r.value.leagues[0].season?.year?.toString() ?? null;
      break;
    }
  }

  // Merge + deduplicate events
  const seen = new Set<string>();
  const allEvents: ESPNEvent[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const events = Array.isArray(r.value) ? r.value : r.value.events;
    for (const e of events) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        allEvents.push(e);
      }
    }
  }

  const upcoming = allEvents.filter((e) => !e.status.type.completed);
  console.log(`[fixtures] ESPN cricket ${espnLeagueId} (${leagueName}): ${upcoming.length} upcoming / ${allEvents.length} total across 14-day window`);

  return upcoming.map((e) => {
    const competitors = e.competitions[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeName = home?.team?.displayName ?? home?.athlete?.displayName ?? "";
    const awayName = away?.team?.displayName ?? away?.athlete?.displayName ?? "";

    return {
      external_event_id: e.id,
      event_name: e.name,
      sport,
      competition_name: leagueName,
      start_time: e.date,
      participants: [homeName, awayName].filter(Boolean),
      round: null,
      season,
    };
  });
}

// ---------- Foireann fixture fetching ----------

interface FoireannFixtureItem {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  startDate: string;
  isResult: boolean;
  round: string | null;
  competition: { name: string; season: string };
  division: { name: string } | null;
  postponed: boolean;
  abandoned: boolean;
}

async function fetchFoireannFixtures(
  config: { activity?: string },
): Promise<NormalizedFixture[]> {
  const apiKey = process.env.FOIREANN_API_KEY;
  if (!apiKey) {
    console.error("[fixtures] FOIREANN_API_KEY not set — GAA fixtures unavailable");
    return [];
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const endStr = endDate.toISOString().split("T")[0];

    const params = new URLSearchParams({
      page: "0",
      size: "50",
      sort: "startDate,asc",
      "competition.type": "inter_county",
      startDateFrom: today,
      startDateTo: endStr,
    });
    if (config.activity) params.set("activity", config.activity);

    const res = await fetch(
      `https://api.foireann.ie/open-data/v1/fixtures?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "PredictSport/1.0",
        },
        next: { revalidate: 300 } as NextFetchRequestConfig,
      },
    );
    if (!res.ok) {
      console.error(`[fixtures] Foireann → HTTP ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const fixtures: FoireannFixtureItem[] = data?.content ?? [];
    console.log(`[fixtures] Foireann (${config.activity ?? "all"}): ${fixtures.length} fixtures`);

    return fixtures
      .filter((f) => !f.isResult && !f.postponed && !f.abandoned)
      .map((f) => ({
        external_event_id: f.id,
        event_name: `${f.homeTeam.name} v ${f.awayTeam.name}`,
        sport: "gaa" as Sport,
        competition_name: f.division
          ? `${f.competition.name} - ${f.division.name}`
          : f.competition.name,
        start_time: f.startDate,
        participants: [f.homeTeam.name, f.awayTeam.name],
        round: f.round ?? null,
        season: f.competition.season ?? null,
      }));
  } catch (err) {
    console.error("[fixtures] Foireann fetch threw:", err);
    return [];
  }
}

// ---------- TheSportsDB fixture fetching (existing logic) ----------

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

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const TSDB_FETCH_OPTS = {
  headers: { "User-Agent": "PredictSport/1.0" },
  next: { revalidate: 300 } as NextFetchRequestConfig,
};

function normalizeTSDBFixture(e: TSDBFixture, sport: Sport): NormalizedFixture {
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

/**
 * Fetch fixtures from TheSportsDB using the round-expansion strategy:
 * 1. Call eventsnextleague to get the current round number and season
 * 2. Call eventsround for current + next 2 rounds in parallel
 * 3. Merge, deduplicate, filter to future events only
 */
async function fetchTSDBFixtures(
  leagueId: string,
  sport: Sport,
): Promise<NormalizedFixture[]> {
  const nextRes = await fetch(
    `${TSDB_BASE}/eventsnextleague.php?id=${leagueId}`,
    TSDB_FETCH_OPTS,
  );
  if (!nextRes.ok) {
    console.error(`[fixtures] TheSportsDB eventsnextleague ${leagueId} → HTTP ${nextRes.status}`);
    return [];
  }

  const nextData: TSDBFixturesResponse = await nextRes.json();
  if (!nextData.events?.length) {
    console.log(`[fixtures] TheSportsDB league ${leagueId}: 0 upcoming events`);
    return [];
  }

  const firstEvent = nextData.events[0];
  const currentRound = parseInt(firstEvent.intRound ?? "0", 10);
  const season = firstEvent.strSeason ?? "";

  // Cup competitions without round numbers — return eventsnextleague as-is
  if (!currentRound || !season) {
    return nextData.events.map((e) => normalizeTSDBFixture(e, sport));
  }

  // Fetch current round + next 2 rounds in parallel
  const roundNumbers = [currentRound, currentRound + 1, currentRound + 2];
  const roundResults = await Promise.allSettled(
    roundNumbers.map(async (r) => {
      const res = await fetch(
        `${TSDB_BASE}/eventsround.php?id=${leagueId}&r=${r}&s=${season}`,
        TSDB_FETCH_OPTS,
      );
      if (!res.ok) return [];
      const data: TSDBFixturesResponse = await res.json();
      return data.events ?? [];
    }),
  );

  // Merge, deduplicate
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

  // Include eventsnextleague results too
  for (const event of nextData.events) {
    if (!seen.has(event.idEvent)) {
      seen.add(event.idEvent);
      allEvents.push(event);
    }
  }

  // Filter to today and future only
  const today = new Date().toISOString().slice(0, 10);
  const futureEvents = allEvents.filter((e) => (e.dateEvent ?? "") >= today);

  return futureEvents.map((e) => normalizeTSDBFixture(e, sport));
}

// ---------- Route handler ----------

/**
 * GET /api/sports/fixtures?league={leagueId}
 *
 * Per-sport routing:
 * - ESPN leagues (cricket T20s, US sports): ESPN scoreboard API
 * - GAA leagues: Foireann API
 * - Everything else: TheSportsDB (round-expansion strategy)
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
      { status: 400 },
    );
  }

  const sport = LEAGUE_SPORT_MAP[leagueId] ?? "soccer";

  try {
    let fixtures: NormalizedFixture[];

    if (FOIREANN_LEAGUE_MAP[leagueId]) {
      // GAA → Foireann API
      console.log(`[fixtures] route: league=${leagueId} → Foireann`);
      fixtures = await fetchFoireannFixtures(FOIREANN_LEAGUE_MAP[leagueId]);
    } else if (ESPN_CRICKET_MAP[leagueId]) {
      // Cricket → ESPN calendar whitelist strategy (date-range format 404s for cricket)
      console.log(`[fixtures] route: league=${leagueId} → ESPN cricket (${ESPN_CRICKET_MAP[leagueId]})`);
      fixtures = await fetchESPNCricketFixtures(ESPN_CRICKET_MAP[leagueId], sport);
      if (fixtures.length === 0) {
        console.log(`[fixtures] route: ESPN cricket returned 0 for league=${leagueId}, falling back to TheSportsDB`);
        fixtures = await fetchTSDBFixtures(leagueId, sport);
      }
    } else if (ESPN_LEAGUE_MAP[leagueId]) {
      // ESPN-routed leagues
      console.log(`[fixtures] route: league=${leagueId} → ESPN (${ESPN_LEAGUE_MAP[leagueId]})`);
      fixtures = await fetchESPNFixtures(ESPN_LEAGUE_MAP[leagueId], sport);
      // If ESPN returns nothing, fall back to TheSportsDB
      if (fixtures.length === 0) {
        console.log(`[fixtures] route: ESPN returned 0 for league=${leagueId}, falling back to TheSportsDB`);
        fixtures = await fetchTSDBFixtures(leagueId, sport);
      }
    } else {
      // Default: TheSportsDB
      console.log(`[fixtures] route: league=${leagueId} → TheSportsDB (no ESPN mapping)`);
      fixtures = await fetchTSDBFixtures(leagueId, sport);
    }

    // Sort by start_time ascending
    fixtures.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );

    console.log(`[fixtures] route: league=${leagueId} returning ${fixtures.length} fixtures`);
    return NextResponse.json({ fixtures });
  } catch (err) {
    console.error(`[fixtures] route: unhandled error for league=${leagueId}:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
