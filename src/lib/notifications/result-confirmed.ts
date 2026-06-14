import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push/send";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

/**
 * Notify all competition members that a result has been confirmed.
 *
 * 1. Inserts a system chat message: "France 2-1 Mexico — result confirmed."
 * 2. Sends push notification to all members with result_notifications enabled.
 *
 * Fire-and-forget — errors are logged, never thrown.
 */
export async function notifyResultConfirmed(
  eventId: string,
  competitionId: string,
  eventName: string,
  resultData: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Build score string: "France 2-1 Mexico"
    const homeScore = resultData.home_score ?? resultData.homeScore;
    const awayScore = resultData.away_score ?? resultData.awayScore;
    const scoreLine =
      typeof homeScore === "number" && typeof awayScore === "number"
        ? `${homeScore}-${awayScore}`
        : null;

    // Use event_name which is typically "France vs Mexico"
    const names = eventName.split(/\s+vs?\s+/i);
    const title =
      scoreLine && names.length === 2
        ? `${names[0].trim()} ${scoreLine} ${names[1].trim()}`
        : `${eventName} — result confirmed`;

    const chatContent = `${title} — result confirmed.`;

    // 1. Insert system chat message
    await supabase.from("chat_messages").insert({
      competition_id: competitionId,
      content: chatContent,
      message_type: "system_result",
      user_id: null,
    });

    // 2. Push to all competition members
    const { data: members } = await supabase
      .from("competition_members")
      .select("user_id")
      .eq("competition_id", competitionId);

    const pushPayload = {
      title,
      body: "How did you do? Check your score.",
      url: "/wc/chat",
      tag: `result-confirmed-${eventId}`,
    };

    for (const member of members ?? []) {
      sendPushToUser(member.user_id, pushPayload, "result_notifications", {
        eventId,
        competitionId,
      }).catch(() => {});
    }
  } catch (err) {
    console.error(
      `[notifyResultConfirmed] Error for event ${eventId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
