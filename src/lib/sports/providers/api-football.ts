import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";

interface AFFixture {
  fixture: {
    id: number;
    date: string;
    status: { long: string; short: string };
  };
  league: { name: string; country: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

interface AFResponse<T> {
  response: T[];
  errors: Record<string, string>;
}

/**
 * API-Football — major soccer leagues.
 * Free tier: 100 requests/day, requires API key.
 * https://www.api-football.com/documentation
 */
export class ApiFootballProvider extends BaseProvider {
  readonly name = "api-football";
  readonly supportedSports = ["soccer"] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig;

  constructor() {
    super();
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      console.warn(
        "[sports] API_FOOTBALL_KEY not set -- API-Football provider disabled"
      );
    }
    this.config = {
      apiKey,
      baseUrl: "https://v3.football.api-sports.io/",
      // Free tier: 100 req/day. Budget as 4/hour so in-memory limiter
      // stays safe across serverless cold starts (resets give a fresh 4,
      // never exceeding the hourly budget).
      rateLimit: { requests: 4, windowMs: 3_600_000 }, // 4/hour ≈ 96/day max
    };
  }

  protected getAuthHeaders(apiKey: string): Record<string, string> {
    return { "x-apisports-key": apiKey };
  }

  async getResult(
    _sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    if (!this.config.apiKey) return null;

    const data = await this.apiFetch<AFResponse<AFFixture>>("fixtures", {
      id: externalEventId,
    });
    if (!data?.response?.length) return null;

    return this.normalizeFixture(data.response[0]);
  }

  async searchEvents(
    _sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    if (!this.config.apiKey) return [];

    const params: Record<string, string> = {};
    if (options?.date) {
      params.date = options.date;
    }
    // API-Football doesn't have a text search — search by date and filter
    const data = await this.apiFetch<AFResponse<AFFixture>>(
      "fixtures",
      params
    );
    if (!data?.response?.length) return [];

    const queryLower = query.toLowerCase();
    const filtered = data.response.filter(
      (f) =>
        f.teams.home.name.toLowerCase().includes(queryLower) ||
        f.teams.away.name.toLowerCase().includes(queryLower) ||
        f.league.name.toLowerCase().includes(queryLower)
    );

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((f) => ({
      external_event_id: String(f.fixture.id),
      event_name: `${f.teams.home.name} vs ${f.teams.away.name}`,
      sport: "soccer" as const,
      start_time: f.fixture.date,
      competition_name: f.league.name,
      participants: [f.teams.home.name, f.teams.away.name],
      provider: this.name,
    }));
  }

  private normalizeFixture(fixture: AFFixture): NormalizedResult {
    const homeScore = fixture.goals.home ?? 0;
    const awayScore = fixture.goals.away ?? 0;
    const hasScore = fixture.goals.home !== null;

    const isFinal = fixture.fixture.status.short === "FT";

    let winner: string | null = null;
    if (hasScore) {
      if (homeScore > awayScore) winner = fixture.teams.home.name;
      else if (awayScore > homeScore) winner = fixture.teams.away.name;
      else if (isFinal) winner = "draw";
    }

    const periods: Record<string, { home: number; away: number }> = {};
    if (fixture.score.halftime.home !== null) {
      periods.halftime = {
        home: fixture.score.halftime.home ?? 0,
        away: fixture.score.halftime.away ?? 0,
      };
    }

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport: "soccer",
      external_event_id: String(fixture.fixture.id),
      event_name: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
      is_final: isFinal,
      positions: null,
      score: hasScore
        ? {
            home_team: fixture.teams.home.name,
            away_team: fixture.teams.away.name,
            home_score: homeScore,
            away_score: awayScore,
            periods: Object.keys(periods).length > 0 ? periods : null,
          }
        : null,
      winner,
      margin: hasScore ? Math.abs(homeScore - awayScore) : null,
      stats: hasScore ? { total_goals: homeScore + awayScore } : null,
      raw: fixture,
    };
  }
}
