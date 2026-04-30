import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  ResultPosition,
  SearchableEvent,
  Sport,
} from "../types";

interface RacingResult {
  race_id: string;
  race_name: string;
  course: string;
  date: string;
  runners: Array<{
    position: string;
    horse: string;
    jockey: string;
    trainer: string;
  }>;
}

interface RacingRacecard {
  race_id: string;
  race_name: string;
  course: string;
  date: string;
  time: string;
  runners: Array<{
    horse: string;
    jockey: string;
    trainer: string;
  }>;
}

/**
 * TheRacingAPI — horse racing data for UK & Ireland.
 * Free tier available, requires API key.
 * https://www.theracingapi.com
 */
export class TheRacingAPIProvider extends BaseProvider {
  readonly name = "theracing-api";
  readonly supportedSports = [
    "horse_racing",
  ] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig;

  constructor() {
    super();
    const apiKey = process.env.THERACING_API_KEY;
    if (!apiKey) {
      console.warn(
        "[sports] THERACING_API_KEY not set -- TheRacingAPI provider disabled"
      );
    }
    this.config = {
      apiKey,
      baseUrl: "https://the-racing-api.com/v1/",
      rateLimit: { requests: 30, windowMs: 60_000 },
    };
  }

  async getResult(
    _sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    if (!this.config.apiKey) return null;

    const data = await this.apiFetch<RacingResult>(
      `results/${externalEventId}`
    );
    if (!data?.runners?.length) return null;

    const positions: ResultPosition[] = data.runners
      .filter((r) => r.position && !isNaN(parseInt(r.position)))
      .map((r) => ({
        position: parseInt(r.position),
        name: r.horse,
        team: r.trainer,
      }))
      .sort((a, b) => a.position - b.position);

    const winner = positions[0]?.name ?? null;

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport: "horse_racing",
      external_event_id: externalEventId,
      event_name: `${data.race_name} - ${data.course}`,
      is_final: true,
      positions,
      score: null,
      winner,
      margin: null,
      stats: null,
      raw: data,
    };
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

    const data = await this.apiFetch<{ racecards: RacingRacecard[] }>(
      "racecards",
      params
    );
    if (!data?.racecards?.length) return [];

    const queryLower = query.toLowerCase();
    const filtered = data.racecards.filter(
      (r) =>
        r.race_name.toLowerCase().includes(queryLower) ||
        r.course.toLowerCase().includes(queryLower)
    );

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((r) => ({
      external_event_id: r.race_id,
      event_name: `${r.race_name} - ${r.course}`,
      sport: "horse_racing" as const,
      start_time: `${r.date}T${r.time || "00:00:00"}Z`,
      competition_name: r.course,
      participants: r.runners.map((runner) => runner.horse),
      provider: this.name,
    }));
  }
}
