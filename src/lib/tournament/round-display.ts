/**
 * Round display name utilities for the /wc surface.
 *
 * Converts DB `rounds.name` values to user-facing labels per Section 19 of
 * DESIGN-WC-DASHBOARD-STATE.md. Outside /wc context, "Round" is the default
 * label — these helpers are WC-specific and should not be used elsewhere.
 *
 * Rules:
 *  - Group stage: strip "Group " prefix so "Group Matchday 1" → "Matchday 1"
 *  - Knockout stage: pass through verbatim ("Round of 32" → "Round of 32")
 *  - No abbreviations in user-facing output; code-level abbreviations (R32,
 *    QF, etc.) are captured in KNOCKOUT_LABELS for internal use only.
 */

/**
 * Code-level abbreviation → canonical user-facing label map.
 * Used internally and by tooling. Never render these abbreviations in UI.
 */
export const KNOCKOUT_LABELS: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  "3RD": "Final", // bundled into the Final prediction window
  FINAL: "Final",
};

/**
 * Converts a DB round name to a user-facing display label.
 *
 * @example
 * formatRoundDisplayName("Group Matchday 1") // → "Matchday 1"
 * formatRoundDisplayName("Group Matchday 3") // → "Matchday 3"
 * formatRoundDisplayName("Round of 32")      // → "Round of 32"
 * formatRoundDisplayName("Quarter-finals")   // → "Quarter-finals"
 */
export function formatRoundDisplayName(dbName: string): string {
  // Strip "Group " prefix for group-stage matchday labels
  if (dbName.startsWith("Group ")) {
    return dbName.slice("Group ".length);
  }
  // Knockout names pass through verbatim
  return dbName;
}

/**
 * Locale-specific round name translations.
 * Maps normalised DB round names to localised labels.
 * Falls back to the English formatRoundDisplayName() output.
 */
const ROUND_NAMES_ES: Record<string, string> = {
  "Matchday 1": "Jornada 1",
  "Matchday 2": "Jornada 2",
  "Matchday 3": "Jornada 3",
  "Round of 32": "Dieciseisavos de final",
  "Round of 16": "Octavos de final",
  "Quarter-Finals": "Cuartos de final",
  "Quarter-finals": "Cuartos de final",
  "Semi-Finals": "Semifinales",
  "Semi-finals": "Semifinales",
  "Final": "Final",
  // Abbreviations from test data
  "MD1": "Jornada 1",
  "MD2": "Jornada 2",
  "MD3": "Jornada 3",
  "R32": "Dieciseisavos de final",
  "R16": "Octavos de final",
  "QF": "Cuartos de final",
  "SF": "Semifinales",
};

/**
 * Returns a locale-aware display name for a DB round.
 *
 * @example
 * localiseRoundName("Group Matchday 1", "en") // → "Matchday 1"
 * localiseRoundName("Group Matchday 1", "es") // → "Jornada 1"
 * localiseRoundName("Round of 16", "es")      // → "Octavos de final"
 * localiseRoundName(null, "en")               // → "Round 1"
 */
export function localiseRoundName(
  dbName: string | null | undefined,
  locale: string,
): string {
  if (!dbName) return locale === "es" ? "Ronda 1" : "Round 1";

  const displayName = formatRoundDisplayName(dbName);

  if (locale === "es") {
    return ROUND_NAMES_ES[displayName] ?? ROUND_NAMES_ES[dbName] ?? displayName;
  }

  return displayName;
}

/**
 * Generates a round-aware CTA string for the /wc surface.
 *
 * Falls back to a generic prompt when no active round name is available.
 *
 * @example
 * formatRoundCTA("Group Matchday 2") // → "Matchday 2 picks →"
 * formatRoundCTA("Round of 16")      // → "Round of 16 picks →"
 * formatRoundCTA(null)               // → "Make your picks"
 * formatRoundCTA(undefined)          // → "Make your picks"
 */
export function formatRoundCTA(dbName: string | null | undefined): string {
  if (!dbName) {
    return "Make your picks";
  }
  return `${formatRoundDisplayName(dbName)} picks →`;
}
