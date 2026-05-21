import { allowsDraws } from "@/lib/draw-eligibility";

/**
 * Parse an event name like "Liverpool vs Chelsea" into winner prediction options.
 * For draw-eligible sports/leagues, includes "Draw".
 */
export function parseWinnerOptions(
  eventName: string,
  sport?: string,
  providerLeague?: string | null,
): string[] {
  const separators = [" vs ", " v ", " VS ", " V "];
  for (const sep of separators) {
    const idx = eventName.indexOf(sep);
    if (idx !== -1) {
      const teamA = eventName.substring(0, idx).trim();
      const teamB = eventName.substring(idx + sep.length).trim();
      if (!teamA || !teamB) continue;
      if (sport && allowsDraws(sport, providerLeague)) {
        return [teamA, "Draw", teamB];
      }
      return [teamA, teamB];
    }
  }
  return [];
}
