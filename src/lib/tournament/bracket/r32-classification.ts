/**
 * R32 Classification — automatic byproduct of the Full Bracket.
 *
 * "How many of the 32 teams you predicted to make the knockouts actually
 * made it." 1 point per correct team, max 32. Path-insensitive: it doesn't
 * matter which R32 slot the team was placed in, just whether it made the cut.
 *
 * Sources of truth (post-2026-05-23 amendment):
 *   - User's pick set: `groupRankings` (computed from per-event `predictions`
 *     rows via `groupDataToRankings`) for top 2 of each group, plus
 *     `bracket_data.bestThirdPicks` (the 8 selected third-place groups).
 *     The caller is responsible for populating `groupRankings` on the passed
 *     `BracketSubmissionData` before invoking this — it's no longer stored.
 *   - Reality: same shape, derived from confirmed group-match results once
 *     the real tournament resolves. Until then, scoring returns 0 / not
 *     scored.
 *
 * See docs/DESIGN-WC-H1-FULL-BRACKET.md "R32 Classification" section.
 */

import type { BracketSubmissionData } from "@/types/tournament";

export interface R32ClassificationScore {
  correct_count: number;
  total_teams: number;
  correct_teams: string[];
  missed_teams: string[];
  surplus_teams: string[];
  points: number;
}

/**
 * Extract the 32-team set the user's bracket implies.
 *
 * 24 from groups (winners + runners-up) + 8 from `bestThirdPicks`.
 * Order-insensitive — returned as a sorted list for stable comparison.
 */
export function extractR32Teams(data: BracketSubmissionData): string[] {
  const teams: string[] = [];
  const groupRankings = data.groupRankings ?? {};

  for (const groupId of Object.keys(groupRankings).sort()) {
    const ranking = groupRankings[groupId];
    if (ranking[0]) teams.push(ranking[0]);
    if (ranking[1]) teams.push(ranking[1]);
  }

  for (const groupId of data.bestThirdPicks) {
    const third = groupRankings[groupId]?.[2];
    if (third) teams.push(third);
  }

  return [...new Set(teams)].sort();
}

/**
 * Score a user's R32 prediction set against the actual qualified teams.
 *
 * @param userBracket - The user's submitted `BracketSubmissionData`.
 * @param actualQualifiedTeams - The 32 teams who actually advanced.
 * @param pointsPerCorrect - Points awarded per correct team (default 1).
 */
export function scoreR32Classification(
  userBracket: BracketSubmissionData,
  actualQualifiedTeams: string[],
  pointsPerCorrect: number = 1,
): R32ClassificationScore {
  const userTeams = new Set(extractR32Teams(userBracket));
  const actualTeams = new Set(actualQualifiedTeams);

  const correct: string[] = [];
  const missed: string[] = [];
  const surplus: string[] = [];

  for (const team of actualTeams) {
    if (userTeams.has(team)) correct.push(team);
    else missed.push(team);
  }
  for (const team of userTeams) {
    if (!actualTeams.has(team)) surplus.push(team);
  }

  correct.sort();
  missed.sort();
  surplus.sort();

  return {
    correct_count: correct.length,
    total_teams: actualTeams.size,
    correct_teams: correct,
    missed_teams: missed,
    surplus_teams: surplus,
    points: correct.length * pointsPerCorrect,
  };
}
