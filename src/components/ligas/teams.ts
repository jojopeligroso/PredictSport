/**
 * Team rosters for the winter leagues.
 *
 * Used to render team identities on the /ligas-invernales surface. Each team
 * carries a short monogram (the fallback badge, e.g. "GC", "E", "T" as seen in
 * the official standings graphics) and an optional official logo path.
 *
 * Official team logos: drop files into public/logos/teams/<league>/<slug>.svg
 * (see that folder's README) and set `logo` here — <TeamBadge> renders the
 * official file when present, otherwise a monogram disc in the league accent.
 *
 * Copy note: names/abbreviations are factual identifiers.
 */

export interface TeamMeta {
  /** Stable slug (also the official-logo filename stem). */
  slug: string;
  /** Full club name. */
  name: string;
  /** ≤3-char monogram for the fallback badge. */
  abbr: string;
  /** Official logo path once supplied (public/logos/teams/<league>/<slug>.svg). */
  logo?: string;
}

export const TEAMS_BY_LEAGUE: Record<string, TeamMeta[]> = {
  // Liga Mexicana del Pacífico (10)
  lmp: [
    { slug: "charros-jalisco", name: "Charros de Jalisco", abbr: "JAL" },
    { slug: "tomateros-culiacan", name: "Tomateros de Culiacán", abbr: "CUL" },
    { slug: "naranjeros-hermosillo", name: "Naranjeros de Hermosillo", abbr: "HER" },
    { slug: "yaquis-obregon", name: "Yaquis de Obregón", abbr: "OBR" },
    { slug: "aguilas-mexicali", name: "Águilas de Mexicali", abbr: "MXL" },
    { slug: "venados-mazatlan", name: "Venados de Mazatlán", abbr: "MAZ" },
    { slug: "mayos-navojoa", name: "Mayos de Navojoa", abbr: "NAV" },
    { slug: "caneros-los-mochis", name: "Cañeros de Los Mochis", abbr: "MCH" },
    { slug: "algodoneros-guasave", name: "Algodoneros de Guasave", abbr: "GVE" },
    { slug: "sultanes-monterrey", name: "Sultanes de Monterrey", abbr: "MTY" },
  ],
  // Liga Venezolana de Béisbol Profesional (8)
  lvbp: [
    { slug: "leones-caracas", name: "Leones del Caracas", abbr: "CAR" },
    { slug: "navegantes-magallanes", name: "Navegantes del Magallanes", abbr: "MAG" },
    { slug: "cardenales-lara", name: "Cardenales de Lara", abbr: "LAR" },
    { slug: "tiburones-la-guaira", name: "Tiburones de La Guaira", abbr: "LG" },
    { slug: "aguilas-zulia", name: "Águilas del Zulia", abbr: "ZUL" },
    { slug: "tigres-aragua", name: "Tigres de Aragua", abbr: "ARA" },
    { slug: "caribes-anzoategui", name: "Caribes de Anzoátegui", abbr: "ANZ" },
    { slug: "bravos-margarita", name: "Bravos de Margarita", abbr: "MAR" },
  ],
  // Liga de Béisbol Profesional de la República Dominicana — LIDOM (6)
  lidom: [
    { slug: "tigres-licey", name: "Tigres del Licey", abbr: "LIC" },
    { slug: "leones-escogido", name: "Leones del Escogido", abbr: "ESC" },
    { slug: "aguilas-cibaenas", name: "Águilas Cibaeñas", abbr: "AC" },
    { slug: "estrellas-orientales", name: "Estrellas Orientales", abbr: "EO" },
    { slug: "gigantes-cibao", name: "Gigantes del Cibao", abbr: "GC" },
    { slug: "toros-este", name: "Toros del Este", abbr: "TE" },
  ],
  // Liga de Béisbol Profesional Roberto Clemente — Puerto Rico (6)
  lbprc: [
    { slug: "cangrejeros-santurce", name: "Cangrejeros de Santurce", abbr: "SAN" },
    { slug: "leones-ponce", name: "Leones de Ponce", abbr: "PON" },
    { slug: "gigantes-carolina", name: "Gigantes de Carolina", abbr: "GC" },
    { slug: "criollos-caguas", name: "Criollos de Caguas", abbr: "CAG" },
    { slug: "indios-mayaguez", name: "Indios de Mayagüez", abbr: "MAY" },
    { slug: "senadores-san-juan", name: "Senadores de San Juan", abbr: "SJ" },
  ],
};

/** Normalise a team name for matching (strip accents, lowercase). */
function normalise(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Build a name → TeamMeta index across all leagues (accent-insensitive). */
const TEAM_INDEX: Record<string, TeamMeta> = Object.fromEntries(
  Object.values(TEAMS_BY_LEAGUE)
    .flat()
    .map((t) => [normalise(t.name), t])
);

/** Look up a team's metadata by (possibly accented) name. */
export function teamMetaFor(name: string): TeamMeta | undefined {
  return TEAM_INDEX[normalise(name)];
}

/** Derive a ≤3-char monogram from an arbitrary team name. */
export function monogramFor(name: string): string {
  const meta = teamMetaFor(name);
  if (meta) return meta.abbr;
  // Fallback: initials of the significant words (skip de/del/los/las/y).
  const stop = new Set(["de", "del", "los", "las", "la", "el", "y"]);
  const words = name
    .split(/\s+/)
    .filter((w) => w && !stop.has(w.toLowerCase()));
  const initials = words.map((w) => w[0]).join("");
  return (initials || name.slice(0, 2)).slice(0, 3).toUpperCase();
}
