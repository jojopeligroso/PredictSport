import { BaseProvider } from "./base";
import type {
  NormalizedResult,
  ProviderConfig,
  ResultPosition,
  SearchableEvent,
  Sport,
} from "../types";

interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  circuit_short_name: string;
  country_name: string;
  year: number;
}

interface OpenF1Position {
  position: number;
  driver_number: number;
  broadcast_name: string;
  team_name: string;
}

interface OpenF1Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  team_name: string;
}

/**
 * OpenF1 — official Formula 1 API.
 * Free, no API key, excellent data quality.
 * https://openf1.org
 */
export class OpenF1Provider extends BaseProvider {
  readonly name = "openf1";
  readonly supportedSports = ["formula_1"] as const satisfies readonly Sport[];

  protected readonly config: ProviderConfig = {
    baseUrl: "https://api.openf1.org/v1/",
    rateLimit: { requests: 60, windowMs: 60_000 },
  };

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  async getResult(
    _sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null> {
    // Fetch session info
    const sessions = await this.apiFetch<OpenF1Session[]>("sessions", {
      session_key: externalEventId,
    });
    if (!sessions?.length) return null;
    const session = sessions[0];

    // Fetch final classification
    const positions = await this.apiFetch<OpenF1Position[]>("position", {
      session_key: externalEventId,
    });
    if (!positions?.length) return null;

    // Get the last position entry per driver (final classification)
    const finalPositions = new Map<number, OpenF1Position>();
    for (const pos of positions) {
      finalPositions.set(pos.driver_number, pos);
    }

    const sorted = [...finalPositions.values()].sort(
      (a, b) => a.position - b.position
    );

    const resultPositions: ResultPosition[] = sorted.map((p) => ({
      position: p.position,
      name: p.broadcast_name,
      team: p.team_name,
    }));

    const winner = resultPositions[0]?.name ?? null;
    const isFinal = new Date(session.date_end) < new Date();

    return {
      provider: this.name,
      fetched_at: new Date().toISOString(),
      sport: "formula_1",
      external_event_id: externalEventId,
      event_name: `${session.session_name} - ${session.circuit_short_name} ${session.year}`,
      is_final: isFinal,
      positions: resultPositions,
      score: null,
      winner,
      margin: null,
      stats: null,
      raw: { session, positions: sorted },
    };
  }

  async searchEvents(
    _sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    const params: Record<string, string> = {
      session_type: "Race",
    };
    if (options?.date) {
      params["date_start>"] = options.date;
    }

    const sessions = await this.apiFetch<OpenF1Session[]>("sessions", params);
    if (!sessions?.length) return [];

    const queryLower = query.toLowerCase();
    const filtered = sessions.filter(
      (s) =>
        s.session_name.toLowerCase().includes(queryLower) ||
        s.circuit_short_name.toLowerCase().includes(queryLower) ||
        s.country_name.toLowerCase().includes(queryLower)
    );

    // Fetch drivers for participant list
    const drivers = await this.apiFetch<OpenF1Driver[]>("drivers", {
      session_key: String(filtered[0]?.session_key ?? sessions[0].session_key),
    });
    const driverNames = (drivers ?? []).map((d) => d.full_name);

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit).map((s) => ({
      external_event_id: String(s.session_key),
      event_name: `${s.session_name} - ${s.circuit_short_name} ${s.year}`,
      sport: "formula_1" as const,
      start_time: s.date_start,
      competition_name: `Formula 1 ${s.year}`,
      participants: driverNames,
      provider: this.name,
    }));
  }
}
