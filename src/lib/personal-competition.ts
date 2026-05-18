import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Looks up the user's personal competition, creating one if it doesn't exist.
 * Used by all personal prediction API routes.
 *
 * The bootstrap migration (A1) creates a personal competition for every
 * existing user, and `handle_new_user()` creates one for new signups.
 * This function is the safety net for any edge case where neither ran
 * (e.g. a user created between migration deploy and trigger update).
 */
export async function getOrCreatePersonalCompetition(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // Fast path: look up existing personal competition
  const { data: existing, error: lookupError } = await supabase
    .from("competitions")
    .select("id")
    .eq("created_by", userId)
    .eq("type", "personal")
    .single();

  if (existing) return existing.id;

  // Not found — could be PGRST116 (no rows) or a real error
  if (lookupError && lookupError.code !== "PGRST116") {
    throw new Error(`Failed to look up personal competition: ${lookupError.message}`);
  }

  // Create the personal competition + membership in a single rpc call
  // to avoid partial creation if the second insert fails.
  const { data: newComp, error: createError } = await supabase
    .from("competitions")
    .insert({
      name: "Personal",
      type: "personal",
      visibility: "private",
      status: "active",
      scoring_rules: {},
      allow_nominations: false,
      created_by: userId,
    })
    .select("id")
    .single();

  if (createError) {
    // Race condition: another request created it between our SELECT and INSERT.
    // The unique partial index (idx_one_personal_per_user) will reject the dupe.
    if (createError.code === "23505") {
      const { data: raced, error: raceError } = await supabase
        .from("competitions")
        .select("id")
        .eq("created_by", userId)
        .eq("type", "personal")
        .single();

      if (raced) return raced.id;
      throw new Error(`Failed to resolve race condition: ${raceError?.message}`);
    }
    throw new Error(`Failed to create personal competition: ${createError.message}`);
  }

  // Add user as admin member
  const { error: memberError } = await supabase
    .from("competition_members")
    .insert({
      competition_id: newComp.id,
      user_id: userId,
      role: "admin",
    });

  if (memberError) {
    // Non-fatal for the caller — the competition exists.
    // Membership will be created on next call if it failed due to a transient issue.
    console.error(`Failed to create competition membership: ${memberError.message}`);
  }

  return newComp.id;
}
