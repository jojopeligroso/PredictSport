import type { SupabaseClient } from "@supabase/supabase-js";
import type { BracketSubmissionData } from "@/types/tournament";

export interface BracketSnapshot {
  classificationId: string;
  classificationName: string;
  status: string;
  pct: number;
  label: string;
}

/**
 * Resolve the user's full-bracket snapshot for the active WC competition.
 *
 * Shared between /wc, /wc/picks, and /wc/picks/[windowId] so the bracket CTA
 * stays consistent across the funnel. Returns null when there is no active WC
 * competition, no active full_bracket classification, or no signed-in user
 * (caller guards on user existence before calling).
 */
export async function getWcBracketSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<BracketSnapshot | null> {
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"])
    .limit(1)
    .maybeSingle();
  if (!competition) return null;

  const { data: cls } = await supabase
    .from("classifications")
    .select("id, name, status")
    .eq("competition_id", competition.id)
    .eq("classification_key", "full_bracket")
    .eq("status", "active")
    .maybeSingle();
  if (!cls) return null;

  const { data: submission } = await supabase
    .from("bracket_prediction_submissions")
    .select("status, bracket_data")
    .eq("competition_id", competition.id)
    .eq("classification_id", cls.id)
    .eq("user_id", userId)
    .neq("status", "superseded")
    .maybeSingle();

  // Group progress lives in `predictions` (2026-05-23 unified-predictions
  // amendment), not in bracket_data. Count winner predictions on this
  // competition's WC group events so a /picks-only user still shows progress.
  const { count: groupPicksCount } = await supabase
    .from("predictions")
    .select("event_id, events!inner(competition_id, external_event_id)", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .eq("prediction_type", "winner")
    .eq("events.competition_id", competition.id)
    .like("events.external_event_id", "wc2026-grp-%");

  const data = submission?.bracket_data as BracketSubmissionData | null;
  const progress = bracketProgress(data, groupPicksCount ?? 0);

  return {
    classificationId: cls.id,
    classificationName: cls.name,
    status: submission?.status ?? "not_started",
    pct: progress.pct,
    label: progress.label,
  };
}

const KO_SLOTS = [
  "r32_m1","r32_m2","r32_m3","r32_m4","r32_m5","r32_m6","r32_m7","r32_m8",
  "r32_m9","r32_m10","r32_m11","r32_m12","r32_m13","r32_m14","r32_m15","r32_m16",
  "r16_m1","r16_m2","r16_m3","r16_m4","r16_m5","r16_m6","r16_m7","r16_m8",
  "qf_m1","qf_m2","qf_m3","qf_m4",
  "sf_m1","sf_m2",
  "final",
] as const;

export function bracketProgress(
  data: BracketSubmissionData | null,
  groupPicksCount: number,
): { pct: number; label: string } {
  if (!data && groupPicksCount === 0) return { pct: 0, label: "Not started" };
  const groupDone = Math.min(72, groupPicksCount);
  const thirdsDone = (data?.bestThirdPicks ?? []).length === 8;
  const knockoutPicks = data?.knockoutPicks ?? {};
  const koDone = KO_SLOTS.filter((s) => knockoutPicks[s]?.winner).length;
  const finalDone = Boolean(data?.champion) && Boolean(data?.thirdPlace);

  const total = 72 + 1 + KO_SLOTS.length + 1;
  const done = groupDone + (thirdsDone ? 1 : 0) + koDone + (finalDone ? 1 : 0);
  const pct = Math.min(100, Math.round((done / total) * 100));

  let label = "Groups in progress";
  if (groupDone === 72) label = "Best thirds";
  if (thirdsDone) label = "Round of 32";
  if (koDone >= 16) label = "Round of 16";
  if (koDone >= 24) label = "Quarter-finals";
  if (koDone >= 28) label = "Semi-finals";
  if (koDone >= 30) label = "Final";
  if (finalDone) label = "Ready to submit";

  return { pct, label };
}
