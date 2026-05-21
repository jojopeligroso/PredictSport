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
import { FixturePoolProvider } from "./providers/fixture-pool";

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
  fixturePool: new FixturePoolProvider(),
} as const;

/**
 * Priority-ordered provider chains per sport.
 *
 * Design:
 * - fixturePool first: handpicked events from sporting_events table always surface
 * - Sport-specific APIs second (best data quality for results)
 * - ESPN third (reliable scoreboard search + broad coverage)
 * - TheSportsDB fourth (round-based fixture browsing, backup results)
 * - BallDontLie last for US sports (free NBA, paid others)
 * - Manual is always the implicit final fallback
 */
const sportProviders: Record<Sport, SportsProvider[]> = {
  formula_1: [providers.fixturePool, providers.openf1],
  soccer: [providers.fixturePool, providers.apiFootball, providers.espn, providers.theSportsDB, providers.ballDontLie],
  golf: [providers.fixturePool, providers.espn, providers.theSportsDB],
  rugby: [providers.fixturePool, providers.espn, providers.theSportsDB],
  rugby_league: [providers.fixturePool, providers.espn, providers.theSportsDB, providers.manual],
  tennis: [providers.fixturePool, providers.espn, providers.theSportsDB],
  gaa: [providers.fixturePool, providers.foireann, providers.manual],
  gaelic_football: [providers.fixturePool, providers.foireann, providers.manual],
  hurling: [providers.fixturePool, providers.foireann, providers.manual],
  horse_racing: [providers.fixturePool, providers.theRacingAPI],
  cricket: [providers.fixturePool, providers.espn, providers.theSportsDB, providers.manual],
  athletics: [providers.fixturePool, providers.theSportsDB, providers.manual],
  snooker: [providers.fixturePool, providers.espn, providers.manual],
  baseball: [providers.fixturePool, providers.espn, providers.ballDontLie],
  american_football: [providers.fixturePool, providers.espn, providers.ballDontLie],
  basketball: [providers.fixturePool, providers.ballDontLie, providers.espn],
  ice_hockey: [providers.fixturePool, providers.espn, providers.ballDontLie],
};

export function getProvidersForSport(sport: Sport): SportsProvider[] {
  return sportProviders[sport] ?? [providers.manual];
}

/** Get all registered provider instances */
export function getAllProviders(): SportsProvider[] {
  return Object.values(providers);
}
