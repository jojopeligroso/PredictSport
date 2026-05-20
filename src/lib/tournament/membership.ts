import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipStatus } from "@/types/tournament";

// ============================================================
// Multi-classification status check for a user in a competition
// ============================================================

export async function getEntrantStatus(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string
): Promise<Record<string, MembershipStatus>> {
  const { data, error } = await supabase
    .from("classification_memberships")
    .select("classification_id, status, classifications(classification_key)")
    .eq("competition_id", competitionId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch entrant status: ${error.message}`);

  const result: Record<string, MembershipStatus> = {};

  for (const row of data ?? []) {
    // Supabase returns the FK join as a single object (many-to-one) or null
    const cls = row.classifications as unknown as { classification_key: string } | null;
    const key = cls?.classification_key ?? row.classification_id;
    result[key] = row.status as MembershipStatus;
  }

  return result;
}

// ============================================================
// Eliminate an entrant from a specific classification
// ============================================================

export async function eliminateEntrant(
  supabase: SupabaseClient,
  classificationId: string,
  userId: string,
  reason: string,
  windowId?: string,
  stageId?: string
): Promise<void> {
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    status: "eliminated",
    eliminated_at: now,
    elimination_reason: reason,
    updated_at: now,
  };

  if (windowId) update.eliminated_window_id = windowId;
  if (stageId) update.eliminated_stage_id = stageId;

  const { error } = await supabase
    .from("classification_memberships")
    .update(update)
    .eq("classification_id", classificationId)
    .eq("user_id", userId)
    .eq("status", "active"); // Only eliminate currently active members

  if (error) throw new Error(`Failed to eliminate entrant: ${error.message}`);
}

// ============================================================
// Quick active check for a user in a classification
// ============================================================

export async function isEntrantActive(
  supabase: SupabaseClient,
  classificationId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("classification_memberships")
    .select("status")
    .eq("classification_id", classificationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check entrant status: ${error.message}`);
  return data?.status === "active";
}
