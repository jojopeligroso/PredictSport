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

  if (assignments.length === 0) return;

  // Title-holder model: a behavioural tag persists until another member earns
  // the SAME tag. We no longer blanket-expire previous rounds' tags. Instead,
  // a tag the current holder already owns is skipped (no churn), and the
  // hand-off to a new holder happens when the new tag goes active
  // (see expireSupersededHolders, called from the publish paths).
  const { data: activeRows } = await supabase
    .from("member_tags")
    .select("user_id, tag_name")
    .eq("competition_id", competitionId)
    .eq("status", "active")
    .limit(500);

  const activeHolderByTag = new Map<string, string>();
  for (const r of (activeRows ?? []) as { user_id: string; tag_name: string }[]) {
    if (!activeHolderByTag.has(r.tag_name)) {
      activeHolderByTag.set(r.tag_name, r.user_id);
    }
  }

  const now = new Date().toISOString();

  // Build rows for insert, skipping tags the same user already actively holds.
  const rows = assignments
    .filter((a) => activeHolderByTag.get(a.tagName) !== a.userId)
    .map((a) => ({
      competition_id: competitionId,
      user_id: a.userId,
      round_id: roundId,
      tag_name: a.tagName,
      tag_category: a.tagCategory,
      status: a.tagCategory === "engagement_pressure" ? "active" : "pending",
      stats: a.stats,
      assigned_at: now,
      // Engagement pressure tags are immediately active
      published_at: a.tagCategory === "engagement_pressure" ? now : null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("member_tags").insert(rows);

  if (error) {
    console.error("[reputation] Failed to insert behavioural tags:", error);
    throw error;
  }

  // Behavioural + engagement tags are visible on the leaderboard only.
  // No chat messages — they flood the conversation.

  // Notify admins of pending tags (the rows we actually inserted as pending)
  const pendingCount = rows.filter((r) => r.status === "pending").length;
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
// Title transfer — expire superseded behavioural tag holders
// ---------------------------------------------------------------------------

/**
 * Behavioural tags are held like a title: once a new holder's tag goes active,
 * the previous holder of that SAME tag loses it. For each just-activated
 * behavioural tag we expire every other active row of the same tag_name,
 * leaving exactly one holder per tag name.
 *
 * Also collapses a user's own older active rows of a tag they re-earned.
 *
 * @param competitionId - Competition UUID
 * @param activatedTags - The behavioural tags that just transitioned to active
 */
export async function expireSupersededHolders(
  competitionId: string,
  activatedTags: MemberTag[],
): Promise<void> {
  const behavioural = activatedTags.filter(
    (t) => t.tag_category === "behavioural",
  );
  if (behavioural.length === 0) return;

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // One holder per tag name — keep the first activated row for each name.
  const holderByName = new Map<string, MemberTag>();
  for (const tag of behavioural) {
    if (!holderByName.has(tag.tag_name)) holderByName.set(tag.tag_name, tag);
  }

  for (const [tagName, holder] of holderByName) {
    const { error } = await supabase
      .from("member_tags")
      .update({ status: "expired", expired_at: now })
      .eq("competition_id", competitionId)
      .eq("tag_category", "behavioural")
      .eq("tag_name", tagName)
      .eq("status", "active")
      .neq("id", holder.id);

    if (error) {
      console.error(
        `[reputation] Failed to expire superseded holders of ${tagName}:`,
        error,
      );
    }
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

  // Title transfer: expire the previous holder of each newly-active tag.
  if (publishedTags && publishedTags.length > 0) {
    await expireSupersededHolders(competitionId, publishedTags as MemberTag[]);
  }

  // Behavioural tags are visible on the leaderboard only — no chat messages.
}
