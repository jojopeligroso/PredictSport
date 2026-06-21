/**
 * Admin notification for pending reputation tags.
 *
 * Sends push notifications to competition admins when behavioural tags
 * are ready for review (6-hour preview window before auto-publish).
 */
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push/send";

/**
 * Notify admin(s) of a competition that new tags are pending review.
 *
 * @param competitionId - Competition UUID
 * @param tagCount - Number of pending tags assigned
 */
export async function notifyAdminOfPendingTags(
  competitionId: string,
  tagCount: number,
): Promise<void> {
  if (tagCount === 0) return;

  const supabase = createServiceClient();

  // Find admin and co_admin members
  const { data: admins, error } = await supabase
    .from("competition_members")
    .select("user_id")
    .eq("competition_id", competitionId)
    .in("role", ["admin", "co_admin"])
    .limit(20);

  if (error) {
    console.error("[reputation] Failed to fetch admins for notification:", error);
    return;
  }

  if (!admins || admins.length === 0) return;

  // Send push to each admin
  const payload = {
    title: "New tags pending",
    body: `${tagCount} reputation tag${tagCount === 1 ? " is" : "s are"} ready for review. You have 6 hours to suppress any before they go live.`,
    url: "/competitions",
    tag: `pending-tags-${competitionId}-${Date.now()}`,
  };

  for (const admin of admins) {
    try {
      await sendPushToUser(admin.user_id, payload, "reputation_tags", {
        competitionId,
        skipThrottle: true,
      });
    } catch (err) {
      console.error(
        `[reputation] Failed to notify admin ${admin.user_id}:`,
        err,
      );
    }
  }

  console.log(
    `[reputation] Notified ${admins.length} admin(s) of ${tagCount} pending tags`,
  );
}
