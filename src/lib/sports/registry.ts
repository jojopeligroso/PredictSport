import type { Sport, SportsProvider } from "./types";
import { OpenF1Provider } from "./providers/openf1";
import { TheSportsDBProvider } from "./providers/thesportsdb";
import { ApiFootballProvider } from "./providers/api-football";
import { MLBStatsProvider } from "./providers/mlb-stats";
import { MLBStatsWinterProvider } from "./providers/mlb-stats-winter";
import { ESPNProvider } from "./providers/espn";
import { BallDontLieProvider } from "./providers/balldontlie";
import { TheRacingAPIProvider } from "./providers/theracing-api";
import { ManualProvider } from "./providers/manual";
import { FoireannProvider } from "./providers/foireann";
import { FixturePoolProvider } from "./providers/fixture-pool";
import { LIDOMProvider } from "./providers/winter/lidom";
import { LMPProvider } from "./providers/winter/lmp";
import { LVBPProvider } from "./providers/winter/lvbp";
import { LBPRCProvider } from "./providers/winter/lbprc";

/** Singleton provider instances */
const providers = {
  openf1: new OpenF1Provider(),
  apiFootball: new ApiFootballProvider(),
  theSportsDB: new TheSportsDBProvider(),
  ballDontLie: new BallDontLieProvider(),
  mlbStats: new MLBStatsProvider(),
  mlbStatsWinter: new MLBStatsWinterProvider(),
  espn: new ESPNProvider(),
  theRacingAPI: new TheRacingAPIProvider(),
  foireann: new FoireannProvider(),
  manual: new ManualProvider(),
  fixturePool: new FixturePoolProvider(),
  // Winter league official APIs (skeletons — return null until implemented)
  lidomApi: new LIDOMProvider(),
  lmpApi: new LMPProvider(),
  lvbpApi: new LVBPProvider(),
  lbprcApi: new LBPRCProvider(),
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
  baseball: [providers.fixturePool, providers.mlbStats, providers.espn, providers.ballDontLie, providers.manual],
  american_football: [providers.fixturePool, providers.espn, providers.ballDontLie],
  basketball: [providers.fixturePool, providers.ballDontLie, providers.espn],
  ice_hockey: [providers.fixturePool, providers.espn, providers.ballDontLie],
};

/**
 * League-specific provider chains, keyed by providerLeague prefix.
 *
 * When an event has a providerLeague matching one of these keys, this chain
 * is used instead of the generic sport-level chain. League-specific official
 * APIs sit before mlb-stats-winter — when they return null (not yet
 * implemented), the chain falls through to the working MLB Stats source.
 *
 * For Caribbean Series, ESPN is included as a working cross-check source.
 */
const leagueProviders: Record<string, SportsProvider[]> = {
  "winter/lidom":     [providers.fixturePool, providers.lidomApi, providers.mlbStatsWinter, providers.manual],
  "winter/lmp":       [providers.fixturePool, providers.lmpApi, providers.mlbStatsWinter, providers.manual],
  "winter/lvbp":      [providers.fixturePool, providers.lvbpApi, providers.mlbStatsWinter, providers.manual],
  "winter/lbprc":     [providers.fixturePool, providers.lbprcApi, providers.mlbStatsWinter, providers.manual],
  "winter/caribbean": [providers.fixturePool, providers.mlbStatsWinter, providers.espn, providers.manual],
};

/**
 * Get the provider chain for a sport, optionally narrowed by providerLeague.
 *
 * If providerLeague matches a league-specific chain, that chain is returned.
 * Otherwise falls back to the sport-level chain.
 */
export function getProvidersForSport(sport: Sport, providerLeague?: string): SportsProvider[] {
  if (providerLeague && leagueProviders[providerLeague]) {
    return leagueProviders[providerLeague];
  }
  return sportProviders[sport] ?? [providers.manual];
}

/** Get all registered provider instances */
export function getAllProviders(): SportsProvider[] {
  return Object.values(providers);
}
