/**
 * Chat message insertion for the reputation tag system.
 *
 * All writes use the service-role client (bypasses RLS).
 * System tag messages have null user_id and structured metadata JSONB.
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { MemberTag } from "@/types/database";
import type { TagDefinition } from "./tag-catalogue";
import { REJECTION_ONELINERS } from "./tag-catalogue";

// ---------------------------------------------------------------------------
// Template interpolation
// ---------------------------------------------------------------------------

function interpolate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val != null ? String(val) : `{${key}}`;
  });
}

// ---------------------------------------------------------------------------
// Tag reveal message
// ---------------------------------------------------------------------------

/**
 * Insert a system_tag_reveal chat message for a published tag.
 *
 * @param competitionId - Competition UUID
 * @param tag - The MemberTag row
 * @param tagDef - The tag definition from the catalogue
 * @param displayName - User's display name for the announcement
 * @param stats - Stats object for template interpolation
 */
export async function insertTagRevealMessage(
  competitionId: string,
  tag: MemberTag,
  tagDef: TagDefinition,
  displayName: string,
  stats: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient();

  const vars = { ...stats, name: displayName, tag: tagDef.layer1 };

  const content = interpolate(tagDef.layer3, vars);

  const metadata = {
    tagId: tag.id,
    tagName: tagDef.name,
    layer1: tagDef.layer1,
    layer2: interpolate(tagDef.layer2, vars),
    factCard: {
      fact: tagDef.factCard.fact,
      stat: interpolate(tagDef.factCard.statTemplate, vars),
      context: interpolate(tagDef.factCard.contextTemplate, vars),
    },
    visual: {
      borderColor: tagDef.visual.borderColor,
      gold: tagDef.visual.gold ?? false,
      opacity: tagDef.visual.opacity ?? 1,
    },
    userId: tag.user_id,
    displayName,
  };

  const { error } = await supabase.from("chat_messages").insert({
    competition_id: competitionId,
    user_id: null,
    content,
    message_type: "system_tag_reveal",
    metadata,
  });

  if (error) {
    console.error("[reputation] Failed to insert tag reveal message:", error);
  }
}

// ---------------------------------------------------------------------------
// Tag change message
// ---------------------------------------------------------------------------

/**
 * Insert a system_tag_change chat message when a user's tag changes
 * between prediction windows.
 *
 * @param competitionId - Competition UUID
 * @param displayName - User's display name
 * @param oldTag - Previous tag name
 * @param newTag - New tag name
 * @param reason - Reason for the change
 */
export async function insertTagChangeMessage(
  competitionId: string,
  displayName: string,
  oldTag: string,
  newTag: string,
  reason: string,
): Promise<void> {
  const supabase = createServiceClient();

  const content = `${displayName} has moved from ${oldTag} to ${newTag}.`;

  const metadata = {
    displayName,
    oldTag,
    newTag,
    reason,
  };

  const { error } = await supabase.from("chat_messages").insert({
    competition_id: competitionId,
    user_id: null,
    content,
    message_type: "system_tag_change",
    metadata,
  });

  if (error) {
    console.error("[reputation] Failed to insert tag change message:", error);
  }
}

// ---------------------------------------------------------------------------
// Tag reject message
// ---------------------------------------------------------------------------

/**
 * Insert a system_tag_reject chat message when a user rejects their tag.
 * Picks a random one-liner from the rejection pool.
 *
 * @param competitionId - Competition UUID
 * @param userId - User's UUID
 * @param displayName - User's display name
 * @param tagName - The tag that was rejected
 */
export async function insertTagRejectMessage(
  competitionId: string,
  userId: string,
  displayName: string,
  tagName: string,
): Promise<void> {
  const supabase = createServiceClient();

  // Pick a random rejection one-liner
  const template =
    REJECTION_ONELINERS[Math.floor(Math.random() * REJECTION_ONELINERS.length)];
  const content = interpolate(template, { name: displayName, tag: tagName });

  const metadata = {
    userId,
    displayName,
    tagName,
  };

  const { error } = await supabase.from("chat_messages").insert({
    competition_id: competitionId,
    user_id: null,
    content,
    message_type: "system_tag_reject",
    metadata,
  });

  if (error) {
    console.error("[reputation] Failed to insert tag reject message:", error);
  }
}
