import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorldCupCompetition } from "./create-world-cup-competition";
import { fetchBlueprintEntrantConfig } from "./blueprint-config";

// Joins close when the knockouts begin: earliest R32 kickoff (match 73).
// Kept in sync with migration 20260622100000_wc_entry_closes_at_r32_start.sql.
const WC2026_ENTRY_CLOSES_AT = "2026-06-28T20:00:00Z";

/**
 * Find an existing instance with capacity, or provision a new one.
 * Called from /api/join when the target instance is full.
 */
export async function findOrProvisionInstance(
  supabase: SupabaseClient,
  tournamentId: string,
  instanceType: "full" | "knockout_only",
  userId: string
): Promise<string> {
  // 1. Find all active instances of this blueprint with capacity
  const { data: instances } = await supabase
    .from("competitions")
    .select("id, max_entrants, instance_number")
    .eq("tournament_id", tournamentId)
    .eq("instance_type", instanceType)
    .in("status", ["active", "draft"])
    .order("instance_number", { ascending: true });

  // 2. Check each for capacity
  for (const inst of instances ?? []) {
    if (!inst.max_entrants) return inst.id; // No cap = always room

    const { count } = await supabase
      .from("competition_members")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", inst.id);

    if ((count ?? 0) < inst.max_entrants) return inst.id;
  }

  // 3. All full — provision new instance. The entrant cap is a property of the
  //    blueprint, inherited by every instance (not hardcoded here).
  const nextNumber = ((instances ?? []).length) + 1;
  const blueprint = await fetchBlueprintEntrantConfig(supabase, tournamentId);

  const result = await createWorldCupCompetition(supabase, userId, {
    name: `World Cup 2026 #${nextNumber}`,
    visibility: "public",
    // Curve seed — recalculated from actual entrants at draw time.
    entrantCount: blueprint.maxEntrantsPerInstance ?? 48,
    maxEntrants: blueprint.maxEntrantsPerInstance ?? undefined,
    minEntrants: blueprint.minEntrants ?? undefined,
    skipRounds: true, // Share rounds from instance 1 via tournament_id RLS
  });

  // 4. Set instance metadata — overflow instances share the same R32-start
  //    cutoff as instance #1, so the join window closes uniformly across
  //    instances when the knockouts begin.
  await supabase
    .from("competitions")
    .update({
      instance_number: nextNumber,
      instance_type: instanceType,
      status: "active", // Immediately joinable
      entry_closes_at: WC2026_ENTRY_CLOSES_AT,
    })
    .eq("id", result.competition.id);

  return result.competition.id;
}
