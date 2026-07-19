/**
 * GAA county reference data.
 *
 * The codebase had no canonical county list; this is the single source for the
 * 32 counties plus the two overseas football units (London, New York), and the
 * provincial championship memberships used to seed the 2026 intercounty
 * championship blueprints.
 *
 * NOTE: provincial membership differs by CODE. Football uses the four
 * geographic provinces (Connacht/Leinster/Munster/Ulster). Hurling's provincial
 * championships (Munster SHC, Leinster SHC) have a fixed, promotion/relegation-
 * driven membership that does NOT match the geographic provinces — e.g. Galway
 * and Antrim play in Leinster hurling, and most Ulster/Connacht counties are in
 * the McDonagh/Ring/Rackard/Meagher tiers. Hurling memberships below reflect the
 * verified 2026 season and must be re-confirmed each year.
 */

export type Province = "Connacht" | "Leinster" | "Munster" | "Ulster";

/** The 32 counties. */
export const GAA_COUNTIES = [
  "Antrim", "Armagh", "Carlow", "Cavan", "Clare", "Cork", "Derry", "Donegal",
  "Down", "Dublin", "Fermanagh", "Galway", "Kerry", "Kildare", "Kilkenny",
  "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath",
  "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Tyrone",
  "Waterford", "Westmeath", "Wexford", "Wicklow",
] as const;

export type County = (typeof GAA_COUNTIES)[number];

/** Overseas units that contest the football championship. */
export const OVERSEAS_FOOTBALL_UNITS = ["London", "New York"] as const;

/**
 * FOOTBALL provincial championship membership (2026). London contests Connacht;
 * New York enters the 2026 Tailteann Cup at the preliminary quarter-final.
 */
export const FOOTBALL_PROVINCES: Record<Province, string[]> = {
  Connacht: ["Galway", "Leitrim", "Mayo", "Roscommon", "Sligo", "London", "New York"],
  Leinster: [
    "Carlow", "Dublin", "Kildare", "Kilkenny", "Laois", "Longford", "Louth",
    "Meath", "Offaly", "Westmeath", "Wexford", "Wicklow",
  ],
  Munster: ["Clare", "Cork", "Kerry", "Limerick", "Tipperary", "Waterford"],
  Ulster: [
    "Antrim", "Armagh", "Cavan", "Derry", "Donegal", "Down", "Fermanagh",
    "Monaghan", "Tyrone",
  ],
};

/**
 * HURLING provincial championship membership (verified 2026). Only Munster and
 * Leinster run senior provincial hurling championships; every other hurling
 * county is in the McDonagh/Ring/Rackard/Meagher tiers.
 */
export const HURLING_2026 = {
  /** Munster SHC 2026 — 5 teams, single round-robin. */
  munster: ["Clare", "Cork", "Limerick", "Tipperary", "Waterford"],
  /** Leinster SHC 2026 — 6 teams, single round-robin (Kildare promoted from the 2025 Joe McDonagh Cup). */
  leinster: ["Antrim", "Dublin", "Galway", "Kildare", "Kilkenny", "Wexford"],
} as const;
