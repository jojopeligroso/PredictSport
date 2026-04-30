import type { NormalizedResult, Sport } from "./types";
import { getProvidersForSport } from "./registry";

/**
 * Fetch the result for a sporting event by trying providers in priority order.
 * Returns null if all providers fail or return nothing (manual entry needed).
 */
export async function fetchResult(
  sport: Sport,
  externalEventId: string
): Promise<NormalizedResult | null> {
  const providers = getProvidersForSport(sport);

  for (const provider of providers) {
    try {
      const result = await provider.getResult(sport, externalEventId);
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
