import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/service";
import type { Competition } from "@/types/database";

type ResolveResult = {
  competition: Competition | null;
  user: null;
  isMember: false;
};

/**
 * Archive-mode resolver. Returns instance #1 competition using the service
 * client (no auth session exists on the display site). Hardcoded to
 * WC_ARCHIVE_COMPETITION_ID env var.
 */
export const resolveWcArchive = cache(async (): Promise<ResolveResult> => {
  const competitionId = process.env.WC_ARCHIVE_COMPETITION_ID;
  if (!competitionId) {
    return { competition: null, user: null, isMember: false };
  }

  const supabase = createServiceClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select(
      "id, name, description, type, visibility, status, scoring_rules, lock_default_minutes, allow_nominations, min_rounds_required, allow_prediction_updates, created_by, invite_code, tournament_id, product_mode, entry_closes_at, entry_close_trigger, hidden_at, max_entrants, min_entrants, chat_enabled, instance_type, instance_number, created_at",
    )
    .eq("id", competitionId)
    .single();

  return {
    competition: competition as Competition | null,
    user: null,
    isMember: false,
  };
});
