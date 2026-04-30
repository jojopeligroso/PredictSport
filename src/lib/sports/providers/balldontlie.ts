import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";

interface BDLGame {
  id: number;
  date: string;
  status: string;
  home_team: { full_name: string };
  visitor_team: { full_name: string };
  home_team_score: number;
  visitor_team_score: number;
}

interface BDLResponse<T> {
  data: T[];
}

/**
 * BALLDONTLIE — multi-sport API.
 * Free tier for NBA. Paid tiers add NFL, MLB, NHL, World Cup.
 * https://www.balldontlie.io
 */
export class BallDontLieProvider extends BaseProvider {
  readonly name = "balldontlie";
  readonly supportedSports = [
    "nba",
    "nfl",
    "mlb",
    "nhl",
    "soccer",
  ] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig;

  constructor() {
    super();
    const apiKey = process.env.BALLDONTLIE_KEY;
    if (!apiKey) {
      console.warn(
        "[sports] BALLDONTLIE_KEY not set -- BALLDONTLIE provider disabled"
      );
    }
    this.config = {
      apiKey,
      baseUrl: "https://api.balldontlie.io/v1/",
      rateLimit: { requests: 30, windowMs: 60_000 },
    };
  }

  async getResult(
    sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    if (!this.config.apiKey) return null;

    // Currently only NBA endpoint is well-documented on the free tier
    if (sport !== "nba") return null;

    const game = await this.apiFetch<{ data: BDLGame }>(
      `games/${externalEventId}`
    );
    if (!game?.data) return null;

    return this.normalizeGame(sport, game.data);
  }

  async searchEvents(
    sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    if (!this.config.apiKey) return [];
    if (sport !== "nba") return [];

    const params: Record<string, string> = {};
    if (options?.date) {
      params["dates[]"] = options.date;
    }

    const data = await this.apiFetch<BDLResponse<BDLGame>>("games", params);
    if (!data?.data?.length) return [];

    const queryLower = query.toLowerCase();
    const filtered = data.data.filter(
      (g) =>
        g.home_team.full_name.toLowerCase().includes(queryLower) ||
        g.visitor_team.full_name.toLowerCase().includes(queryLower)
    );

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((g) => ({
      external_event_id: String(g.id),
      event_name: `${g.visitor_team.full_name} @ ${g.home_team.full_name}`,
      sport,
      start_time: g.date,
      competition_name: "NBA",
      participants: [g.home_team.full_name, g.visitor_team.full_name],
      provider: this.name,
    }));
  }

  private normalizeGame(sport: Sport, game: BDLGame): NormalizedResult {
    const homeScore = game.home_team_score;
    const awayScore = game.visitor_team_score;
    const homeName = game.home_team.full_name;
    const awayName = game.visitor_team.full_name;

    let winner: string | null = null;
    if (homeScore > awayScore) winner = homeName;
    else if (awayScore > homeScore) winner = awayName;

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport,
      external_event_id: String(game.id),
      event_name: `${awayName} @ ${homeName}`,
      is_final: game.status === "Final",
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
      raw: game,
    };
  }
}
