/**
 * Primary jersey/kit colors for WC 2026 nations.
 *
 * For teams whose home kit is white, the most recognisable accent or
 * secondary color is used instead so bars remain visible on both light
 * and dark backgrounds.
 */

const TEAM_COLORS: Record<string, string> = {
  // ── UEFA (16) ──────────────────────────────────────────────────────
  austria:                  "#ED1C24", // Red
  belgium:                  "#E30613", // Red
  "bosnia and herzegovina": "#003DA5", // Blue
  croatia:                  "#ED1C24", // Red checkered
  "czech republic":         "#CE1126", // Red
  england:                  "#1A3668", // Navy (white kit — badge/shorts accent)
  france:                   "#002654", // Navy blue
  germany:                  "#1D1D1B", // Black (white kit — flag/away accent)
  netherlands:              "#FF6B00", // Orange
  norway:                   "#BA0C2F", // Red
  portugal:                 "#DA291C", // Dark red
  scotland:                 "#003DA5", // Blue
  spain:                    "#AD1519", // Red
  sweden:                   "#FECC02", // Yellow
  switzerland:              "#FF0000", // Red
  turkey:                   "#E30A17", // Red

  // ── AFC (9) ────────────────────────────────────────────────────────
  australia:                "#FBB800", // Gold
  iran:                     "#239F40", // Green
  iraq:                     "#007A3D", // Green
  japan:                    "#002FA7", // Blue
  jordan:                   "#CE1126", // Red
  qatar:                    "#8D1B3D", // Maroon
  "saudi arabia":           "#006C35", // Green
  "south korea":            "#C60C30", // Red
  uzbekistan:               "#0075BC", // Blue

  // ── CAF (10) ───────────────────────────────────────────────────────
  algeria:                  "#006633", // Green (white kit — flag accent)
  "cape verde":             "#003DA5", // Blue
  "dr congo":               "#007FFF", // Blue
  egypt:                    "#CE1126", // Red
  ghana:                    "#FCD116", // Gold
  "ivory coast":            "#FF6600", // Orange
  morocco:                  "#C1272D", // Red
  senegal:                  "#006633", // Green (white kit — flag accent)
  "south africa":           "#FFB81C", // Gold
  tunisia:                  "#CE1126", // Red

  // ── CONCACAF (6) ──────────────────────────────────────────────────
  canada:                   "#FF0000", // Red
  curacao:                  "#003DA5", // Blue
  haiti:                    "#00209F", // Blue
  mexico:                   "#006847", // Green
  panama:                   "#DA121A", // Red
  "united states":          "#002868", // Navy blue

  // ── CONMEBOL (6) ──────────────────────────────────────────────────
  argentina:                "#75AADB", // Light blue
  brazil:                   "#FFDF00", // Yellow
  colombia:                 "#FCD116", // Yellow
  ecuador:                  "#FFD100", // Yellow
  paraguay:                 "#D52B1E", // Red
  uruguay:                  "#7BB5E0", // Light blue

  // ── OFC (1) ────────────────────────────────────────────────────────
  "new zealand":            "#1D1D1B", // Black
};

/* ── Aliases (mirror the ones in fifa-codes.ts) ─────────────────────── */
const ALIASES: Record<string, string> = {
  "bosnia":                           "bosnia and herzegovina",
  "bosnia & herzegovina":             "bosnia and herzegovina",
  "czechia":                          "czech republic",
  "holland":                          "netherlands",
  "turkiye":                          "turkey",
  "türkiye":                          "turkey",
  "korea":                            "south korea",
  "korea republic":                   "south korea",
  "cabo verde":                       "cape verde",
  "democratic republic of congo":     "dr congo",
  "democratic republic of the congo": "dr congo",
  "cote d'ivoire":                    "ivory coast",
  "côte d'ivoire":                    "ivory coast",
  "usa":                              "united states",
  "united states of america":         "united states",
};

/** Amber/black fallback for unknown teams. */
const FALLBACK_COLOR = "#f59e0b";

/**
 * Look up the primary jersey color for a team name.
 * Returns a hex string, falling back to amber for unknown teams.
 */
export function teamColor(name: string | null | undefined): string {
  if (!name) return FALLBACK_COLOR;
  const key = name.trim().toLowerCase();
  return TEAM_COLORS[key] ?? TEAM_COLORS[ALIASES[key] ?? ""] ?? FALLBACK_COLOR;
}

/**
 * Returns white or near-black text color for legibility on a given
 * background hex color (e.g. "#002654" → "#FFFFFF").
 */
export function textOnColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // W3C relative luminance shortcut
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#1D1D1B" : "#FFFFFF";
}
