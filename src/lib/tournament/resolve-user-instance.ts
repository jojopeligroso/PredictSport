import type { SupabaseClient } from "@supabase/supabase-js";

const WC2026_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000026";

/**
 * Resolve the WC competition instance for a given user.
 * - Authenticated user: returns the instance they're a member of
 * - Anonymous/non-member: returns the first public instance (for preview)
 */
export async function resolveUserWcInstance(
  supabase: SupabaseClient,
  userId: string | null
): Promise<{ id: string; name: string; status: string; instance_number: number } | null> {
  if (userId) {
    // Find the instance the user is a member of
    const { data } = await supabase
      .from("competition_members")
      .select("competition_id, competitions!inner(id, name, status, instance_number)")
      .eq("user_id", userId)
      .eq("competitions.tournament_id", WC2026_TOURNAMENT_ID)
      .limit(1)
      .maybeSingle();

    if (data?.competitions) {
      const c = data.competitions as unknown as { id: string; name: string; status: string; instance_number: number };
      return c;
    }
  }

  // Fallback: first public instance (for anonymous/preview)
  const { data } = await supabase
    .from("competitions")
    .select("id, name, status, instance_number")
    .eq("tournament_id", WC2026_TOURNAMENT_ID)
    .eq("visibility", "public")
    .order("instance_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}
