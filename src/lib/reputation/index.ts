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
import {
  assignEventDrivenTags,
  type EventTagAssignment,
} from "./assign-event-driven";
import {
  publishBehaviouralTags,
  publishEventDrivenTags,
} from "./publish";
import { insertTagRejectMessage, insertEventTagMessage } from "./chat-messages";
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
  const rawAssignments = assignBehaviouralTags(
    metrics,
    totalFixtures,
    completionPct,
  );

  // 3b. Dedup: if >3 people would get the same tag, it's not distinctive — skip it
  const assignments = dedupTagAssignments(rawAssignments);

  // 4. Publish
  await publishBehaviouralTags(competitionId, roundId, assignments);

  console.log(
    `[reputation] Processed ${assignments.length} tags for competition ${competitionId}, round ${roundId}`,
  );
}

// ---------------------------------------------------------------------------
// checkRoundCompletionAndProcessTags
// ---------------------------------------------------------------------------

/**
 * After a result is confirmed, check if all events in that event's round
 * are now resulted. If so, trigger behavioural tag processing for the round.
 *
 * Safe to call from any result-confirmation path (admin confirm, auto-resolve).
 * Fire-and-forget — logs errors but never throws.
 *
 * @param competitionId - Competition UUID
 * @param eventId - Event UUID that was just confirmed
 */
export async function checkRoundCompletionAndProcessTags(
  competitionId: string,
  eventId: string,
): Promise<void> {
  const supabase = createServiceClient();

  // Find the round this event belongs to
  const { data: event } = await supabase
    .from("events")
    .select("round_id")
    .eq("id", eventId)
    .single();

  if (!event?.round_id) return; // No round = no behavioural tags

  // Check if all events in this round are resulted
  const { data: roundEvents } = await supabase
    .from("events")
    .select("id, status")
    .eq("round_id", event.round_id)
    .limit(200);

  if (!roundEvents || roundEvents.length === 0) return;

  const allResulted = roundEvents.every((e) => e.status === "resulted");
  if (!allResulted) return;

  console.log(
    `[reputation] Round ${event.round_id} fully resulted (${roundEvents.length} events) — triggering behavioural tags`,
  );

  await processTagsForRound(competitionId, event.round_id);
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

  // 2. Fetch existing tags for one-time checks (only tag_name + competition_id used)
  const { data: existingRaw } = await supabase
    .from("member_tags")
    .select("tag_name, competition_id")
    .eq("competition_id", competitionId)
    .in("tag_name", ["First Blood", "The Whistle"])
    .limit(100);

  const existingTags = (existingRaw ?? []) as Pick<MemberTag, "tag_name" | "competition_id">[] as MemberTag[];

  // 3. Assign event-driven tags
  const rawAssignments = assignEventDrivenTags(
    eventMetrics,
    competitionId,
    eventId,
    existingTags,
  );

  // 3b. Dedup: if >3 people would get the same tag, skip it
  const assignments = dedupEventTagAssignments(rawAssignments);

  // 3c. "Nobody Saw That Coming" — event-level tag when 0 correct winner predictions
  const predicted = eventMetrics.filter((m) => m.predicted);
  const winnersCorrectCount = predicted.filter((m) => m.winner_correct).length;
  if (winnersCorrectCount === 0 && predicted.length >= 4) {
    const tagDef = getTagDefinition("Nobody Saw That Coming");
    if (tagDef) {
      // Build context string from the event result
      const firstMetric = eventMetrics[0];
      const eventName = firstMetric?.display_name
        ? `${predicted.length} predictions, 0 correct`
        : "";
      await insertEventTagMessage(competitionId, tagDef, {
        stat: predicted.length,
        contextStat: eventName,
      });
      console.log(
        `[reputation] "Nobody Saw That Coming" for event ${eventId} (0/${predicted.length} correct)`,
      );
    }
  }

  if (assignments.length === 0) return;

  // 4. Throttle: cap event-driven tags per competition per rolling window
  const throttled = await throttleEventTags(competitionId, assignments);

  if (throttled.length === 0) {
    console.log(
      `[reputation] All ${assignments.length} event tags throttled for event ${eventId}`,
    );
    return;
  }

  // 5. Publish (immediately active + chat messages)
  await publishEventDrivenTags(competitionId, throttled);

  console.log(
    `[reputation] Published ${throttled.length}/${assignments.length} event tags for event ${eventId}`,
  );
}

