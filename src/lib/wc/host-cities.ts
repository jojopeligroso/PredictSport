/**
 * FIFA World Cup 2026 host-city design tokens.
 *
 * Colours are sampled from the official host-city palette. See
 * `design/WC26 host cities/colors.md` for the canonical sheet and contrast
 * notes. White is always the foreground on host-city cards.
 */

export type HostCitySlug =
  | "atlanta"
  | "boston"
  | "dallas"
  | "houston"
  | "kansas-city"
  | "los-angeles"
  | "miami"
  | "new-york-new-jersey"
  | "philadelphia"
  | "san-francisco-bay-area"
  | "seattle"
  | "toronto"
  | "vancouver"
  | "guadalajara"
  | "mexico-city"
  | "monterrey";

export type HostCountry = "USA" | "CAN" | "MEX";

export interface HostCity {
  slug: HostCitySlug;
  /** Display label (city only — venue stays in `stadium`). */
  name: string;
  /** Abbreviated name for tight spaces (e.g. "IN LA", "IN NYC"). */
  shortName: string;
  country: HostCountry;
  /** IANA timezone for the stadium. */
  timezone: string;
  /** Stadium / venue name. */
  stadium: string;
  /** Card background colour. White is always the foreground. */
  color: string;
}

export const HOST_CITIES: Record<HostCitySlug, HostCity> = {
  atlanta: {
    slug: "atlanta",
    name: "Atlanta",
    shortName: "Atlanta",
    country: "USA",
    timezone: "America/New_York",
    stadium: "Mercedes-Benz Stadium",
    color: "#00B5C8",
  },
  boston: {
    slug: "boston",
    name: "Boston",
    shortName: "Boston",
    country: "USA",
    timezone: "America/New_York",
    stadium: "Gillette Stadium",
    color: "#218521",
  },
  dallas: {
    slug: "dallas",
    name: "Dallas",
    shortName: "Dallas",
    country: "USA",
    timezone: "America/Chicago",
    stadium: "AT&T Stadium",
    color: "#0E5C66",
  },
  houston: {
    slug: "houston",
    name: "Houston",
    shortName: "Houston",
    country: "USA",
    timezone: "America/Chicago",
    stadium: "NRG Stadium",
    color: "#2497F1",
  },
  "kansas-city": {
    slug: "kansas-city",
    name: "Kansas City",
    shortName: "KC",
    country: "USA",
    timezone: "America/Chicago",
    stadium: "GEHA Field at Arrowhead Stadium",
    color: "#FB2350",
  },
  "los-angeles": {
    slug: "los-angeles",
    name: "Los Angeles",
    shortName: "LA",
    country: "USA",
    timezone: "America/Los_Angeles",
    stadium: "SoFi Stadium",
    color: "#FF6F66",
  },
  miami: {
    slug: "miami",
    name: "Miami",
    shortName: "Miami",
    country: "USA",
    timezone: "America/New_York",
    stadium: "Hard Rock Stadium",
    color: "#EE6FA6",
  },
  "new-york-new-jersey": {
    slug: "new-york-new-jersey",
    name: "New York New Jersey",
    shortName: "NY/NJ",
    country: "USA",
    timezone: "America/New_York",
    stadium: "MetLife Stadium",
    color: "#11154A",
  },
  philadelphia: {
    slug: "philadelphia",
    name: "Philadelphia",
    shortName: "Philly",
    country: "USA",
    timezone: "America/New_York",
    stadium: "Lincoln Financial Field",
    color: "#1F3CAB",
  },
  "san-francisco-bay-area": {
    slug: "san-francisco-bay-area",
    name: "San Francisco Bay Area",
    shortName: "SF Bay",
    country: "USA",
    timezone: "America/Los_Angeles",
    stadium: "Levi's Stadium",
    color: "#E0421A",
  },
  seattle: {
    slug: "seattle",
    name: "Seattle",
    shortName: "Seattle",
    country: "USA",
    timezone: "America/Los_Angeles",
    stadium: "Lumen Field",
    color: "#97961B",
  },
  toronto: {
    slug: "toronto",
    name: "Toronto",
    shortName: "Toronto",
    country: "CAN",
    timezone: "America/Toronto",
    stadium: "BMO Field",
    color: "#3D4EFF",
  },
  vancouver: {
    slug: "vancouver",
    name: "Vancouver",
    shortName: "Vancouver",
    country: "CAN",
    timezone: "America/Vancouver",
    stadium: "BC Place",
    color: "#04382B",
  },
  guadalajara: {
    slug: "guadalajara",
    name: "Guadalajara",
    shortName: "GDL",
    country: "MEX",
    timezone: "America/Mexico_City",
    stadium: "Estadio Akron",
    color: "#DA2363",
  },
  "mexico-city": {
    slug: "mexico-city",
    name: "Mexico City",
    shortName: "CDMX",
    country: "MEX",
    timezone: "America/Mexico_City",
    stadium: "Estadio Azteca",
    color: "#8C4DFC",
  },
  monterrey: {
    slug: "monterrey",
    name: "Monterrey",
    shortName: "MTY",
    country: "MEX",
    timezone: "America/Monterrey",
    stadium: "Estadio BBVA",
    color: "#1AB89C",
  },
};

export function getHostCity(slug: HostCitySlug): HostCity {
  return HOST_CITIES[slug];
}
