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
