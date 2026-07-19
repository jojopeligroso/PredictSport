import type { SearchableEvent, Sport } from "./types";
import { getProvidersForSport } from "./registry";
import { tokenOverlapScore } from "./auto-result";

/**
 * Search for upcoming/recent events in a sport.
 * Used by admin UI to link events to external API entities AND by auto-resolve
 * to find provider matches for manual-ID events.
 *
 * Tries providers in chain order. A provider's results are only accepted if at
 * least one result has meaningful name overlap with the query (Jaccard >= 0.3).
 * This prevents a provider returning a large batch of unrelated events from
 * blocking subsequent providers that might have the actual match.
 */
export async function searchEvents(
  sport: Sport,
  query: string,
  options?: { date?: string; dateTo?: string; limit?: number; providerLeague?: string }
): Promise<SearchableEvent[]> {
  const providers = getProvidersForSport(sport, options?.providerLeague);

  for (const provider of providers) {
    if (provider.name === "manual") continue;

    try {
      const results = await provider.searchEvents(sport, query, {
        date: options?.date,
        limit: options?.limit,
        providerLeague: options?.providerLeague,
      });

      if (results.length > 0) {
        // Don't accept results from this provider unless at least one has
        // meaningful name overlap with the query. Without this check, a
        // provider returning a large batch (e.g. ESPN's full WC scoreboard)
        // that happens to NOT include the target match would block subsequent
        // providers (e.g. TheSportsDB) that find it reliably.
        const hasRelevant = results.some(
          (r) => tokenOverlapScore(query, r.event_name) >= 0.3,
        );
        if (!hasRelevant) {
          console.log(
            `[sports] ${provider.name} returned ${results.length} results for "${query}" but none relevant (Jaccard < 0.3), trying next provider`,
          );
          continue;
        }

        // If dateTo is specified, filter results within range
        if (options?.dateTo) {
          const endDate = new Date(options.dateTo + "T23:59:59Z");
          const filtered = results.filter((r) => {
            const eventDate = new Date(r.start_time);
            return eventDate <= endDate;
          });
          if (filtered.length > 0) return filtered;
        }
        return results;
      }
    } catch (error) {
      console.error(
        `[sports] ${provider.name} search failed for ${sport}/${query}:`,
        error
      );
    }
  }

  return [];
}