// ---------------------------------------------------------------------------
// Event tag throttle
// ---------------------------------------------------------------------------

/** Rolling window (hours) for event-driven tag rate limiting */
const EVENT_TAG_WINDOW_HOURS = 20;

/** Max event-driven tags per competition in the rolling window */
const COMPETITION_EVENT_TAG_CAP = 4;

/** Max event-driven tags per user in the rolling window */
const USER_EVENT_TAG_CAP = 2;

/**
 * Rate-limit event-driven tags to keep notifications meaningful.
 * ~4 tags per day per competition, max 2 per user (preferring different names).
 */
async function throttleEventTags(
  competitionId: string,
  assignments: EventTagAssignment[],
): Promise<EventTagAssignment[]> {
  const supabase = createServiceClient();
  const windowStart = new Date(
    Date.now() - EVENT_TAG_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: recentRaw } = await supabase
    .from("member_tags")
    .select("user_id, tag_name")
    .eq("competition_id", competitionId)
    .eq("tag_category", "event_driven")
    .gte("created_at", windowStart)
    .limit(200);

  const recent = (recentRaw ?? []) as { user_id: string; tag_name: string }[];
  let remainingSlots = Math.max(0, COMPETITION_EVENT_TAG_CAP - recent.length);

  if (remainingSlots === 0) return [];

  // Build per-user recent tag names
  const userRecent = new Map<string, string[]>();
  for (const t of recent) {
    const arr = userRecent.get(t.user_id) ?? [];
    arr.push(t.tag_name);
    userRecent.set(t.user_id, arr);
  }

  // Prioritise higher-tier tags when slots are limited
  const sorted = [...assignments].sort((a, b) => {
    const aTier = getTagDefinition(a.tagName)?.priorityTier ?? 4;
    const bTier = getTagDefinition(b.tagName)?.priorityTier ?? 4;
    return aTier - bTier;
  });

  const result: EventTagAssignment[] = [];
  for (const a of sorted) {
    if (remainingSlots <= 0) break;

    const userTags = userRecent.get(a.userId) ?? [];
    if (userTags.length >= USER_EVENT_TAG_CAP) continue;
    if (userTags.length > 0 && userTags.includes(a.tagName)) continue;

    result.push(a);
    remainingSlots--;
    const arr = userRecent.get(a.userId) ?? [];
    arr.push(a.tagName);
    userRecent.set(a.userId, arr);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tag dedup: >3 same tag = not distinctive, skip entirely
// ---------------------------------------------------------------------------

/** Max recipients for the same tag name before it's considered non-distinctive */
const MAX_SAME_TAG = 3;

function dedupTagAssignments<T extends { tagName: string }>(
  assignments: T[],
): T[] {
  const countByTag = new Map<string, number>();
  for (const a of assignments) {
    countByTag.set(a.tagName, (countByTag.get(a.tagName) ?? 0) + 1);
  }
  const filtered = assignments.filter(
    (a) => (countByTag.get(a.tagName) ?? 0) <= MAX_SAME_TAG,
  );
  for (const [tag, count] of countByTag) {
    if (count > MAX_SAME_TAG) {
      console.log(
        `[reputation] Skipped "${tag}" — ${count} recipients exceeds max ${MAX_SAME_TAG}`,
      );
    }
  }
  return filtered;
}

// Alias for event tags (same logic, different type)
const dedupEventTagAssignments = dedupTagAssignments;

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

  // 1. Fetch the tag (only the fields needed for ownership/status checks + chat message)
  const { data: raw, error: fetchError } = await supabase
    .from("member_tags")
    .select("user_id, tag_name, status, competition_id")
    .eq("id", tagId)
    .single();

  if (fetchError || !raw) {
    console.error("[reputation] Tag not found:", tagId);
    return;
  }

  const tag = raw as Pick<MemberTag, "user_id" | "tag_name" | "status" | "competition_id">;

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
