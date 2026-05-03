import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verify that the current user is an admin or co_admin of the given competition.
 * Returns the membership row if authorized, null otherwise.
 */
export async function verifyCompetitionAdmin(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string
) {
  const { data: member } = await supabase
    .from("competition_members")
    .select("id, role")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .in("role", ["admin", "co_admin"])
    .single();

  return member;
}
