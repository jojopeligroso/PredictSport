import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";
import { MLB_STATS_LEAGUE_IDS, type WinterLeagueKey } from "./winter/types";

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
    date: string;
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
 * MLB Stats API — Winter Leagues (sportId=17).
 *
 * Covers all Caribbean winter leagues and the Serie del Caribe:
 *   leagueId 131 = LIDOM (Dominican Republic)
 *   leagueId 132 = LMP (Mexico)
 *   leagueId 133 = LBPRC (Puerto Rico)
 *   leagueId 135 = LVBP (Venezuela)
 *   leagueId 162 = Caribbean Series
 *
 * Free, no API key, 60 req/min. Same API shape as MLB (sportId=1) —
 * schedule endpoint for fixture discovery, /feed/live for game results.
 *
 * Events store providerLeague as "winter/lidom", "winter/lmp", etc.
 * This provider maps that to the correct leagueId.
 */
export class MLBStatsWinterProvider extends BaseProvider {
  readonly name = "mlb-stats-winter";
  readonly supportedSports = ["baseball"] as const;

  protected readonly config: ProviderConfig = {
    baseUrl: "https://statsapi.mlb.com/api/v1/",
    rateLimit: { requests: 60, windowMs: 60_000 },
  };

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  async getResult(
    _sport: Sport,
    externalEventId: string,
    _providerLeague?: string,
  ): Promise<NormalizedResult | null> {
    // externalEventId is the gamePk — same endpoint regardless of league
    const feed = await this.apiFetch<MLBLiveFeed>(
      `../v1.1/game/${externalEventId}/feed/live`,
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
      sport: "baseball",
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
    options?: { date?: string; limit?: number; providerLeague?: string },
  ): Promise<SearchableEvent[]> {
    const leagueKey = options?.providerLeague as WinterLeagueKey | undefined;
    const leagueId = leagueKey ? MLB_STATS_LEAGUE_IDS[leagueKey] : undefined;

    if (!leagueId) {
      // Without a league key, we can't know which winter league to search
      return [];
    }

    const params: Record<string, string> = {
      sportId: "17",
      leagueId: String(leagueId),
    };
    if (options?.date) {
      params.date = options.date;
    }

    const data = await this.apiFetch<MLBScheduleResponse>("schedule", params);
    if (!data?.dates?.length) return [];

    const allGames = data.dates.flatMap((d) => d.games);
    const queryLower = query.toLowerCase();
    const filtered = queryLower
      ? allGames.filter(
          (g) =>
            g.teams.home.team.name.toLowerCase().includes(queryLower) ||
            g.teams.away.team.name.toLowerCase().includes(queryLower),
        )
      : allGames;

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((g) => ({
      external_event_id: String(g.gamePk),
      event_name: `${g.teams.away.team.name} @ ${g.teams.home.team.name}`,
      sport: "baseball" as const,
      start_time: g.gameDate,
      competition_name: leagueKey?.replace("winter/", "").toUpperCase() ?? "Winter League",
      participants: [g.teams.home.team.name, g.teams.away.team.name],
      provider: this.name,
    }));
  }
}
