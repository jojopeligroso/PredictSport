import { LEAGUE_THEMES } from "@/components/ligas/theme";

/**
 * Single source of truth for the winter-league surface (/ligas-invernales).
 *
 * Consolidates the per-league descriptive metadata that was previously
 * duplicated across the hub, [league] and todas pages.
 *
 * Copy note: all ES/EN strings here are factual identifiers (league names,
 * countries, month windows) — not originated marketing copy.
 *
 * Official logos: `logo` is the path to the official league logo once it has
 * been dropped into public/logos/ligas/ (see that folder's README). While it
 * is undefined, <LeagueLogo> renders the original house-style <LeagueMark>
 * instead. This lets the official media packs slot in with no code changes.
 */

export interface LeagueMeta {
  slug: string;
  /** Short badge code shown in mono chips. */
  code: string;
  nameEs: string;
  nameEn: string;
  countryEs: string;
  countryEn: string;
  /** Public path to a national flag SVG, or null (e.g. Serie del Caribe). */
  flag: string | null;
  /** Number of teams, or null for the unified view. */
  teams: number | null;
  windowEs: string;
  windowEn: string;
  /** Accent colours (mirrors theme.ts LEAGUE_THEMES). */
  accent: string;
  accentDeep: string;
  /**
   * Path to the official logo once supplied (public/logos/ligas/<slug>.svg).
   * Undefined → house-style LeagueMark is used as the fallback identity.
   */
  logo?: string;
}

/** Ordered list of the real leagues (excludes the "todas" aggregate view). */
export const LEAGUES: LeagueMeta[] = [
  {
    slug: "lmp",
    code: "MX",
    nameEs: "Liga Mexicana del Pacífico",
    nameEn: "Mexican Pacific League",
    countryEs: "México",
    countryEn: "Mexico",
    flag: "/flags/mx.svg",
    teams: 10,
    windowEs: "Oct–Ene",
    windowEn: "Oct–Jan",
    accent: LEAGUE_THEMES.lmp.accent,
    accentDeep: LEAGUE_THEMES.lmp.deep,
    logo: "/logos/ligas/lmp.png",
  },
  {
    slug: "lvbp",
    code: "VE",
    nameEs: "Liga Venezolana de Béisbol Profesional",
    nameEn: "Venezuelan Professional Baseball League",
    countryEs: "Venezuela",
    countryEn: "Venezuela",
    flag: "/flags/ve.svg",
    teams: 8,
    windowEs: "Oct–Ene",
    windowEn: "Oct–Jan",
    accent: LEAGUE_THEMES.lvbp.accent,
    accentDeep: LEAGUE_THEMES.lvbp.deep,
    logo: "/logos/ligas/lvbp.jpeg",
  },
  {
    slug: "lidom",
    code: "DO",
    nameEs: "Liga Dominicana de Béisbol",
    nameEn: "Dominican Professional Baseball League",
    countryEs: "República Dominicana",
    countryEn: "Dominican Republic",
    flag: "/flags/do.svg",
    teams: 6,
    windowEs: "Oct–Ene",
    windowEn: "Oct–Jan",
    accent: LEAGUE_THEMES.lidom.accent,
    accentDeep: LEAGUE_THEMES.lidom.deep,
    logo: "/logos/ligas/lidom.jpeg",
  },
  {
    slug: "lbprc",
    code: "PR",
    nameEs: "Liga Roberto Clemente",
    nameEn: "Roberto Clemente League",
    countryEs: "Puerto Rico",
    countryEn: "Puerto Rico",
    flag: "/flags/pr.svg",
    teams: 6,
    windowEs: "Nov–Ene",
    windowEn: "Nov–Jan",
    accent: LEAGUE_THEMES.lbprc.accent,
    accentDeep: LEAGUE_THEMES.lbprc.deep,
    logo: "/logos/ligas/lbprc.png",
  },
  {
    slug: "sdc",
    code: "SdC",
    nameEs: "Serie del Caribe",
    nameEn: "Caribbean Series",
    countryEs: "Caribe",
    countryEn: "Caribbean",
    flag: null,
    teams: 6,
    windowEs: "Feb",
    windowEn: "Feb",
    accent: LEAGUE_THEMES.sdc.accent,
    accentDeep: LEAGUE_THEMES.sdc.deep,
    logo: "/logos/ligas/sdc.jpeg",
  },
];

/** Lookup by slug (real leagues only). */
export const LEAGUE_BY_SLUG: Record<string, LeagueMeta> = Object.fromEntries(
  LEAGUES.map((l) => [l.slug, l])
);

/** Slugs of the real leagues, in display order. */
export const LEAGUE_SLUGS = LEAGUES.map((l) => l.slug);

/** True when a slug is one of the real winter leagues. */
export function isLeagueSlug(slug: string): boolean {
  return slug in LEAGUE_BY_SLUG;
}
