/**
 * Tag publishing — writes tag assignments to member_tags and triggers
 * chat messages. All writes use the service-role client (bypasses RLS).
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { TagAssignment } from "./assign-behavioural";
import type { EventTagAssignment } from "./assign-event-driven";
import { getTagDefinition } from "./tag-catalogue";
import { insertTagRevealMessage } from "./chat-messages";
import { notifyAdminOfPendingTags } from "./admin-notify";
import type { MemberTag } from "@/types/database";

// ---------------------------------------------------------------------------
// Publish behavioural tags (pending → preview window)
// ---------------------------------------------------------------------------

/**
 * Write behavioural tag assignments to member_tags with status 'pending'.
 * Expires the previous round's behavioural tags first.
 *
 * @param competitionId - Competition UUID
 * @param roundId - Round UUID these tags are for
 * @param assignments - Tag assignments from assignBehaviouralTags
 */
export async function publishBehaviouralTags(
  competitionId: string,
  roundId: string,
  assignments: TagAssignment[],
): Promise<void> {
  const supabase = createServiceClient();

  // Expire previous round's behavioural tags
  await expirePreviousTags(competitionId, roundId);

  if (assignments.length === 0) return;

  // Build rows for insert
  const rows = assignments.map((a) => ({
    competition_id: competitionId,
    user_id: a.userId,
    round_id: roundId,
    tag_name: a.tagName,
    tag_category: a.tagCategory,
    status: a.tagCategory === "engagement_pressure" ? "active" : "pending",
    stats: a.stats,
    assigned_at: new Date().toISOString(),
    // Engagement pressure tags are immediately active
    published_at:
      a.tagCategory === "engagement_pressure"
        ? new Date().toISOString()
        : null,
  }));

  const { error } = await supabase.from("member_tags").insert(rows);

  if (error) {
    console.error("[reputation] Failed to insert behavioural tags:", error);
    throw error;
  }

  // Behavioural + engagement tags are visible on the leaderboard only.
  // No chat messages — they flood the conversation.

  // Notify admins of pending tags (non-engagement_pressure)
  const pendingCount = assignments.filter(
    (a) => a.tagCategory !== "engagement_pressure",
  ).length;
  if (pendingCount > 0) {
    try {
      await notifyAdminOfPendingTags(competitionId, pendingCount);
    } catch (err) {
      // Don't fail the publish if notification fails
      console.error("[reputation] Admin notification failed:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Publish event-driven tags (immediately active)
// ---------------------------------------------------------------------------

/**
 * Write event-driven tag assignments to member_tags with status 'active'.
 * Insert chat messages immediately.
 *
 * @param competitionId - Competition UUID
 * @param assignments - Event tag assignments from assignEventDrivenTags
 */
export async function publishEventDrivenTags(
  competitionId: string,
  assignments: EventTagAssignment[],
): Promise<void> {
  if (assignments.length === 0) return;

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Build rows for insert
  const rows = assignments.map((a) => ({
    competition_id: competitionId,
    user_id: a.userId,
    event_id: a.eventId,
    tag_name: a.tagName,
    tag_category: "event_driven" as const,
    status: "active" as const,
    stats: a.stats,
    assigned_at: now,
    published_at: now,
  }));

  const { error } = await supabase.from("member_tags").insert(rows);

  if (error) {
    console.error("[reputation] Failed to insert event-driven tags:", error);
    throw error;
  }

  // Insert chat messages for the top 2 event-driven tags only (avoid flooding)
  const announceable = assignments.filter((a) => {
    const def = getTagDefinition(a.tagName);
    return def?.announced;
  });

  // Sort by priority tier (lower = higher priority)
  announceable.sort((a, b) => {
    const aDef = getTagDefinition(a.tagName);
    const bDef = getTagDefinition(b.tagName);
    return (aDef?.priorityTier ?? 4) - (bDef?.priorityTier ?? 4);
  });

  const chatCap = 2;
  for (const assignment of announceable.slice(0, chatCap)) {
    const tagDef = getTagDefinition(assignment.tagName)!;
    const displayName =
      (assignment.stats.display_name as string) ?? "Someone";

    const { data: insertedTag } = await supabase
      .from("member_tags")
      .select("*")
      .eq("competition_id", competitionId)
      .eq("user_id", assignment.userId)
      .eq("tag_name", assignment.tagName)
      .eq("event_id", assignment.eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (insertedTag) {
      await insertTagRevealMessage(
        competitionId,
        insertedTag as MemberTag,
        tagDef,
        displayName,
        assignment.stats,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Expire previous round's behavioural tags
// ---------------------------------------------------------------------------

/**
 * Set previous round's behavioural tags to 'expired' where status = 'active'.
 * Only affects behavioural tags, not engagement or event-driven.
 *
 * @param competitionId - Competition UUID
 * @param currentRoundId - Current round UUID (tags from OTHER rounds get expired)
 */
export async function expirePreviousTags(
  competitionId: string,
  currentRoundId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("member_tags")
    .update({ status: "expired", expired_at: now })
    .eq("competition_id", competitionId)
    .eq("tag_category", "behavioural")
    .eq("status", "active")
    .neq("round_id", currentRoundId);

  if (error) {
    console.error("[reputation] Failed to expire previous tags:", error);
  }
}

// ---------------------------------------------------------------------------
// Auto-publish pending tags (preview window → active)
// ---------------------------------------------------------------------------

/**
 * Flip all 'pending' behavioural tags to 'active', set published_at,
 * and insert chat messages.
 *
 * Called when the preview window closes (e.g., via cron or admin action).
 *
 * @param competitionId - Competition UUID
 */
export async function autoPublishPendingTags(
  competitionId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Fetch pending tags before updating
  const { data: pendingTags, error: fetchError } = await supabase
    .from("member_tags")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "pending")
    .limit(500);

  if (fetchError) {
    console.error("[reputation] Failed to fetch pending tags:", fetchError);
    return;
  }

  if (!pendingTags || pendingTags.length === 0) return;

  // Flip to active
  const { error: updateError } = await supabase
    .from("member_tags")
    .update({ status: "active", published_at: now })
    .eq("competition_id", competitionId)
    .eq("status", "pending");

  if (updateError) {
    console.error("[reputation] Failed to publish pending tags:", updateError);
    return;
  }

  // After the update, fetch the tags that were actually published
  const { data: publishedTags } = await supabase
    .from("member_tags")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "active")
    .eq("tag_category", "behavioural")
    .in("id", pendingTags.map(t => (t as MemberTag).id))
    .limit(500);

  // Behavioural tags are visible on the leaderboard only — no chat messages.
}
