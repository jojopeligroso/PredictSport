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

interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  shortName?: string;
  status: { type: { completed: boolean; description: string } };
  competitions: Array<{
    competitors: ESPNCompetitor[];
  }>;
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[];
}

/** Sports where ESPN uses individual competitors / leaderboard format */
const POSITION_SPORTS: Sport[] = ["golf", "tennis"];

/** Maps our Sport to ESPN's URL path segment(s). First entry is the default league. */
const SPORT_PATHS: Partial<Record<Sport, string>> = {
  nfl: "football/nfl",
  nhl: "hockey/nhl",
  nba: "basketball/nba",
  mlb: "baseball/mlb",
  soccer: "soccer/eng.1",
  rugby: "rugby/270557", // URC; others available via league param
  golf: "golf/pga",
  tennis: "tennis/atp",
  cricket: "cricket/8048", // IPL default; others via league param
  snooker: "general/snooker", // limited coverage
};

/**
 * ESPN unofficial API — undocumented, no API key.
 * Broad coverage: NFL, NHL, NBA, MLB, soccer, rugby, golf, tennis.
 * site.api.espn.com — may break without notice.
 */
export class ESPNProvider extends BaseProvider {
  readonly name = "espn";
  readonly supportedSports = [
    "nfl",
    "nhl",
    "nba",
    "mlb",
    "soccer",
    "rugby",
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
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    const sportPath = SPORT_PATHS[sport];
    if (!sportPath) return null;

    const data = await this.apiFetch<ESPNScoreboardResponse>(
      `${sportPath}/scoreboard`,
      { event: externalEventId }
    );
    if (!data?.events?.length) return null;

    const event = data.events[0];
    return this.normalizeEvent(sport, event);
  }

  async searchEvents(
    sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    const sportPath = SPORT_PATHS[sport];
    if (!sportPath) return [];

    const params: Record<string, string> = {};
    if (options?.date) {
      // ESPN scoreboard is single-day by default — extend to a 14-day window
      // starting from dateFrom so off-day searches still find upcoming fixtures.
      // search-events.ts and the client-side filter trim to the user's dateTo.
      const start = options.date.replace(/-/g, "");
      const rangeEnd = new Date(new Date(options.date).getTime() + 14 * 86_400_000);
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
    if (!data?.events?.length) return [];

    // Match query against event name OR team/athlete names.
    // If query is a competition name (e.g. "URC") that won't appear in event names,
    // fall back to returning all events — sport/league path is already the filter.
    const queryLower = query.toLowerCase().trim();
    const nameMatches = queryLower
      ? data.events.filter((e) => {
          const name = e.name.toLowerCase();
          const teams = (e.competitions[0]?.competitors ?? [])
            .map((c) => (c.team?.displayName ?? c.athlete?.displayName ?? "").toLowerCase())
            .join(" ");
          return name.includes(queryLower) || teams.includes(queryLower);
        })
      : data.events;
    const filtered = nameMatches.length > 0 ? nameMatches : data.events;

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
        competition_name: sportPath.split("/")[1]?.toUpperCase() ?? sport,
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
      is_final: event.status.type.completed,
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
      is_final: event.status.type.completed,
      positions,
      score: null,
      winner,
      margin: null,
      stats: null,
      raw: event,
    };
  }
}
