import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorldCupCompetition } from "./create-world-cup-competition";

const WC2026_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000026";

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

  // 3. All full — provision new instance
  const nextNumber = ((instances ?? []).length) + 1;

  const result = await createWorldCupCompetition(supabase, userId, {
    name: `World Cup 2026 #${nextNumber}`,
    visibility: "public",
    entrantCount: 48, // Will be recalculated by curve logic when entrants known
    maxEntrants: 48,
    minEntrants: 8,
    skipRounds: true, // Share rounds from instance 1 via tournament_id RLS
  });

  // 4. Set instance metadata — entry_closes_at must be null so overflow
  //    instances stay open indefinitely (instance #1's cutoff does not apply)
  await supabase
    .from("competitions")
    .update({
      instance_number: nextNumber,
      instance_type: instanceType,
      status: "active", // Immediately joinable
      entry_closes_at: null,
    })
    .eq("id", result.competition.id);

  return result.competition.id;
}
