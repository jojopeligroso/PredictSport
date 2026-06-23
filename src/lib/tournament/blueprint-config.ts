import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-blueprint entrant configuration, read from sporting_tournaments.config.
 *
 * The entrant cap is a property of the tournament BLUEPRINT, chosen at creation
 * and customised per blueprint (WC = 48, a league season = unlimited, etc.).
 * Competition instances inherit it. `max_entrants_per_instance` is required on
 * every blueprint (enforced by a CHECK constraint); a value of null means the
 * blueprint deliberately chose "unlimited".
 */
export interface BlueprintEntrantConfig {
  /** Hard cap on entrants per competition instance. null = unlimited (explicit choice). */
  maxEntrantsPerInstance: number | null;
  /** Minimum entrants for an instance to proceed. null = no minimum. */
  minEntrants: number | null;
  /** True when the blueprint explicitly set max_entrants_per_instance (even to null). */
  chosen: boolean;
}

export function readBlueprintEntrantConfig(config: unknown): BlueprintEntrantConfig {
  const c = (config ?? {}) as Record<string, unknown>;
  const rawMax = c.max_entrants_per_instance;
  const rawMin = c.min_entrants;
  return {
    maxEntrantsPerInstance:
      typeof rawMax === "number" && rawMax > 0 ? rawMax : null,
    minEntrants: typeof rawMin === "number" && rawMin > 0 ? rawMin : null,
    chosen: Object.prototype.hasOwnProperty.call(c, "max_entrants_per_instance"),
  };
}

export async function fetchBlueprintEntrantConfig(
  svc: SupabaseClient,
  tournamentId: string,
): Promise<BlueprintEntrantConfig> {
  const { data } = await svc
    .from("sporting_tournaments")
    .select("config")
    .eq("id", tournamentId)
    .single();

  const result = readBlueprintEntrantConfig(data?.config);
  if (!result.chosen) {
    // Should be unreachable — the DB CHECK requires the key — but surface loudly
    // if a blueprint somehow slipped through, rather than silently capping.
    console.warn(
      `[blueprint-config] sporting_tournaments ${tournamentId} has no ` +
        `max_entrants_per_instance — instances will be uncapped.`,
    );
  }
  return result;
}
