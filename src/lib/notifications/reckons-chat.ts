import { createServiceClient } from "@/lib/supabase/service";
import {
  generateReckonsCopy,
  formatScoreForCopy,
} from "@/lib/reckons-copy";

/**
 * Post (or update) a "reckons" system message in competition chat when a
 * prediction with confidence is submitted.
 *
 * - Only fires when confidence_level is non-null (no confidence = no message).
 * - Dedup: deletes previous reckons message for same user + event before
 *   inserting a new one (prevents chat spam when user changes pick/confidence).
 * - Respects pick_reveal_at: the message itself doesn't leak the pick since
 *   chat messages have the same visibility as any chat message (members only),
 *   and the reckons copy is generic enough ("X reckons Team Y") that seeing it
 *   in chat is the desired behaviour — the whole point is social bragging.
 * - Fire-and-forget: errors are logged, never thrown.
 */
export async function postReckonsChatMessage({
  userId,
  competitionId,
  eventId,
  predictedTeam,
  confidenceLevel,
  isDraw,
  homeScore,
  awayScore,
}: {
  userId: string;
  competitionId: string;
  eventId: string;
  predictedTeam: string;
  confidenceLevel: number;
  isDraw?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
}): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Fetch the user's display name
    const { data: userRow } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", userId)
      .single();

    const displayName = userRow?.display_name ?? "Someone";

    // Generate the copy
    const scoreCopy = formatScoreForCopy(homeScore, awayScore);
    const result = generateReckonsCopy({
      name: displayName,
      team: predictedTeam,
      score: scoreCopy || undefined,
      confidence: confidenceLevel,
      isDraw,
    });

    if (!result) return; // No template found for this confidence level

    // Dedup: delete any previous reckons message from this user for this event.
    // We tag reckons messages with a metadata prefix in the content so we can
    // identify them. Format: "[reckons:{eventId}] <copy>"
    const tag = `[reckons:${eventId}]`;

    await supabase
      .from("chat_messages")
      .delete()
      .eq("competition_id", competitionId)
      .eq("user_id", userId)
      .eq("message_type", "system")
      .like("content", `${tag}%`);

    // Insert new reckons message
    await supabase.from("chat_messages").insert({
      competition_id: competitionId,
      user_id: userId,
      content: `${tag} ${result.text}`,
      message_type: "system",
    });
  } catch (err) {
    console.error(
      `[postReckonsChatMessage] Error for user ${userId}, event ${eventId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Remove the reckons chat message for a user + event (called when prediction
 * is deleted/reset).
 */
export async function removeReckonsChatMessage({
  userId,
  competitionId,
  eventId,
}: {
  userId: string;
  competitionId: string;
  eventId: string;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const tag = `[reckons:${eventId}]`;

    await supabase
      .from("chat_messages")
      .delete()
      .eq("competition_id", competitionId)
      .eq("user_id", userId)
      .eq("message_type", "system")
      .like("content", `${tag}%`);
  } catch (err) {
    console.error(
      `[removeReckonsChatMessage] Error for user ${userId}, event ${eventId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
