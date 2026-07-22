import type React from "react";

/**
 * Per-league theming for the /ligas-invernales surface.
 *
 * Two axes:
 *   - Colour: national-colour accents applied via `--liga-accent` /
 *     `--liga-accent-deep`, picked up by the `liga` / `liga-deep` Tailwind
 *     tokens (see globals.css @theme inline).
 *   - Typography: a per-league display face via `--liga-font`, picked up by
 *     the `font-liga` utility. The referenced `--font-liga-*` variables are
 *     defined by the next/font families loaded in the /ligas-invernales layout.
 *
 * Unknown slugs return no vars, so the tokens fall back to the ps-amber accent
 * and the house Inter display face.
 *
 * NOTE on fonts: the official league fonts are proprietary and cannot be
 * self-hosted. The faces mapped below are free Google Fonts chosen to *evoke*
 * each league's style (condensed, bold, editorial). Swap the `--font-liga-*`
 * families in the layout for licensed faces when the brand packs arrive.
 */

export const LEAGUE_THEMES: Record<string, { accent: string; deep: string }> = {
  lmp: { accent: "#0a9a54", deep: "#036e3a" }, // Mexico green
  lvbp: { accent: "#b03047", deep: "#7a1f31" }, // Venezuela vinotinto
  lidom: { accent: "#2757d6", deep: "#1a3da8" }, // Dominican blue
  lbprc: { accent: "#0a90c9", deep: "#066a95" }, // Puerto Rico azure
  sdc: { accent: "#d19a1f", deep: "#93670b" }, // Serie del Caribe gold
};

/**
 * Per-league display font, expressed as the CSS variable defined by the
 * corresponding next/font family loaded in the ligas layout.
 */
export const LEAGUE_FONT_VARS: Record<string, string> = {
  lmp: "var(--font-liga-lmp)", // Barlow Semi Condensed — clean, sporty
  lvbp: "var(--font-liga-lvbp)", // Oswald — narrow, uppercase-friendly
  lidom: "var(--font-liga-lidom)", // Anton — heavy condensed (Round Robin poster)
  lbprc: "var(--font-liga-lbprc)", // Saira Condensed — tall, athletic
  sdc: "var(--font-liga-sdc)", // Bebas Neue — display caps, championship feel
};

/**
 * Inline style vars for a league; `{}` for unknown slugs (house defaults).
 * Sets both the accent colours and the per-league display font.
 */
export function ligaVars(slug: string): React.CSSProperties {
  const theme = LEAGUE_THEMES[slug];
  if (!theme) return {};
  const vars: Record<string, string> = {
    "--liga-accent": theme.accent,
    "--liga-accent-deep": theme.deep,
  };
  const font = LEAGUE_FONT_VARS[slug];
  if (font) vars["--liga-font"] = font;
  return vars as React.CSSProperties;
}
