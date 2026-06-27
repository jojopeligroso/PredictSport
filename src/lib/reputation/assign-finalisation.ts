/**
 * Finalisation tag assignment — computes tags at elimination boundaries.
 *
 * Called after group-stage elimination runs. Uses the standings data
 * from the elimination result to identify tag recipients.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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

  // Publish all computed finalisation tags
  if (assignments.length > 0) {
    await publishFinalisationTags(competitionId, stageId, assignments);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
