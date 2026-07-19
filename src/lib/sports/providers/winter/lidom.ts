import { BaseProvider } from "../base";
import type { NormalizedResult, ProviderConfig, SearchableEvent, Sport } from "../../types";

/**
 * LIDOM official API provider (skeleton).
 *
 * estadisticas.lidom.com runs a Digimetrics ASP.NET MVC platform with
 * internal AJAX endpoints (e.g. /TablaPosicion/TablaPosicion?idTemporada=X).
 * These require server-side session context and are not publicly accessible.
 *
 * When/if LIDOM publishes a public API, implement getResult() and
 * searchEvents() here. The provider chain will automatically prefer this
 * over mlb-stats-winter.
 */
export class LIDOMProvider extends BaseProvider {
  readonly name = "lidom-official";
  readonly supportedSports = ["baseball"] as const;

  protected readonly config: ProviderConfig = {
    baseUrl: "http://estadisticas.lidom.com/",
    rateLimit: { requests: 10, windowMs: 60_000 },
  };

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  async getResult(
    _sport: Sport,
    _externalEventId: string,
    _providerLeague?: string,
  ): Promise<NormalizedResult | null> {
    return null;
  }

  async searchEvents(
    _sport: Sport,
    _query: string,
    _options?: { date?: string; limit?: number },
  ): Promise<SearchableEvent[]> {
    return [];
  }
}
