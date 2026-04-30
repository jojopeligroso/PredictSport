import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";

interface ESPNCompetitor {
  team: { displayName: string };
  score: string;
  homeAway: "home" | "away";
  winner?: boolean;
}

interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  status: { type: { completed: boolean; description: string } };
  competitions: Array<{
    competitors: ESPNCompetitor[];
  }>;
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[];
}

/** Maps our Sport to ESPN's URL path segment */
const SPORT_PATHS: Partial<Record<Sport, string>> = {
  nfl: "football/nfl",
  nhl: "hockey/nhl",
  nba: "basketball/nba",
  soccer: "soccer/eng.1", // Premier League default
};

/**
 * ESPN unofficial API — undocumented, no API key.
 * Covers NFL, NHL. Fallback for NBA.
 * site.api.espn.com — may break without notice.
 */
export class ESPNProvider extends BaseProvider {
  readonly name = "espn";
  readonly supportedSports = [
    "nfl",
    "nhl",
    "nba",
    "soccer",
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
      // ESPN uses YYYYMMDD format
      params.dates = options.date.replace(/-/g, "");
    }

    const data = await this.apiFetch<ESPNScoreboardResponse>(
      `${sportPath}/scoreboard`,
      params
    );
    if (!data?.events?.length) return [];

    const queryLower = query.toLowerCase();
    const filtered = data.events.filter((e) =>
      e.name.toLowerCase().includes(queryLower)
    );

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((e) => {
      const competitors =
        e.competitions[0]?.competitors.map((c) => c.team.displayName) ?? [];
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
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");

    const homeScore = home ? parseInt(home.score) || 0 : 0;
    const awayScore = away ? parseInt(away.score) || 0 : 0;
    const homeName = home?.team.displayName ?? "Home";
    const awayName = away?.team.displayName ?? "Away";

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
      stats: {
        total_points: homeScore + awayScore,
      },
      raw: event,
    };
  }
}
