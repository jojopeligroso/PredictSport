/**
 * Best-effort cache over per-competition standings.
 *
 * `competition_standings` is NOT a source of truth — `/leaderboard` stays
 * the authoritative live recompute. This module is the read-through cache
 * the All-Competitions Dashboard reads for speed; a missing or stale row
 * triggers a live recompute (via `computeStandings`) that is written back.
 *
 * See `docs/DESIGN-F1-ALL-COMPETITIONS-DASHBOARD.md` §3.2–3.5 and
 * `docs/adr/0010-cached-non-authoritative-standings.md`.
 *
 * INTERFACE FROZEN — see commit "freeze data-layer interface". Session B
 * builds the dashboard UI against the types exported here.
 */

/**
 * The current user's standing in one group competition, as surfaced on
 * the All-Competitions Dashboard ("3rd of 11 in Office Cup").
 */
export interface CachedCompetitionStanding {
  competition_id: string;
  competition_name: string;
  /** The user's rank. 0 means unqualified (displayed as "—"). */
  user_rank: number;
  user_points: number;
  /** Total members in the competition — for the "X of {member_count}" line. */
  member_count: number;
  user_correct: number;
  user_resolved: number;
  /** ISO timestamp the cache row was last computed. */
  computed_at: string;
}

/**
 * Read-through: return the user's standing in every GROUP competition
 * they belong to. For each competition, checks cache freshness (design
 * doc §3.4) and recomputes + upserts any row that is missing or stale
 * before reading. The first viewer after a result lands pays the cost.
 */
export async function getCachedStandings(
  userId: string,
): Promise<CachedCompetitionStanding[]> {
  void userId;
  throw new Error("not impl");
}

/**
 * Recompute one competition's standings and upsert every row into
 * `competition_standings` with `computed_at = now()`. Called by the lazy
 * read-through and by the dormant recompute cron — one implementation,
 * no dead code (design doc §3.5).
 */
export async function recomputeStandings(
  competitionId: string,
): Promise<void> {
  void competitionId;
  throw new Error("not impl");
}
