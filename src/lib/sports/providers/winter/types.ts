/**
 * Shared types for Caribbean winter baseball league providers.
 *
 * Each league (LIDOM, LMP, LVBP, LBPRC) will eventually have its own
 * official API provider. Until then, they return null and the chain
 * falls through to mlb-stats-winter (the MLB Stats API with sportId=17).
 */

/** Provider-league keys used in events.provider_league */
export type WinterLeagueKey =
  | "winter/lidom"
  | "winter/lmp"
  | "winter/lvbp"
  | "winter/lbprc"
  | "winter/caribbean";

/** MLB Stats API league IDs (sportId=17) */
export const MLB_STATS_LEAGUE_IDS: Record<WinterLeagueKey, number> = {
  "winter/lidom": 131,
  "winter/lmp": 132,
  "winter/lbprc": 133,
  "winter/lvbp": 135,
  "winter/caribbean": 162,
};

/** ESPN scoreboard slugs (only caribbean-series is confirmed working) */
export const ESPN_LEAGUE_SLUGS: Partial<Record<WinterLeagueKey, string>> = {
  "winter/caribbean": "baseball/caribbean-series",
  // Dead as of 2026-07 but preserved for future monitoring:
  // "winter/lidom": "baseball/dominican-winter-league",
  // "winter/lmp": "baseball/mexican-winter-league",
  // "winter/lvbp": "baseball/venezuelan-winter-league",
  // "winter/lbprc": "baseball/puerto-rican-winter-league",
};

/** Known state of each league's official API */
export interface LeagueApiStatus {
  leagueKey: WinterLeagueKey;
  officialDomain: string;
  apiStatus: "unavailable" | "discovered" | "implemented";
  notes: string;
}

export const LEAGUE_API_STATUS: LeagueApiStatus[] = [
  {
    leagueKey: "winter/lidom",
    officialDomain: "estadisticas.lidom.com",
    apiStatus: "unavailable",
    notes: "ASP.NET MVC Digimetrics platform. Internal AJAX endpoints require session context. No public API.",
  },
  {
    leagueKey: "winter/lmp",
    officialDomain: "api.lmp.mx",
    apiStatus: "discovered",
    notes: "api.lmp.mx exists (Apache, returns 'V2' landing). Endpoints undiscoverable — likely powers mobile app with auth.",
  },
  {
    leagueKey: "winter/lvbp",
    officialDomain: "lvbp.com",
    apiStatus: "unavailable",
    notes: "Static site. No API endpoints found.",
  },
  {
    leagueKey: "winter/lbprc",
    officialDomain: "lbprc.com",
    apiStatus: "unavailable",
    notes: "No centralised stats site or API found.",
  },
];
