import type { Sport, SportsProvider } from "./types";
import { OpenF1Provider } from "./providers/openf1";
import { TheSportsDBProvider } from "./providers/thesportsdb";
import { ApiFootballProvider } from "./providers/api-football";
import { MLBStatsProvider } from "./providers/mlb-stats";
import { ESPNProvider } from "./providers/espn";
import { BallDontLieProvider } from "./providers/balldontlie";
import { TheRacingAPIProvider } from "./providers/theracing-api";
import { ManualProvider } from "./providers/manual";
import { FoireannProvider } from "./providers/foireann";

/** Singleton provider instances */
const providers = {
  openf1: new OpenF1Provider(),
  apiFootball: new ApiFootballProvider(),
  theSportsDB: new TheSportsDBProvider(),
  ballDontLie: new BallDontLieProvider(),
  mlbStats: new MLBStatsProvider(),
  espn: new ESPNProvider(),
  theRacingAPI: new TheRacingAPIProvider(),
  foireann: new FoireannProvider(),
  manual: new ManualProvider(),
} as const;

/**
 * Priority-ordered provider list per sport.
 * First provider to return a non-null result wins.
 * If all fail, the system falls back to manual entry.
 */
/**
 * Priority-ordered provider chains per sport.
 *
 * Design:
 * - Sport-specific APIs first (best data quality)
 * - TheSportsDB second (free, broad coverage)
 * - ESPN third (free, unofficial — broad fallback)
 * - BallDontLie last for US sports (free NBA, paid others)
 * - Manual is always the implicit final fallback via getProvidersForSport()
 *
 * To add a new sport:
 * 1. Add to the Sport type in types.ts
 * 2. Add a provider chain here
 * 3. Either use existing providers or create a new one extending BaseProvider
 */
const sportProviders: Record<Sport, SportsProvider[]> = {
  formula_1: [providers.openf1],
  soccer: [providers.apiFootball, providers.theSportsDB, providers.espn, providers.ballDontLie],
  golf: [providers.theSportsDB, providers.espn],
  rugby: [providers.theSportsDB, providers.espn],
  tennis: [providers.theSportsDB, providers.espn],
  gaa: [providers.foireann, providers.manual],
  horse_racing: [providers.theRacingAPI],
  snooker: [providers.espn, providers.manual],
  mlb: [providers.mlbStats, providers.espn, providers.ballDontLie],
  nfl: [providers.espn, providers.ballDontLie],
  nba: [providers.ballDontLie, providers.espn],
  nhl: [providers.espn, providers.ballDontLie],
};

export function getProvidersForSport(sport: Sport): SportsProvider[] {
  return sportProviders[sport] ?? [providers.manual];
}

/** Get all registered provider instances */
export function getAllProviders(): SportsProvider[] {
  return Object.values(providers);
}
