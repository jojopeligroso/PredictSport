/**
 * Shared fixtures helper for multi-instance tournaments.
 *
 * Events and rounds are created by instance #1 with competition_id = instance1.id.
 * All instances share them via tournament_id. This helper returns the correct
 * filter key/value so queries find events/rounds regardless of which instance
 * the user belongs to.
 */

/**
 * Returns the filter to use when querying events or rounds.
 * For tournament competitions: filter by tournament_id (shared fixtures).
 * For non-tournament competitions: filter by competition_id (owned fixtures).
 */
export function fixtureFilter(competition: {
  id: string;
  tournament_id?: string | null;
}): { key: "tournament_id" | "competition_id"; value: string } {
  if (competition.tournament_id) {
    return { key: "tournament_id", value: competition.tournament_id };
  }
  return { key: "competition_id", value: competition.id };
}

/**
 * Overload for when you only have a competitionId + optional tournamentId.
 */
export function fixtureFilterFromIds(
  competitionId: string,
  tournamentId: string | null | undefined,
): { key: "tournament_id" | "competition_id"; value: string } {
  if (tournamentId) {
    return { key: "tournament_id", value: tournamentId };
  }
  return { key: "competition_id", value: competitionId };
}
