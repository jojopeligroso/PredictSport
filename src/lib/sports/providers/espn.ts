import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";

interface ESPNCompetitor {
  team?: { displayName: string };
  athlete?: { displayName: string };
  score: string;
  homeAway?: "home" | "away";
  winner?: boolean;
  order?: number;
}

interface ESPNStatusType {
  completed?: boolean;
  description: string;
  state?: string; // "pre" | "in" | "post" — present on summary endpoint
  detail?: string;
}

interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  shortName?: string;
  status: { type: ESPNStatusType };
  competitions: Array<{
    competitors: ESPNCompetitor[];
  }>;
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[];
}

interface ESPNSummaryCompetition {
  id: string;
  date?: string;
  status: { type: ESPNStatusType };
  competitors: ESPNCompetitor[];
}

interface ESPNSummaryResponse {
  header?: {
    id?: string;
    name?: string;
    competitions?: ESPNSummaryCompetition[];
  };
}

/** Sports where ESPN uses individual competitors / leaderboard format */
const POSITION_SPORTS: Sport[] = ["golf", "tennis"];

/**
 * Sports where ESPN's scoreboard endpoint rejects date-range params (YYYYMMDD-YYYYMMDD)
 * and returns 404. These sports must use single-date or no-date queries instead.
 * Confirmed broken: cricket. All others (NFL, NBA, soccer etc.) accept ranges fine.
 */
const DATE_RANGE_BROKEN_SPORTS: Sport[] = ["cricket"];

/** Maps our Sport to ESPN's URL path segment(s). First entry is the default league. */
const SPORT_PATHS: Partial<Record<Sport, string>> = {
  american_football: "football/nfl",
  ice_hockey: "hockey/nhl",
  basketball: "basketball/nba",
  baseball: "baseball/mlb",
  soccer: "soccer/eng.1",
  rugby: "rugby/270557", // URC (Rugby Union); Six Nations=180659, World Cup=164205
  rugby_league: "rugby-league/3", // NRL / Super League
  golf: "golf/pga",
  tennis: "tennis/atp",
  cricket: "cricket/8048", // IPL default; others via league param
  snooker: "general/snooker", // limited coverage
};

/** Human-readable display names for ESPN league paths — used as competition_name fallback */
const SPORT_PATH_DISPLAY: Partial<Record<string, string>> = {
  "football/nfl":      "NFL",
  "hockey/nhl":        "NHL",
  "basketball/nba":    "NBA",
  "baseball/mlb":      "MLB",
  "soccer/eng.1":      "Premier League",
  "rugby/270557":      "United Rugby Championship",
  "rugby-league/3":    "Super League / NRL",
  "golf/pga":          "PGA Tour",
  "tennis/atp":        "ATP Tour",
  "cricket/8048":      "IPL",
  "general/snooker":   "World Snooker",
};

/**
 * ESPN unofficial API — undocumented, no API key.
 * Broad coverage: NFL, NHL, NBA, MLB, soccer, rugby, golf, tennis.
 * site.api.espn.com — may break without notice.
 */
export class ESPNProvider extends BaseProvider {
  readonly name = "espn";
  readonly supportedSports = [
    "american_football",
    "ice_hockey",
    "basketball",
    "baseball",
    "soccer",
    "rugby",
    "rugby_league",
    "golf",
    "tennis",
    "cricket",
    "snooker",
  ] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig = {
    baseUrl: "https://site.api.espn.com/apis/site/v2/sports/",
    rateLimit: { requests: 30, windowMs: 60_000 },
  };

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  async getResult(
    sport: Sport,
    externalEventId: string,
    providerLeague?: string
  ): Promise<NormalizedResult | null> {
    // providerLeague (e.g. "cricket/8044") takes precedence over the
    // per-sport default so events from non-default leagues are routed correctly.
    const sportPath = providerLeague ?? SPORT_PATHS[sport];
    if (!sportPath) return null;

    // Use the summary endpoint — fetches a specific event by ID.
    // The scoreboard endpoint does not support event-ID filtering and returns
    // the full day's games; taking events[0] would yield the wrong result.
    const data = await this.apiFetch<ESPNSummaryResponse>(
      `${sportPath}/summary`,
      { event: externalEventId }
    );

    const competition = data?.header?.competitions?.[0];
    if (!competition) return null;

    // Construct a minimal ESPNEvent-compatible shape to reuse normalizeEvent()
    const event: ESPNEvent = {
      id: externalEventId,
      name: data.header?.name ?? externalEventId,
      date: competition.date ?? new Date().toISOString(),
      status: competition.status,
      competitions: [{ competitors: competition.competitors ?? [] }],
    };

    return this.normalizeEvent(sport, event);
  }

