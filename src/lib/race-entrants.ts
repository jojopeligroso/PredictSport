/**
 * Known entrant lists for race sports where the field is fixed in advance.
 * Used to auto-populate winner/top_n options without requiring manual entry.
 */

export const F1_2026_DRIVERS: string[] = [
  "Verstappen", "Lawson", "Russell", "Antonelli", "Hamilton", "Leclerc",
  "Norris", "Piastri", "Alonso", "Stroll", "Gasly", "Doohan",
  "Sainz", "Albon", "Tsunoda", "Hadjar", "Ocon", "Bearman",
  "Hulkenberg", "Bortoleto",
];

/**
 * Returns the known entrant list for race sports with a fixed field.
 * Returns an empty array for all other sports.
 */
export function getRaceEntrants(sport: string): string[] {
  switch (sport) {
    case "formula_1":
      return F1_2026_DRIVERS;
    default:
      return [];
  }
}
