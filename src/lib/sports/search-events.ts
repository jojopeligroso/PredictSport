import type { SearchableEvent, Sport } from "./types";
import { getProvidersForSport } from "./registry";

/**
 * Search for upcoming/recent events in a sport.
 * Used by admin UI to link events to external API entities.
 * Tries the first non-manual provider that returns results.
 */
export async function searchEvents(
  sport: Sport,
  query: string,
  options?: { date?: string; limit?: number }
): Promise<SearchableEvent[]> {
  const providers = getProvidersForSport(sport);

  for (const provider of providers) {
    if (provider.name === "manual") continue;

    try {
      const results = await provider.searchEvents(sport, query, options);
      if (results.length > 0) return results;
    } catch (error) {
      console.error(
        `[sports] ${provider.name} search failed for ${sport}/${query}:`,
        error
      );
    }
  }

  return [];
}
