import type React from "react";

/**
 * Per-league colour themes for the /ligas-invernales surface.
 *
 * National-colour based accents. Applied via inline CSS custom properties
 * (`--liga-accent`, `--liga-accent-deep`) which the `liga` / `liga-deep`
 * Tailwind tokens (see globals.css @theme inline) pick up. Unknown slugs
 * return no vars, so the tokens fall back to the ps-amber defaults.
 */

export const LEAGUE_THEMES: Record<string, { accent: string; deep: string }> = {
  lmp: { accent: "#0a9a54", deep: "#036e3a" }, // Mexico green
  lvbp: { accent: "#b03047", deep: "#7a1f31" }, // Venezuela vinotinto
  lidom: { accent: "#2757d6", deep: "#1a3da8" }, // Dominican blue
  lbprc: { accent: "#0a90c9", deep: "#066a95" }, // Puerto Rico azure
  sdc: { accent: "#d19a1f", deep: "#93670b" }, // Serie del Caribe gold
};

/** Inline style vars for a league; `{}` for unknown slugs (amber fallback). */
export function ligaVars(slug: string): React.CSSProperties {
  const theme = LEAGUE_THEMES[slug];
  if (!theme) return {};
  return {
    "--liga-accent": theme.accent,
    "--liga-accent-deep": theme.deep,
  } as React.CSSProperties;
}
