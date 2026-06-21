/**
 * Reputation Tag System — main orchestration.
 *
 * Entry points:
 * - processTagsForRound: called after all events in a round are confirmed
 * - processEventTags: called after a single event result is confirmed
 * - rejectTag: called by user to reject their tag
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { BehaviouralTagMetrics, EventTagMetric, MemberTag } from "@/types/database";
import { assignBehaviouralTags } from "./assign-behavioural";
import { assignEventDrivenTags } from "./assign-event-driven";
import {
  publishBehaviouralTags,
  publishEventDrivenTags,
} from "./publish";
import { insertTagRejectMessage } from "./chat-messages";
import { getTagDefinition } from "./tag-catalogue";

// ---------------------------------------------------------------------------
// processTagsForRound
// ---------------------------------------------------------------------------

/**
 * Called after result confirmation (ideally when all events in a round are
 * confirmed, but can be called per-round whenever ready).
 *
 * Computes behavioural + engagement pressure metrics, assigns tags,
 * and publishes them (pending for behavioural, active for engagement).
 *
 * @param competitionId - Competition UUID
 * @param roundId - Round UUID whose completion triggered this
 */
export async function processTagsForRound(
  competitionId: string,
  roundId: string,
): Promise<void> {
  const supabase = createServiceClient();

  // 1. Fetch metrics from RPC
  const { data: rawMetrics, error: metricsError } = await supabase.rpc(
    "compute_reputation_stats",
    { p_competition_id: competitionId },
  );

  if (metricsError) {
    console.error("[reputation] Failed to compute metrics:", metricsError);
    return;
  }

  const metrics = (rawMetrics ?? []) as BehaviouralTagMetrics[];
  if (metrics.length === 0) return;

  // 2. Compute total fixtures and competition completion
  const { data: eventCounts } = await supabase
    .from("events")
    .select("id, status")
    .eq("competition_id", competitionId)
    .limit(1000);

  const totalFixtures = eventCounts?.length ?? 0;
  const resultedFixtures =
    eventCounts?.filter((e) => e.status === "resulted").length ?? 0;
  const completionPct =
    totalFixtures > 0 ? (resultedFixtures / totalFixtures) * 100 : 0;

  // 3. Assign tags
  const assignments = assignBehaviouralTags(
    metrics,
    totalFixtures,
    completionPct,
  );

  // 4. Publish
  await publishBehaviouralTags(competitionId, roundId, assignments);

  console.log(
    `[reputation] Processed ${assignments.length} tags for competition ${competitionId}, round ${roundId}`,
  );
}

// ---------------------------------------------------------------------------
// processEventTags
// ---------------------------------------------------------------------------

/**
 * Called after a single event result is confirmed.
 * Checks for event-driven tags (Nailed It, Crystal Ball, etc.).
 *
 * @param competitionId - Competition UUID
 * @param eventId - Event UUID that was just confirmed
 */
export async function processEventTags(
  competitionId: string,
  eventId: string,
): Promise<void> {
  const supabase = createServiceClient();

  // 1. Fetch event metrics from RPC
  const { data: rawMetrics, error: metricsError } = await supabase.rpc(
    "compute_event_tag_metrics",
    { p_competition_id: competitionId, p_event_id: eventId },
  );

  if (metricsError) {
    console.error("[reputation] Failed to compute event metrics:", metricsError);
    return;
  }

  const eventMetrics = (rawMetrics ?? []) as EventTagMetric[];
  if (eventMetrics.length === 0) return;

  // 2. Fetch existing tags for one-time checks
  const { data: existingRaw } = await supabase
    .from("member_tags")
    .select("*")
    .eq("competition_id", competitionId)
    .in("tag_name", ["First Blood", "The Whistle"])
    .limit(100);

  const existingTags = (existingRaw ?? []) as MemberTag[];

  // 3. Assign event-driven tags
  const assignments = assignEventDrivenTags(
    eventMetrics,
    competitionId,
    eventId,
    existingTags,
  );

  if (assignments.length === 0) return;

  // 4. Publish (immediately active + chat messages)
  await publishEventDrivenTags(competitionId, assignments);

  console.log(
    `[reputation] Processed ${assignments.length} event tags for event ${eventId}`,
  );
}

// ---------------------------------------------------------------------------
// rejectTag
// ---------------------------------------------------------------------------

/**
 * Called by a user to reject their tag.
 *
 * Updates the tag status to 'rejected' and posts a rejection one-liner
 * to the competition chat.
 *
 * @param tagId - member_tags UUID
 * @param userId - User's UUID (must match the tag's user_id)
 */
export async function rejectTag(
  tagId: string,
  userId: string,
): Promise<void> {
  const supabase = createServiceClient();

  // 1. Fetch the tag
  const { data: raw, error: fetchError } = await supabase
    .from("member_tags")
    .select("*")
    .eq("id", tagId)
    .single();

  if (fetchError || !raw) {
    console.error("[reputation] Tag not found:", tagId);
    return;
  }

  const tag = raw as MemberTag;

  // 2. Verify ownership
  if (tag.user_id !== userId) {
    console.error("[reputation] User does not own this tag:", userId, tagId);
    return;
  }

  // 3. Check if rejectable
  const tagDef = getTagDefinition(tag.tag_name);
  if (!tagDef?.rejectable) {
    console.error("[reputation] Tag is not rejectable:", tag.tag_name);
    return;
  }

  // 4. Check status (only active/pending can be rejected)
  if (tag.status !== "active" && tag.status !== "pending") {
    console.error("[reputation] Tag cannot be rejected in status:", tag.status);
    return;
  }

  // 5. Update status
  const { error: updateError } = await supabase
    .from("member_tags")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
    })
    .eq("id", tagId);

  if (updateError) {
    console.error("[reputation] Failed to reject tag:", updateError);
    return;
  }

  // 6. Fetch display name for chat message
  const { data: user } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", userId)
    .single();

  const displayName = user?.display_name ?? "Someone";

  // 7. Post rejection one-liner to chat
  await insertTagRejectMessage(
    tag.competition_id,
    userId,
    displayName,
    tag.tag_name,
  );

  console.log(
    `[reputation] Tag rejected: ${tag.tag_name} by ${displayName}`,
  );
}
