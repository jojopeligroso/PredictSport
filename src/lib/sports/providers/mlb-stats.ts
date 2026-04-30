import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";

interface MLBGame {
  gamePk: number;
  gameDate: string;
  status: { detailedState: string };
  teams: {
    home: { team: { name: string }; score?: number };
    away: { team: { name: string }; score?: number };
  };
}

interface MLBScheduleResponse {
  dates: Array<{
    games: MLBGame[];
  }>;
}

interface MLBLiveFeed {
  gameData: {
    game: { pk: number };
    datetime: { dateTime: string };
    status: { detailedState: string };
    teams: {
      home: { name: string };
      away: { name: string };
    };
  };
  liveData: {
    linescore: {
      teams: {
        home: { runs: number };
        away: { runs: number };
      };
      innings: Array<{
        num: number;
        home: { runs: number };
        away: { runs: number };
      }>;
    };
  };
}

/**
 * MLB Stats API — official Major League Baseball API.
 * Free, no API key, excellent data.
 * https://statsapi.mlb.com
 */
export class MLBStatsProvider extends BaseProvider {
  readonly name = "mlb-stats";
  readonly supportedSports = ["mlb"] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig = {
    baseUrl: "https://statsapi.mlb.com/api/v1/",
    rateLimit: { requests: 60, windowMs: 60_000 },
  };

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  async getResult(
    _sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    const feed = await this.apiFetch<MLBLiveFeed>(
      `game/${externalEventId}/feed/live`
    );
    if (!feed?.liveData) return null;

    const { gameData, liveData } = feed;
    const homeRuns = liveData.linescore.teams.home.runs;
    const awayRuns = liveData.linescore.teams.away.runs;
    const homeName = gameData.teams.home.name;
    const awayName = gameData.teams.away.name;
    const isFinal = gameData.status.detailedState === "Final";

    let winner: string | null = null;
    if (homeRuns > awayRuns) winner = homeName;
    else if (awayRuns > homeRuns) winner = awayName;

    const periods: Record<string, { home: number; away: number }> = {};
    for (const inning of liveData.linescore.innings) {
      periods[`inning_${inning.num}`] = {
        home: inning.home.runs,
        away: inning.away.runs,
      };
    }

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport: "mlb",
      external_event_id: externalEventId,
      event_name: `${awayName} @ ${homeName}`,
      is_final: isFinal,
      positions: null,
      score: {
        home_team: homeName,
        away_team: awayName,
        home_score: homeRuns,
        away_score: awayRuns,
        periods,
      },
      winner,
      margin: Math.abs(homeRuns - awayRuns),
      stats: { total_runs: homeRuns + awayRuns },
      raw: feed,
    };
  }

  async searchEvents(
    _sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    const params: Record<string, string> = {
      sportId: "1",
    };
    if (options?.date) {
      params.date = options.date;
    }

    const data = await this.apiFetch<MLBScheduleResponse>("schedule", params);
    if (!data?.dates?.length) return [];

    const allGames = data.dates.flatMap((d) => d.games);
    const queryLower = query.toLowerCase();
    const filtered = allGames.filter(
      (g) =>
        g.teams.home.team.name.toLowerCase().includes(queryLower) ||
        g.teams.away.team.name.toLowerCase().includes(queryLower)
    );

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((g) => ({
      external_event_id: String(g.gamePk),
      event_name: `${g.teams.away.team.name} @ ${g.teams.home.team.name}`,
      sport: "mlb" as const,
      start_time: g.gameDate,
      competition_name: "MLB",
      participants: [g.teams.home.team.name, g.teams.away.team.name],
      provider: this.name,
    }));
  }
}
