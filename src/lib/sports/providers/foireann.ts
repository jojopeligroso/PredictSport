import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";

/**
 * Foireann fixture/result from the Open Data API.
 * https://api.foireann.ie/open-data/swagger-ui/index.html
 */
interface FoireannTeam {
  id: string;
  name: string;
  goals: number | null;
  points: number | null;
  penalties: number | null;
  logo: string | null;
  bye: boolean;
  conceded: boolean;
}

interface FoireannCompetition {
  id: string;
  name: string;
  type: string;
  activity: string;
  grade: string;
  season: string;
}

interface FoireannDivision {
  name: string;
  format: string;
}

interface FoireannFixture {
  id: string;
  homeTeam: FoireannTeam;
  awayTeam: FoireannTeam;
  startDate: string;
  isResult: boolean;
  round: string | null;
  refereeName: string | null;
  venue: string | null;
  competition: FoireannCompetition;
  division: FoireannDivision | null;
  postponed: boolean;
  rescheduled: boolean;
  replay: boolean;
  abandoned: boolean;
}

interface FoireannPageResponse {
  content: FoireannFixture[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

/**
 * Foireann — GAA's official Open Data API.
 * Covers GAA (football, hurling), LGFA, and Camogie from 2013 onwards.
 * Requires API key from Foireann Support.
 * https://api.foireann.ie/open-data/swagger-ui/index.html
 */
export class FoireannProvider extends BaseProvider {
  readonly name = "foireann";
  readonly supportedSports = ["gaa"] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig;

  constructor() {
    super();
    const apiKey = process.env.FOIREANN_API_KEY;
    if (!apiKey) {
      console.warn(
        "[sports] foireann: FOIREANN_API_KEY not set, provider disabled"
      );
    }
    this.config = {
      apiKey: apiKey ?? undefined,
      baseUrl: "https://api.foireann.ie/open-data/",
      rateLimit: { requests: 30, windowMs: 60_000 },
    };
  }

  async getResult(
    sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    if (!this.config.apiKey) return null;

    // Foireann doesn't have a single-fixture endpoint, so we search by ID
    // The fixture ID is a UUID — fetch fixtures filtered to find it
    const data = await this.apiFetch<FoireannPageResponse>("v1/fixtures", {
      page: "0",
      size: "1",
    });

    // Since there's no direct lookup by ID, we need to search across results.
    // Try fetching recent results and matching — but the more reliable approach
    // is to store enough metadata when linking so we can re-fetch.
    // For a single fixture lookup, search with a broad filter and match the ID.
    const result = await this.fetchFixtureById(externalEventId);
    if (!result) return null;

    return this.normalizeResult(sport, result);
  }

  async searchEvents(
    _sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    if (!this.config.apiKey) return [];

    const limit = options?.limit ?? 10;
    const params: Record<string, string> = {
      page: "0",
      size: "50",
      sort: "startDate,asc",
      "competition.type": "inter_county",
    };

    // Map common GAA activities
    const queryLower = query.toLowerCase();
    if (queryLower.includes("hurl")) {
      params["activity"] = "hurling";
    } else if (
      queryLower.includes("football") ||
      queryLower.includes("gaelic")
    ) {
      params["activity"] = "football";
    } else if (queryLower.includes("camog")) {
      params["activity"] = "camogie";
    } else if (queryLower.includes("ladies")) {
      params["activity"] = "ladies_football";
    }

    // If a date is provided, search around that date
    if (options?.date) {
      params["startDateFrom"] = options.date;
      // Search 7 days ahead
      const endDate = new Date(options.date);
      endDate.setDate(endDate.getDate() + 7);
      params["startDateTo"] = endDate.toISOString().split("T")[0];
    } else {
      // Default: upcoming fixtures from today
      params["startDateFrom"] = new Date().toISOString().split("T")[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      params["startDateTo"] = endDate.toISOString().split("T")[0];
    }

    const data = await this.apiFetch<FoireannPageResponse>("v1/fixtures", params);
    if (!data?.content?.length) return [];

    // Client-side text filter on team/competition names
    const filtered = data.content
      .filter((f) => !f.postponed && !f.abandoned)
      .filter((f) => {
        if (!query) return true;
        const searchable = [
          f.homeTeam.name,
          f.awayTeam.name,
          f.competition.name,
          f.division?.name,
          f.venue,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        // Match all query words
        const words = queryLower.split(/\s+/).filter(Boolean);
        return words.every((w) => searchable.includes(w));
      });

    return filtered.slice(0, limit).map((f) => ({
      external_event_id: f.id,
      event_name: `${f.homeTeam.name} v ${f.awayTeam.name}`,
      sport: "gaa" as Sport,
      start_time: f.startDate,
      competition_name: f.division
        ? `${f.competition.name} - ${f.division.name}`
        : f.competition.name,
      participants: [f.homeTeam.name, f.awayTeam.name],
      provider: this.name,
    }));
  }

  /**
   * Fetch a single fixture by ID.
   * Foireann API doesn't expose a GET /v1/fixtures/{id} endpoint,
   * so we search recent results and upcoming fixtures to find it.
   */
  private async fetchFixtureById(
    fixtureId: string
  ): Promise<FoireannFixture | null> {
    // Search results (played matches) first - most likely scenario for getResult()
    for (const isResult of ["true", "false"]) {
      const params: Record<string, string> = {
        page: "0",
        size: "100",
        sort: "startDate,desc",
        isResult,
      };

      const data = await this.apiFetch<FoireannPageResponse>(
        "v1/fixtures",
        params
      );
      if (!data?.content?.length) continue;

      const match = data.content.find((f) => f.id === fixtureId);
      if (match) return match;
    }

    return null;
  }

  /**
   * Normalize a Foireann fixture into a NormalizedResult.
   *
   * GAA scoring: goals (worth 3 points each) + points.
   * e.g., 2-14 = 2 goals + 14 points = 20 total.
   * We use total points for home_score/away_score to work with the scoring engine,
   * and store the raw goals/points breakdown in stats.
   */
  private normalizeResult(
    sport: Sport,
    fixture: FoireannFixture
  ): NormalizedResult | null {
    const home = fixture.homeTeam;
    const away = fixture.awayTeam;

    const homeGoals = home.goals ?? 0;
    const homePoints = home.points ?? 0;
    const awayGoals = away.goals ?? 0;
    const awayPoints = away.points ?? 0;

    const homeTotal = homeGoals * 3 + homePoints;
    const awayTotal = awayGoals * 3 + awayPoints;

    const hasScore =
      fixture.isResult &&
      home.goals !== null &&
      home.points !== null &&
      away.goals !== null &&
      away.points !== null;

    let winner: string | null = null;
    let margin: number | null = null;

    if (hasScore) {
      if (homeTotal > awayTotal) winner = home.name;
      else if (awayTotal > homeTotal) winner = away.name;
      // draw: winner stays null
      margin = Math.abs(homeTotal - awayTotal);
    }

    // Check for concession
    if (home.conceded) winner = away.name;
    if (away.conceded) winner = home.name;

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport,
      external_event_id: fixture.id,
      event_name: `${home.name} v ${away.name}`,
      is_final: fixture.isResult && !fixture.abandoned,
      positions: null,
      score: hasScore
        ? {
            home_team: home.name,
            away_team: away.name,
            home_score: homeTotal,
            away_score: awayTotal,
            periods: null,
          }
        : null,
      winner,
      margin,
      stats: hasScore
        ? {
            home_goals: homeGoals,
            home_points: homePoints,
            away_goals: awayGoals,
            away_points: awayPoints,
            total_score: homeTotal + awayTotal,
          }
        : null,
      raw: fixture,
    };
  }
}
