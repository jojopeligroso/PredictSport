import { BaseProvider } from "../base";
import type { NormalizedResult, ProviderConfig, SearchableEvent, Sport } from "../../types";

/**
 * LVBP official API provider (skeleton).
 *
 * lvbp.com is a static site with no discoverable API endpoints.
 * No developer documentation or public data feeds found.
 *
 * When/if LVBP publishes a public API, implement here.
 */
export class LVBPProvider extends BaseProvider {
  readonly name = "lvbp-official";
  readonly supportedSports = ["baseball"] as const;

  protected readonly config: ProviderConfig = {
    baseUrl: "https://lvbp.com/",
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
