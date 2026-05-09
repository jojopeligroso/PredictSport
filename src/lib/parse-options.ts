/**
 * Parse an event name like "Liverpool vs Chelsea" into winner prediction options.
 * For soccer/GAA, includes "Draw". For other sports, just the two competitors.
 */
export function parseWinnerOptions(
  eventName: string,
  sport?: string
): string[] {
  const separators = [" vs ", " v ", " VS ", " V "];
  for (const sep of separators) {
    const idx = eventName.indexOf(sep);
    if (idx !== -1) {
      const teamA = eventName.substring(0, idx).trim();
      const teamB = eventName.substring(idx + sep.length).trim();
      if (!teamA || !teamB) continue;
      const drawSports = ["soccer", "gaa"];
      if (sport && drawSports.includes(sport)) {
        return [teamA, "Draw", teamB];
      }
      return [teamA, teamB];
    }
  }
  return [];
}