  async searchEvents(
    sport: Sport,
    query: string,
    options?: { date?: string; limit?: number; providerLeague?: string }
  ): Promise<SearchableEvent[]> {
    const sportPath = options?.providerLeague ?? SPORT_PATHS[sport];
    if (!sportPath) return [];

    const params: Record<string, string> = {};
    const rangeOk = !DATE_RANGE_BROKEN_SPORTS.includes(sport);

    let events: ESPNEvent[];

    if (!rangeOk) {
      // Cricket: date ranges return 404. Strategy: three parallel calls —
      //   1. No date param → ESPN returns the next ~3-5 upcoming (state=pre) fixtures
      //   2. Today's date → today's fixtures (catches state=in matches that started today)
      //   3. The requested date (if different from today) → user-specified day
      // This handles multi-day Tests: a match that started 3 days ago will be
      // state=in and won't appear in call 1 (upcoming only). Call 2 returns it
      // because ESPN scoreboard with today's date includes in-progress events.
      const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
      const todayStr = fmt(new Date());

      const noDateFetch = this.apiFetch<ESPNScoreboardResponse>(
        `${sportPath}/scoreboard`,
        {}
      );
      const todayFetch = this.apiFetch<ESPNScoreboardResponse>(
        `${sportPath}/scoreboard`,
        { dates: todayStr }
      );
      const specificDateFetch =
        options?.date && options.date.replace(/-/g, "") !== todayStr
          ? this.apiFetch<ESPNScoreboardResponse>(
              `${sportPath}/scoreboard`,
              { dates: options.date.replace(/-/g, "") }
            )
          : Promise.resolve(null);

      const [noDateData, todayData, specificData] = await Promise.all([
        noDateFetch,
        todayFetch,
        specificDateFetch,
      ]);
      const seen = new Set<string>();
      events = [];
      for (const e of [
        ...(noDateData?.events ?? []),
        ...(todayData?.events ?? []),
        ...(specificData?.events ?? []),
      ]) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          events.push(e);
        }
      }
    } else {
      if (options?.date) {
        // ESPN scoreboard is single-day by default — extend to a 14-day window.
        // Start 1 day BEFORE the requested date because ESPN indexes events by
        // local venue date, not UTC. A match at 01:00 UTC Jun 13 (6pm Pacific
        // Jun 12) is indexed under Jun 12 — a range starting Jun 13 misses it.
        const dateMs = new Date(options.date).getTime();
        const rangeStart = new Date(dateMs - 86_400_000);
        const start = rangeStart.toISOString().slice(0, 10).replace(/-/g, "");
        const rangeEnd = new Date(dateMs + 14 * 86_400_000);
        const end = rangeEnd.toISOString().slice(0, 10).replace(/-/g, "");
        params.dates = `${start}-${end}`;
      } else {
        // Default: today → +14 days so fixture browser finds upcoming events on off-days
        const today = new Date();
        const end = new Date(today.getTime() + 14 * 86_400_000);
        const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
        params.dates = `${fmt(today)}-${fmt(end)}`;
      }
      const data = await this.apiFetch<ESPNScoreboardResponse>(
        `${sportPath}/scoreboard`,
        params
      );
      events = data?.events ?? [];
    }

    if (!events.length) return [];

    // Match query against event name OR team/athlete names.
    // If query is a competition name (e.g. "URC") that won't appear in event names,
    // fall back to returning all events — sport/league path is already the filter.
    const queryLower = query.toLowerCase().trim();
    const nameMatches = queryLower
      ? events.filter((e) => {
          const name = e.name.toLowerCase();
          const teams = (e.competitions[0]?.competitors ?? [])
            .map((c) => (c.team?.displayName ?? c.athlete?.displayName ?? "").toLowerCase())
            .join(" ");
          return name.includes(queryLower) || teams.includes(queryLower);
        })
      : events;
    const filtered = nameMatches.length > 0 ? nameMatches : events;

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((e) => {
      const competitors =
        e.competitions[0]?.competitors.map(
          (c) => c.athlete?.displayName ?? c.team?.displayName ?? "Unknown"
        ) ?? [];
      return {
        external_event_id: e.id,
        event_name: e.name,
        sport,
        start_time: e.date,
        competition_name: SPORT_PATH_DISPLAY[sportPath] ?? sport,
        participants: competitors,
        provider: this.name,
      };
    });
  }

  private normalizeEvent(sport: Sport, event: ESPNEvent): NormalizedResult {
    const competitors = event.competitions[0]?.competitors ?? [];

    // Position-based sports (golf, tennis) — use leaderboard/positions
    if (POSITION_SPORTS.includes(sport)) {
      return this.normalizePositionEvent(sport, event, competitors);
    }

    // Team-based sports — use home/away scores
    return this.normalizeTeamEvent(sport, event, competitors);
  }

  private normalizeTeamEvent(
    sport: Sport,
    event: ESPNEvent,
    competitors: ESPNCompetitor[]
  ): NormalizedResult {
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");

    const homeScore = home ? parseInt(home.score) || 0 : 0;
    const awayScore = away ? parseInt(away.score) || 0 : 0;
    const homeName = home?.team?.displayName ?? home?.athlete?.displayName ?? "Home";
    const awayName = away?.team?.displayName ?? away?.athlete?.displayName ?? "Away";

    let winner: string | null = null;
    if (home?.winner) winner = homeName;
    else if (away?.winner) winner = awayName;

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport,
      external_event_id: event.id,
      event_name: event.name,
      is_final: event.status.type.completed === true || event.status.type.state === "post",
      positions: null,
      score: {
        home_team: homeName,
        away_team: awayName,
        home_score: homeScore,
        away_score: awayScore,
        periods: null,
      },
      winner,
      margin: Math.abs(homeScore - awayScore),
      stats: { total_points: homeScore + awayScore },
      raw: event,
    };
  }

  private normalizePositionEvent(
    sport: Sport,
    event: ESPNEvent,
    competitors: ESPNCompetitor[]
  ): NormalizedResult {
    const sorted = [...competitors].sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999)
    );

    const positions = sorted.map((c, i) => ({
      position: c.order ?? i + 1,
      name: c.athlete?.displayName ?? c.team?.displayName ?? "Unknown",
      team: null,
    }));

    const winnerEntry = sorted.find((c) => c.winner);
    const winner =
      winnerEntry?.athlete?.displayName ??
      winnerEntry?.team?.displayName ??
      positions[0]?.name ??
      null;

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport,
      external_event_id: event.id,
      event_name: event.name,
      is_final: event.status.type.completed === true || event.status.type.state === "post",
      positions,
      score: null,
      winner,
      margin: null,
      stats: null,
      raw: event,
    };
  }
}
