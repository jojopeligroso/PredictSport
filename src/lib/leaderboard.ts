/**
 * Shared standings / rank computation.
 *
 * The rank a participant holds in a competition is NOT stored — it is
 * computed live from `predictions`. This module is the single source of
 * truth for that computation: both `/leaderboard` (the authoritative live
 * recompute) and the `competition_standings` cache call `computeStandings`.
 *
 * See `docs/DESIGN-F1-ALL-COMPETITIONS-DASHBOARD.md` §3.6 and
 * `docs/adr/0010-cached-non-authoritative-standings.md`.
 *
 * INTERFACE FROZEN — see commit "freeze data-layer interface". Session B
 * builds the dashboard UI against the types exported here.
 */

/**
 * One participant's standing in a single competition.
 *
 * Note: the live `/leaderboard` ranks on a *percentage* model with round
 * qualification and tiebreaker distance. `total_points` here is the raw
 * points sum; `rank` and `qualified` already reflect the percentage/round
 * model. Percentage and tiebreaker distance are leaderboard *display*
 * concerns and are intentionally NOT part of this cache-facing shape
 * (design doc §3.6 — "prefer leaving display concerns in the page").
 */
export interface Standing {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  /** Competition rank. 0 means unqualified (displayed as "—"). */
  rank: number;
  total_points: number;
  /** Predictions called correctly (resolved + is_correct === true). */
  correct_count: number;
  /** Predictions with a result in (is_correct !== null). */
  resolved_count: number;
  /** Whether the user met the round-participation threshold to be ranked. */
  qualified: boolean;
}

/**
 * Aggregate hit rate across ALL of a user's competitions — group AND
 * personal combined (design doc §3.7 / F3). Not competition-scoped.
 */
export interface GlobalHitRate {
  correct: number;
  resolved: number;
  /** correct / resolved, or null when resolved === 0. */
  hit_rate: number | null;
}

/**
 * Compute the ranked standings for a single competition.
 *
 * Authoritative live computation: loads every prediction in the
 * competition, applies the percentage/round-qualification scoring model,
 * sorts, and assigns ranks. Used by `/leaderboard` and by the standings
 * cache recompute.
 */
export async function computeStandings(
  competitionId: string,
): Promise<Standing[]> {
  void competitionId;
  throw new Error("not impl");
}

/**
 * Compute a user's global hit rate across every competition they belong
 * to (group + personal), counting only resolved predictions (F3, §3.7).
 */
export async function computeGlobalHitRate(
  userId: string,
): Promise<GlobalHitRate> {
  void userId;
  throw new Error("not impl");
}
