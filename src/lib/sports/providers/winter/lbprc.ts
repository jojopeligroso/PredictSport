import { BaseProvider } from "../base";
import type { NormalizedResult, ProviderConfig, SearchableEvent, Sport } from "../../types";

/**
 * LBPRC official API provider (skeleton).
 *
 * No centralised stats platform or public API found for the
 * Liga de Béisbol Profesional Roberto Clemente.
 *
 * When/if LBPRC publishes a public API, implement here.
 */
export class LBPRCProvider extends BaseProvider {
  readonly name = "lbprc-official";
  readonly supportedSports = ["baseball"] as const;

  protected readonly config: ProviderConfig = {
    baseUrl: "https://lbprc.com/",
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
