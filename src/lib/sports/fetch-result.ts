import type { NormalizedResult, Sport } from "./types";
import { getProvidersForSport } from "./registry";

/**
 * Fetch the result for a sporting event by trying providers in priority order.
 * Returns null if all providers fail or return nothing (manual entry needed).
 *
 * @param providerLeague - Optional league path stored at pick time (e.g. "cricket/8044").
 *   Passed through to providers that support multi-league routing (ESPN).
 *   Providers that don't use it simply ignore the parameter.
 */
export async function fetchResult(
  sport: Sport,
  externalEventId: string,
  providerLeague?: string
): Promise<NormalizedResult | null> {
  const providers = getProvidersForSport(sport);

  for (const provider of providers) {
    try {
      const result = await provider.getResult(sport, externalEventId, providerLeague);
      if (result) return result;
    } catch (error) {
      console.error(
        `[sports] ${provider.name} failed for ${sport}/${externalEventId}:`,
        error
      );
    }
  }

  return null;
}
