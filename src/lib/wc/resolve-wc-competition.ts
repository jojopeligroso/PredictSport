import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { Competition } from "@/types/database";

/**
 * Resolve the WC competition instance for the current user.
 *
 * Membership-first: if the user is authenticated and belongs to a WC
 * competition instance, returns THAT instance. This prevents users in
 * instance #2 from seeing instance #1's data.
 *
 * Anonymous / non-member fallback: returns the first instance by
 * created_at for preview / join flows.
 *
 * This is the ONLY function /wc pages should use to find the competition.
 */
export async function resolveWcCompetition(opts?: {
  statuses?: string[];
}): Promise<{
  competition: Competition | null;
  user: User | null;
  isMember: boolean;
}> {
  const statuses = opts?.statuses ?? ["active", "draft", "completed"];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Membership-first: find the competition this user belongs to
    const { data: membership } = await supabase
      .from("competition_members")
      .select("competition_id, competitions!inner(id)")
      .eq("user_id", user.id)
      .eq("competitions.product_mode", "world_cup_2026_shell")
      .in("competitions.status", statuses)
      .limit(1)
      .maybeSingle();

    if (membership) {
      const { data: competition } = await supabase
        .from("competitions")
        .select("*")
        .eq("id", membership.competition_id)
        .single();

      return {
        competition: competition as Competition | null,
        user,
        isMember: true,
      };
    }
  }

  // Fallback: first instance (for anonymous users or non-members)
  const { data: competition } = await supabase
    .from("competitions")
    .select("*")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", statuses)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    competition: competition as Competition | null,
    user: user ?? null,
    isMember: false,
  };
}
