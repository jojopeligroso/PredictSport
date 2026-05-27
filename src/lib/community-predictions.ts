import type { SupabaseClient } from "@supabase/supabase-js";

interface CommunityPick {
  count: number;
  users: Array<{ user_id: string; display_name: string }>;
}

/**
 * Fetch community prediction aggregates for an event.
 * RLS on the predictions table handles visibility (own picks always visible,
 * others visible based on pick_reveal_at / lock_time / result_confirmed).
 */
export async function getCommunityPredictions(
  supabase: SupabaseClient,
  eventId: string
): Promise<Record<string, CommunityPick>> {
  const { data: predictions } = await supabase
    .from("predictions")
    .select("prediction_data, user_id, users(display_name)")
    .eq("event_id", eventId);

  if (!predictions || predictions.length === 0) return {};

  const groups: Record<string, CommunityPick> = {};

  for (const p of predictions) {
    const data = p.prediction_data as Record<string, unknown>;
    // Extract the pick value — could be 'value', 'selection', or 'winner'
    const pickValue = String(
      data?.value ?? data?.selection ?? data?.winner ?? "unknown"
    );

    if (!groups[pickValue]) {
      groups[pickValue] = { count: 0, users: [] };
    }
    groups[pickValue].count++;

    const userObj = p.users as unknown as { display_name: string } | null;
    groups[pickValue].users.push({
      user_id: p.user_id,
      display_name: userObj?.display_name || "Unknown",
    });
  }

  return groups;
}
