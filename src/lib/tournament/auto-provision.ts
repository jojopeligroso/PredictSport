import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorldCupCompetition } from "./create-world-cup-competition";
import { fetchBlueprintEntrantConfig } from "./blueprint-config";

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
    .select("id, max_entrants, instance_number, entry_closes_at")
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

  // Read entry_closes_at from instance #1 so all instances share the same cutoff
  const instance1 = (instances ?? []).find((i) => i.instance_number === 1);
  const entryClosesAt = instance1?.entry_closes_at ?? null;

  const result = await createWorldCupCompetition(supabase, userId, {
    name: `World Cup 2026 #${nextNumber}`,
    visibility: "public",
    // Curve seed — recalculated from actual entrants at draw time.
    entrantCount: blueprint.maxEntrantsPerInstance ?? 48,
    maxEntrants: blueprint.maxEntrantsPerInstance ?? undefined,
    minEntrants: blueprint.minEntrants ?? undefined,
    skipRounds: true, // Share rounds from instance 1 via tournament_id RLS
    creatorRole: "participant", // Joining user is NOT an admin of the new instance
  });

  // 4. Set instance metadata — overflow instances share the same cutoff
  //    as instance #1, so the join window closes uniformly.
  const { error: updateError } = await supabase
    .from("competitions")
    .update({
      instance_number: nextNumber,
      instance_type: instanceType,
      status: "active", // Immediately joinable
      ...(entryClosesAt ? { entry_closes_at: entryClosesAt } : {}),
    })
    .eq("id", result.competition.id);

  if (updateError) {
    console.error(
      `[auto-provision] Failed to set instance metadata on ${result.competition.id}:`,
      updateError.message,
    );
  }

  return result.competition.id;
}
