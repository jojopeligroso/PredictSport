/**
 * Auto-publish pending tags after the 6-hour preview window.
 *
 * Uses a check-on-access pattern: called as a side effect when users
 * access the dashboard or chat, so tags eventually publish even without
 * a cron job (staying within Vercel free tier limits).
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { MemberTag } from "@/types/database";
import { getTagDefinition } from "./tag-catalogue";
import {
  insertTagRevealMessage,
  insertTagChangeMessage,
} from "./chat-messages";

/** Preview window duration in hours (admin can suppress before publish) */
const PREVIEW_WINDOW_HOURS = 6;

/** Accept/reject window in hours after publish — auto-accepts if ignored */
const ACCEPT_REJECT_WINDOW_HOURS = 24;

/**
 * Find all pending tags older than the preview window and flip them to active.
 * Inserts chat messages for each newly published tag.
 *
 * Safe to call repeatedly — only acts on tags past the window.
 *
 * @param competitionId - Competition UUID to check
 */
export async function checkAndPublishExpiredPending(
  competitionId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const cutoff = new Date(
    Date.now() - PREVIEW_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // Fetch pending tags past the preview window
  const { data: pendingTags, error: fetchError } = await supabase
    .from("member_tags")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "pending")
    .lt("assigned_at", cutoff)
    .limit(500);

  if (fetchError) {
    console.error(
      "[reputation] Failed to fetch expired pending tags:",
      fetchError,
    );
    return;
  }

  if (!pendingTags || pendingTags.length === 0) return;

  const now = new Date().toISOString();

  // Flip to active — guard on status = pending to prevent race with admin suppress
  const tagIds = pendingTags.map((t) => t.id);
  const { error: updateError } = await supabase
    .from("member_tags")
    .update({ status: "active", published_at: now })
    .in("id", tagIds)
    .eq("status", "pending");

  if (updateError) {
    console.error(
      "[reputation] Failed to auto-publish expired pending tags:",
      updateError,
    );
    return;
  }

  // Re-fetch only tags that were actually published (guards against race with suppress)
  const { data: publishedTags } = await supabase
    .from("member_tags")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "active")
    .in("id", tagIds)
    .limit(500);

  if (!publishedTags || publishedTags.length === 0) return;

  // Fetch previous round's expired tags for change detection
  const { data: previousTags } = await supabase
    .from("member_tags")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "expired")
    .eq("tag_category", "behavioural")
    .limit(500);

  const previousTagMap = new Map<string, string>();
  for (const pt of previousTags ?? []) {
    const prev = pt as MemberTag;
    previousTagMap.set(prev.user_id, prev.tag_name);
  }

  // Insert chat messages for each newly published tag
  for (const raw of publishedTags) {
    const tag = raw as MemberTag;
    const tagDef = getTagDefinition(tag.tag_name);
    if (!tagDef || !tagDef.announced) continue;

    // Fetch display name
    const { data: user } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", tag.user_id)
      .single();

    const displayName = user?.display_name ?? "Someone";
    const previousTag = previousTagMap.get(tag.user_id);

    if (previousTag && previousTag !== tag.tag_name) {
      await insertTagChangeMessage(
        competitionId,
        displayName,
        previousTag,
        tag.tag_name,
        "New prediction window data",
      );
    }

    await insertTagRevealMessage(
      competitionId,
      tag,
      tagDef,
      displayName,
      tag.stats,
    );
  }

  console.log(
    `[reputation] Auto-published ${publishedTags.length} expired pending tags for competition ${competitionId}`,
  );

  // Also auto-accept tags past the accept/reject window
  await autoAcceptExpiredActiveTags(competitionId);
}

/**
 * Auto-accept active tags that have been published for longer than the
 * accept/reject window (24h). If the user hasn't acted, the tag is
 * accepted on their behalf — it becomes permanent for that round.
 *
 * Safe to call repeatedly — only acts on tags past the window.
 */
async function autoAcceptExpiredActiveTags(
  competitionId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const cutoff = new Date(
    Date.now() - ACCEPT_REJECT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // Find active behavioural tags published before the cutoff
  const { data: expiredTags, error } = await supabase
    .from("member_tags")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("status", "active")
    .eq("tag_category", "behavioural")
    .lt("published_at", cutoff)
    .is("accepted_at", null)
    .limit(500);

  if (error || !expiredTags || expiredTags.length === 0) return;

  const tagIds = expiredTags.map((t) => t.id);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("member_tags")
    .update({ accepted_at: now })
    .in("id", tagIds)
    .eq("status", "active");

  if (updateError) {
    console.error("[reputation] Failed to auto-accept expired tags:", updateError);
    return;
  }

  console.log(
    `[reputation] Auto-accepted ${tagIds.length} tags past ${ACCEPT_REJECT_WINDOW_HOURS}h window for competition ${competitionId}`,
  );
}
