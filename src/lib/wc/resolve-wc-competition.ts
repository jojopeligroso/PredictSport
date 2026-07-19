import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isWorldCupArchive } from "@/lib/product-mode";
import { resolveWcArchive } from "@/lib/wc/resolve-wc-archive";
import type { User } from "@supabase/supabase-js";
import type { Competition } from "@/types/database";

type ResolveResult = {
  competition: Competition | null;
  user: User | null;
  isMember: boolean;
};

/**
 * Internal cached resolver keyed by a stable string so React `cache()`
 * deduplicates correctly (object/array args use referential equality,
 * which would defeat caching since each caller creates a new object).
 */
const resolveWcCompetitionCached = cache(
  async (statusesKey: string): Promise<ResolveResult> => {
    const statuses = statusesKey.split(",");
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
          .select("id, name, description, type, visibility, status, scoring_rules, lock_default_minutes, allow_nominations, min_rounds_required, allow_prediction_updates, created_by, invite_code, tournament_id, product_mode, entry_closes_at, entry_close_trigger, hidden_at, max_entrants, min_entrants, chat_enabled, instance_type, instance_number, created_at")
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
      .select("id, name, description, type, visibility, status, scoring_rules, lock_default_minutes, allow_nominations, min_rounds_required, allow_prediction_updates, created_by, invite_code, tournament_id, product_mode, entry_closes_at, entry_close_trigger, hidden_at, max_entrants, min_entrants, chat_enabled, instance_type, instance_number, created_at")
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
);

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
 *
 * Wrapped with React `cache()` for per-request deduplication on the server.
 * Multiple server components calling this in the same request share a
 * single set of DB queries instead of each creating their own.
 */
export async function resolveWcCompetition(opts?: {
  statuses?: string[];
}): Promise<ResolveResult> {
  // Archive/display mode: use hardcoded instance #2 + synthetic viewer
  if (isWorldCupArchive()) {
    return resolveWcArchive();
  }

  const statuses = opts?.statuses ?? ["active", "draft", "completed"];
  const key = statuses.slice().sort().join(",");
  return resolveWcCompetitionCached(key);
}
