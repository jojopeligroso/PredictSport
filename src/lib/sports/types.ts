/** Sport identifiers used in Event.sport */
export type Sport =
  | "formula_1"
  | "soccer"
  | "golf"
  | "rugby"
  | "tennis"
  | "gaa"
  | "gaelic_football"
  | "hurling"
  | "horse_racing"
  | "snooker"
  | "cricket"
  | "athletics"
  | "mlb"
  | "nfl"
  | "nba"
  | "nhl";

/** Ordered finishing position (for winner/top_n predictions) */
export interface ResultPosition {
  position: number;
  name: string;
  team: string | null;
}

/** Score for team sports (for winner/margin/over_under/handicap predictions) */
export interface ResultScore {
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  periods: Record<string, { home: number; away: number }> | null;
}

/**
 * Normalized result returned by every provider.
 * Fields are broad enough to support all 6 prediction types:
 * - positions: winner, top_n
 * - score: winner, margin, over_under, handicap
 * - winner: head_to_head
 * - margin: margin
 * - stats: over_under (e.g. total_goals)
 */
export interface NormalizedResult {
  provider: string;
  fetched_at: string;
  sport: Sport;
  external_event_id: string;
  event_name: string;
  is_final: boolean;
  positions: ResultPosition[] | null;
  score: ResultScore | null;
  winner: string | null;
  margin: number | null;
  stats: Record<string, number> | null;
  /** Raw API response for debugging/auditing */
  raw: unknown;
}

/** Searchable event for admin UI event linking */
export interface SearchableEvent {
  external_event_id: string;
  event_name: string;
  sport: Sport;
  start_time: string;
  competition_name: string;
  participants: string[];
  provider: string;
}

/** Provider rate limit configuration */
export interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

/** Configuration for a provider instance */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl: string;
  rateLimit: RateLimitConfig;
}

/** The interface every provider must implement */
export interface SportsProvider {
  readonly name: string;
  readonly supportedSports: readonly Sport[];

  getResult(
    sport: Sport,
    externalEventId: string
  ): Promise<NormalizedResult | null>;

  searchEvents(
    sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]>;
}
