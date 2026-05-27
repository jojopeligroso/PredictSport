/**
 * Brand chrome palette — a subset of the 16-swatch palette documented in
 * design/brand-palette.md, plucked for the picks-first /wc landing.
 *
 * These hexes drive *chrome* elements only — day pills, the by-date/by-group
 * toggle, the "!" cutoff marker, the hero accent flash. Fixture cards stay
 * on the host-city palette (see ADR 0014 + design/DESIGN-RULES.md).
 *
 * Keep this file tiny and intentional. If the chrome needs another swatch,
 * add it here with a usage note, don't pull it inline.
 */

export const CHROME_PALETTE = {
  /** Yellow `#fff200` — urgency without alarm. Used for the day-before-close `!` badge. */
  warning: "#fff200",
  /** Vivid red `#e63946` — hero accent flash, strong attention. */
  heroAccent: "#e63946",
  /** Royal blue `#1e6cff` — ViewToggle active-segment underline. Cool counterpoint to amber selection. */
  toggleActive: "#1e6cff",
  /** Bright purple `#a020f0` — attention accent for action-required states (e.g. missing exact score). Maximally distinct from amber completion accent. */
  attention: "#a020f0",
  /** Aqua `#5eead4` — reserved for future use (e.g. "saved" pulse). Not currently consumed. */
  ok: "#5eead4",
} as const;

export type ChromeSwatch = keyof typeof CHROME_PALETTE;
