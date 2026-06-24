import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrProvisionInstance } from "./auto-provision";

/**
 * Message raised by the `enforce_competition_entrant_cap` DB trigger when an
 * insert would push an instance past its max_entrants. Kept in sync with
 * migration 20260622200000_enforce_entrant_cap.sql.
 */
export const COMPETITION_FULL_SENTINEL = "COMPETITION_FULL";

export class CompetitionFullError extends Error {
  constructor() {
    super(COMPETITION_FULL_SENTINEL);
    this.name = "CompetitionFullError";
  }
}

export interface CapAwareJoinResult {
  competitionId: string;
  alreadyMember: boolean;
}

/**
 * Insert a competition_members row while honoring the DB-level entrant cap.
 *
 * The cap trigger atomically rejects any insert that would exceed max_entrants
 * (race-proof — it serializes per competition). When that happens on a
 * tournament competition, this provisions/finds the next instance and retries,
 * so overflow entrants are always routed onward instead of failing. Returns the
 * competition id the user actually joined.
 *
 * Must be called with a service-role client: both the cap count and instance
 * provisioning need member counts that RLS hides from a non-member.
 */
export async function joinCompetitionWithCap(
  svc: SupabaseClient,
  competitionId: string,
  userId: string,
  opts: {
    tournamentId: string | null;
    instanceType: "full" | "knockout_only";
    role?: string;
  },
): Promise<CapAwareJoinResult> {
  const role = opts.role ?? "participant";

  // Bounded retries: each cap rejection routes to the next instance.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await svc
      .from("competition_members")
      .insert({ competition_id: competitionId, user_id: userId, role });

    if (!error) return { competitionId, alreadyMember: false };

    // Already a member (unique violation) — idempotent success.
    if (error.code === "23505") return { competitionId, alreadyMember: true };

    // Cap trigger rejected the insert — this instance is full.
    if (error.message?.includes(COMPETITION_FULL_SENTINEL)) {
      if (!opts.tournamentId) throw new CompetitionFullError();
      competitionId = await findOrProvisionInstance(
        svc,
        opts.tournamentId,
        opts.instanceType,
        userId,
      );
      continue;
    }

    throw new Error(error.message || "Failed to join competition");
  }

  throw new CompetitionFullError();
}
