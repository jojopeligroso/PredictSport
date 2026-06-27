/**
 * Finalisation tag assignment — computes tags at elimination boundaries.
 *
 * Called after group-stage elimination runs. Uses the standings data
 * from the elimination result to identify tag recipients.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StandingRow } from "@/types/tournament";
import type { EliminationResult } from "@/lib/tournament/format/elimination";
import {
  publishFinalisationTags,
  type FinalisationTagAssignment,
} from "./publish";

// ---------------------------------------------------------------------------
// Compute + publish finalisation tags after group-stage elimination
// ---------------------------------------------------------------------------

/**
 * Compute and publish finalisation tags for a group-stage elimination pass.
 *
 * @param supabase - Service-role Supabase client
 * @param competitionId - Competition UUID
 * @param stageId - Sporting stage UUID
 * @param eliminationResult - The result from eliminateFromFormat()
 */
export async function computeAndPublishFinalisationTags(
  supabase: SupabaseClient,
  competitionId: string,
  stageId: string,
  eliminationResult: EliminationResult,
): Promise<void> {
  const { standings_at_elimination, eliminated_user_ids, survivor_user_ids } =
    eliminationResult;

  if (standings_at_elimination.length === 0) return;

  const eliminatedSet = new Set(eliminated_user_ids);
  const survivorSet = new Set(survivor_user_ids);
  const assignments: FinalisationTagAssignment[] = [];

  // Resolve display names for tag recipients
  const allUserIds = [
    ...new Set([...eliminated_user_ids, ...survivor_user_ids]),
  ];
  const displayNameMap = await resolveDisplayNames(supabase, allUserIds);

  // -----------------------------------------------------------------------
  // Q9: "Unluckiest 4th Place"
  // Highest-scoring eliminated player across all groups
  // -----------------------------------------------------------------------
  const eliminatedStandings = standings_at_elimination
    .filter((s) => eliminatedSet.has(s.user_id))
    .sort((a, b) => b.points - a.points);

  if (eliminatedStandings.length > 0) {
    const unluckiest = eliminatedStandings[0];
    // Find the cutoff point (lowest survivor score via best-thirds) for context.
    // The tag only fires if the eliminated player's points would have placed them
    // in a qualifying position — i.e. they had >= the lowest survivor's points.
    const survivorStandings = standings_at_elimination
      .filter((s) => survivorSet.has(s.user_id))
      .sort((a, b) => a.points - b.points);
    const lowestSurvivorPoints =
      survivorStandings.length > 0 ? survivorStandings[0].points : 0;

    // Only award if the eliminated player had enough points to qualify elsewhere
    if (unluckiest.points >= lowestSurvivorPoints && lowestSurvivorPoints > 0) {
      assignments.push({
        userId: unluckiest.user_id,
        tagName: "Unluckiest 4th Place",
        stats: {
          display_name: displayNameMap.get(unluckiest.user_id) ?? "Someone",
          stat: unluckiest.points,
          contextStat: lowestSurvivorPoints,
        },
      });
    }
  }

  // -----------------------------------------------------------------------
  // Q21: "Most Contested 3rd Place"
  // 3rd-place finisher who qualified via best-thirds by the narrowest margin —
  // smallest gap to the first non-qualifier in the best-third ranking.
  // -----------------------------------------------------------------------
  const thirdPlaceMargins = computeThirdFourthMargins(
    standings_at_elimination,
    survivorSet,
    eliminatedSet,
  );

  if (thirdPlaceMargins.length > 0) {
    // Sort by margin ascending — smallest margin = most contested
    thirdPlaceMargins.sort((a, b) => a.margin - b.margin);
    const mostContested = thirdPlaceMargins[0];

    // Compute average margin for context
    const avgMargin =
      thirdPlaceMargins.reduce((sum, m) => sum + m.margin, 0) /
      thirdPlaceMargins.length;

    assignments.push({
      userId: mostContested.thirdPlaceUserId,
      tagName: "Most Contested 3rd Place",
      stats: {
        display_name:
          displayNameMap.get(mostContested.thirdPlaceUserId) ?? "Someone",
        stat: mostContested.margin,
        suffix: mostContested.margin === 1 ? "" : "s",
        contextStat: Math.round(avgMargin * 10) / 10,
      },
    });
  }

  // Publish all computed finalisation tags
  if (assignments.length > 0) {
    await publishFinalisationTags(competitionId, stageId, assignments);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ThirdFourthMargin {
  thirdPlaceUserId: string;
  fourthPlaceUserId: string;
  margin: number;
  groupId: string;
}

/**
 * For each group, find the 3rd-place survivor and the 4th-place eliminated
 * player, and compute the points margin between them.
 *
 * Only considers groups where 3rd survived and 4th was eliminated
 * (the classic contested boundary).
 */
function computeThirdFourthMargins(
  standings: StandingRow[],
  survivorSet: Set<string>,
  eliminatedSet: Set<string>,
): ThirdFourthMargin[] {
  // Group standings by group_id (from GroupStandingRow extension)
  const byGroup = new Map<string, StandingRow[]>();
  for (const s of standings) {
    const groupId =
      (s as StandingRow & { group_id?: string }).group_id ?? "default";
    if (!byGroup.has(groupId)) byGroup.set(groupId, []);
    byGroup.get(groupId)!.push(s);
  }

  const margins: ThirdFourthMargin[] = [];

  for (const [groupId, groupStandings] of byGroup) {
    // Sort by position (rank)
    const sorted = [...groupStandings].sort((a, b) => a.rank - b.rank);

    // Find the last survivor and first eliminated in this group
    // These are the 3rd/4th at the boundary
    const survivors = sorted.filter((s) => survivorSet.has(s.user_id));
    const eliminated = sorted.filter((s) => eliminatedSet.has(s.user_id));

    if (survivors.length === 0 || eliminated.length === 0) continue;

    // Last survivor by rank = closest to the cut line (e.g. 3rd place)
    const lastSurvivor = survivors[survivors.length - 1];
    // First eliminated by rank = just below the cut line (e.g. 4th place)
    const firstEliminated = eliminated[0];

    const margin = lastSurvivor.points - firstEliminated.points;

    margins.push({
      thirdPlaceUserId: lastSurvivor.user_id,
      fourthPlaceUserId: firstEliminated.user_id,
      margin,
      groupId,
    });
  }

  return margins;
}

/**
 * Batch-resolve display names for a list of user IDs.
 */
async function resolveDisplayNames(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", userIds)
    .limit(200);

  const map = new Map<string, string>();
  for (const u of users ?? []) {
    if (u.display_name) map.set(u.id, u.display_name);
  }
  return map;
}
