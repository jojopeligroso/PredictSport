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
 * Priority-ordered provider chains per sport.
 *
 * Design:
 * - Sport-specific APIs first (best data quality for results)
 * - ESPN second (reliable scoreboard search + broad coverage)
 * - TheSportsDB third (round-based fixture browsing, backup results)
 * - BallDontLie last for US sports (free NBA, paid others)
 * - Manual is always the implicit final fallback
 */
const sportProviders: Record<Sport, SportsProvider[]> = {
  formula_1: [providers.openf1],
  soccer: [providers.apiFootball, providers.espn, providers.theSportsDB, providers.ballDontLie],
  golf: [providers.espn, providers.theSportsDB],
  rugby: [providers.espn, providers.theSportsDB],
  tennis: [providers.espn, providers.theSportsDB],
  gaa: [providers.foireann, providers.manual],
  horse_racing: [providers.theRacingAPI],
  cricket: [providers.espn, providers.theSportsDB, providers.manual],
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
