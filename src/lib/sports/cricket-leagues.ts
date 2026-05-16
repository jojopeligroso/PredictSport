/**
 * Known ESPN cricket league/series IDs.
 *
 * ESPN's cricket scoreboard endpoint accepts two ID namespaces:
 *   - Internal ESPN league IDs (8xxx, 8200s) — permanent domestic competitions
 *   - ESPNcricinfo series IDs (20000+, 24000+) — per-series IDs, one per tour/season
 *
 * Both work identically on: /apis/site/v2/sports/cricket/{id}/scoreboard
 *
 * IMPORTANT: Cricket rejects date-range params (YYYYMMDD-YYYYMMDD) — the ESPN
 * provider already handles this via DATE_RANGE_BROKEN_SPORTS. With no date param,
 * ESPN returns the next 3-5 upcoming fixtures for that league, which is ideal for
 * seeding. With a single date param, it returns that day's fixtures only.
 *
 * How to find new series IDs:
 *   1. Find the series on espncricinfo.com — the URL contains the series ID.
 *      e.g. /series/pakistan-in-bangladesh-2026-1532478/ → ID 1532478
 *   2. Pass that ID to the seeder — it probes the scoreboard endpoint to confirm.
 */

export interface CricketLeague {
  id: string;                // ESPN league ID or ESPNcricinfo series ID
  name: string;              // Human-readable name (used as competition_name in sporting_events)
  permanent: boolean;        // true = domestic competition with a fixed ID year-to-year
                             // false = per-series ID, expires after the tour ends
  active: boolean;           // false = off-season, skip in routine seeding runs
}

/**
 * Permanent domestic competitions — fixed ESPN internal IDs, never change.
 * Set active=false during their off-season to skip seeding calls.
 */
export const PERMANENT_LEAGUES: CricketLeague[] = [
  { id: "8048", name: "IPL",                            permanent: true, active: true  },
  { id: "8050", name: "Ranji Trophy",                   permanent: true, active: false }, // Final was Feb 2026
  { id: "8052", name: "County Championship Division One",permanent: true, active: true  },
  { id: "8204", name: "County Championship Division Two",permanent: true, active: true  },
  { id: "8053", name: "Vitality Blast (T20 Cup England)",permanent: true, active: false }, // starts Jun
  { id: "8044", name: "Big Bash League",                 permanent: true, active: false }, // Dec-Feb
  { id: "8043", name: "Sheffield Shield",                permanent: true, active: false }, // Oct-Mar
  { id: "8041", name: "SuperSport Series (SA)",          permanent: true, active: false },
];

/**
 * Per-series IDs for current and upcoming international tours / domestic cups.
 * These are ESPNcricinfo series IDs. Add new ones as tours are announced.
 * Remove (or set active=false) once a series finishes.
 *
 * Find IDs at espncricinfo.com — look for the number at the end of the series URL.
 */
export const SERIES_LEAGUES: CricketLeague[] = [
  // === Currently live (May 2026) ===
  { id: "24325", name: "Pakistan in Bangladesh Test Series 2026",    permanent: false, active: true  },
  { id: "24326", name: "Pakistan tour of Bangladesh 2026",           permanent: false, active: true  },

  // === Ireland domestic 2026 ===
  { id: "1534719", name: "Cricket Ireland Inter-Provincial T20 Trophy 2026", permanent: false, active: true  },
  // Limited Over Cup series ID TBC — starts Jun 30

  // === England home summer 2026 ===
  // (IDs TBC — add from Cricinfo when series pages go live)
  // New Zealand tour of Ireland — Test at Lord's Jun 4-8
  { id: "24260", name: "New Zealand in Ireland Test Match 2026",     permanent: false, active: true  },
  { id: "24261", name: "New Zealand tour of Ireland 2026",           permanent: false, active: true  },

  // === Ireland international 2026 ===
  { id: "24255", name: "West Indies Women in Ireland ODI Series 2026", permanent: false, active: true },
  { id: "24257", name: "India in Ireland T20I Series 2026",          permanent: false, active: true  },
  { id: "24258", name: "India tour of Ireland 2026",                 permanent: false, active: true  },
  { id: "24259", name: "Pakistan Women tour of Ireland 2026",        permanent: false, active: true  },
  { id: "24262", name: "Afghanistan in Ireland ODI Series 2026",     permanent: false, active: true  },
  { id: "24263", name: "Afghanistan tour of Ireland 2026",           permanent: false, active: true  },

  // === Future international series (pre-announced) ===
  { id: "24225", name: "Afghanistan in India ODI Series 2026",       permanent: false, active: true  },
  { id: "24226", name: "Afghanistan in India Test Match 2026",       permanent: false, active: true  },
  { id: "24230", name: "Bangladesh in Australia Test Series 2026",   permanent: false, active: true  },
  { id: "24264", name: "150th Anniversary Test Match 2026/27",       permanent: false, active: true  },
  { id: "24265", name: "England tour of Australia 2026/27",          permanent: false, active: true  }, // The Ashes
  { id: "24280", name: "Border-Gavaskar Trophy 2026/27",             permanent: false, active: true  },
];

export const ALL_CRICKET_LEAGUES: CricketLeague[] = [
  ...PERMANENT_LEAGUES,
  ...SERIES_LEAGUES,
];

export const ACTIVE_CRICKET_LEAGUES: CricketLeague[] = ALL_CRICKET_LEAGUES.filter(
  (l) => l.active
);
