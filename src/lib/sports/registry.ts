import type { Sport, SportsProvider } from "./types";
import { OpenF1Provider } from "./providers/openf1";
import { TheSportsDBProvider } from "./providers/thesportsdb";
import { ApiFootballProvider } from "./providers/api-football";
import { MLBStatsProvider } from "./providers/mlb-stats";
import { ESPNProvider } from "./providers/espn";
import { BallDontLieProvider } from "./providers/balldontlie";
import { TheRacingAPIProvider } from "./providers/theracing-api";
import { ManualProvider } from "./providers/manual";

/** Singleton provider instances */
const providers = {
  openf1: new OpenF1Provider(),
  apiFootball: new ApiFootballProvider(),
  theSportsDB: new TheSportsDBProvider(),
  ballDontLie: new BallDontLieProvider(),
  mlbStats: new MLBStatsProvider(),
  espn: new ESPNProvider(),
  theRacingAPI: new TheRacingAPIProvider(),
  manual: new ManualProvider(),
} as const;

/**
 * Priority-ordered provider list per sport.
 * First provider to return a non-null result wins.
 * If all fail, the system falls back to manual entry.
 */
const sportProviders: Record<Sport, SportsProvider[]> = {
  formula_1: [providers.openf1],
  soccer: [providers.apiFootball, providers.theSportsDB, providers.ballDontLie],
  golf: [providers.theSportsDB],
  rugby: [providers.theSportsDB],
  tennis: [providers.theSportsDB],
  gaa: [providers.manual],
  horse_racing: [providers.theRacingAPI],
  snooker: [providers.manual],
  mlb: [providers.mlbStats, providers.ballDontLie],
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
