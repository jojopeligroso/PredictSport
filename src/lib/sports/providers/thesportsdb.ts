import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  SearchableEvent,
  Sport,
} from "../types";

interface TSDBEvent {
  idEvent: string;
  strEvent: string;
  strSport: string;
  strLeague: string;
  dateEvent: string;
  strTime: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strResult: string | null;
  strStatus: string;
}

interface TSDBSearchResponse {
  event: TSDBEvent[] | null;
}

interface TSDBEventDetailResponse {
  events: TSDBEvent[] | null;
}

/**
 * TheSportsDB — community-maintained sports database.
 * Free tier, no API key (key "3" for free access).
 * Covers soccer (niche leagues), golf (majors), rugby, tennis.
 * https://www.thesportsdb.com/documentation
 */
export class TheSportsDBProvider extends BaseProvider {
  readonly name = "thesportsdb";
  readonly supportedSports = [
    "soccer",
    "golf",
    "rugby",
    "rugby_league",
    "tennis",
    "cricket",
    "athletics",
  ] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig = {
    baseUrl: "https://www.thesportsdb.com/api/v1/json/3/",
    rateLimit: { requests: 30, windowMs: 60_000 },
  };

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  async getResult(
    sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    const data = await this.apiFetch<TSDBEventDetailResponse>(
      "lookupevent.php",
      { id: externalEventId }
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
    const data = await this.apiFetch<TSDBSearchResponse>(
      "searchevents.php",
      { e: query }
    );
    if (!data?.event?.length) return [];

    const limit = options?.limit ?? 10;
    return data.event.slice(0, limit).map((e) => ({
      external_event_id: e.idEvent,
      event_name: e.strEvent,
      sport: this.mapSport(e.strSport, sport),
      start_time: `${e.dateEvent}T${e.strTime || "00:00:00"}Z`,
      competition_name: e.strLeague,
      participants: [e.strHomeTeam, e.strAwayTeam].filter(Boolean),
      provider: this.name,
    }));
  }

  private normalizeEvent(
    sport: Sport,
    event: TSDBEvent
  ): NormalizedResult | null {
    const homeScore = event.intHomeScore ? parseInt(event.intHomeScore) : null;
    const awayScore = event.intAwayScore ? parseInt(event.intAwayScore) : null;
    const hasScore = homeScore !== null && awayScore !== null;
    const isFinal =
      event.strStatus === "Match Finished" || event.strStatus === "FT";

    let winner: string | null = null;
    let margin: number | null = null;
    const stats: Record<string, number> = {};

    if (hasScore) {
      if (homeScore > awayScore) winner = event.strHomeTeam;
      else if (awayScore > homeScore) winner = event.strAwayTeam;
      margin = Math.abs(homeScore - awayScore);
      stats.total_goals = homeScore + awayScore;
    }

    // For non-team sports (golf, tennis), winner might be in strResult
    if (!winner && event.strResult) {
      winner = event.strResult;
    }

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport,
      external_event_id: event.idEvent,
      event_name: event.strEvent,
      is_final: isFinal,
      positions: null,
      score: hasScore
        ? {
            home_team: event.strHomeTeam,
            away_team: event.strAwayTeam,
            home_score: homeScore,
            away_score: awayScore,
            periods: null,
          }
        : null,
      winner,
      margin,
      stats: Object.keys(stats).length > 0 ? stats : null,
      raw: event,
    };
  }

  private mapSport(tsdbSport: string, fallback: Sport): Sport {
    const map: Record<string, Sport> = {
      Soccer: "soccer",
      Football: "soccer",
      Golf: "golf",
      Rugby: "rugby",
      Tennis: "tennis",
      Cricket: "cricket",
    };
    return map[tsdbSport] ?? fallback;
  }
}
