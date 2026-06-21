import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push/send";
import type { CompareInput } from "@/lib/sports/fetch-result";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

function formatScore(input: CompareInput): string {
  if (input.score) {
    return `${input.score.home_score}\u2013${input.score.away_score}`;
  }
  if (input.positions?.length) {
    return input.positions
      .slice(0, 3)
      .map((p) => `${p.position}. ${p.name}`)
      .join(", ");
  }
  return "unknown";
}

/**
 * Notify super admin and competition members that a result is disputed.
 *
 * 1. Push notification to all super admins with both scores
 * 2. Chat system message to all competition members: "Score under review"
 *
 * Fire-and-forget — errors are logged, never thrown.
 */
export async function notifyResultDisputed(
  eventId: string,
  competitionId: string,
  eventName: string,
  primaryScore: CompareInput,
  verifierScore: CompareInput,
  primaryProvider: string,
  verifierProvider: string,
): Promise<void> {
  try {
    const supabase = getServiceClient();

    const primaryStr = formatScore(primaryScore);
    const verifierStr = formatScore(verifierScore);

    // 1. Chat system message visible to all members
    await supabase.from("chat_messages").insert({
      competition_id: competitionId,
      content: `Score under review: ${eventName} — checking result`,
      message_type: "system_result",
      user_id: null,
    });

    // 2. Push notification to all super admins
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("is_super_admin", true);

    const pushPayload = {
      title: `Disputed: ${eventName}`,
      body: `${primaryProvider}: ${primaryStr} vs ${verifierProvider}: ${verifierStr}`,
      url: "/wc/admin",
      tag: `result-disputed-${eventId}`,
    };

    for (const admin of admins ?? []) {
      sendPushToUser(admin.id, pushPayload, "result_notifications", {
        eventId,
        competitionId,
      }).catch(() => {});
    }
  } catch (err) {
    console.error(
      `[notifyResultDisputed] Error for event ${eventId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
