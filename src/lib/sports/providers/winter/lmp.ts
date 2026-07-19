import { BaseProvider } from "../base";
import type { NormalizedResult, ProviderConfig, SearchableEvent, Sport } from "../../types";

/**
 * LMP official API provider (skeleton).
 *
 * api.lmp.mx exists (Apache server, returns "V2" landing page) but
 * endpoints are undiscoverable — likely powers the LMP mobile app with
 * authentication. lmp.mx frontend references api.lmp.mx in its HTML
 * but no routes respond publicly.
 *
 * When/if LMP publishes public docs or the API is reverse-engineered,
 * implement here. The provider chain will automatically prefer this
 * over mlb-stats-winter.
 */
export class LMPProvider extends BaseProvider {
  readonly name = "lmp-official";
  readonly supportedSports = ["baseball"] as const;

  protected readonly config: ProviderConfig = {
    baseUrl: "https://api.lmp.mx/",
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
