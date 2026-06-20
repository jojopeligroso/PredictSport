import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const HARD_DELETE_WINDOW_MS = 20 * 1000; // 20 seconds
const MAX_MESSAGE_LENGTH = 2000;

/** Role hierarchy: higher number = higher rank */
const ROLE_RANK: Record<string, number> = {
  participant: 0,
  mod: 1,
  co_admin: 2,
  admin: 3,
};

/**
 * DELETE /api/chat/:id
 * Delete a chat message.
 * - Author within 20s: hard delete (vanishes)
 * - Author after 20s: soft delete ("This message was deleted")
 * - Mod: soft delete on participant messages only ("deleted by mod")
 * - Admin/co_admin: soft delete on anyone's messages ("deleted by admin")
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the message
  const { data: message } = await supabase
    .from("chat_messages")
    .select("id, competition_id, user_id, created_at, deleted_at")
    .eq("id", messageId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (message.deleted_at) {
    return NextResponse.json(
      { error: "Message already deleted" },
      { status: 400 }
    );
  }

  const isAuthor = message.user_id === user.id;

  // Get actor's membership
  const { data: actorMembership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", message.competition_id)
    .eq("user_id", user.id)
    .single();

  if (!actorMembership) {
    return NextResponse.json(
      { error: "Not a member of this competition" },
      { status: 403 }
    );
  }

  const actorRole = actorMembership.role;
  const actorRank = ROLE_RANK[actorRole] ?? 0;
  const isModerator = actorRank >= ROLE_RANK.mod;

  // Non-authors must have mod+ role
  if (!isAuthor && !isModerator) {
    return NextResponse.json(
      { error: "You can only delete your own messages" },
      { status: 403 }
    );
  }

  // For mod+ deleting others' messages, check hierarchy
  if (!isAuthor && isModerator) {
    // Get target user's role
    const { data: targetMembership } = await supabase
      .from("competition_members")
      .select("role")
      .eq("competition_id", message.competition_id)
      .eq("user_id", message.user_id)
      .single();

    const targetRank = ROLE_RANK[targetMembership?.role ?? "participant"] ?? 0;

    if (targetRank >= actorRank) {
      return NextResponse.json(
        { error: "Cannot delete messages from users of equal or higher role" },
        { status: 403 }
      );
    }

    // Mod/admin deletes are always soft-delete (tombstone)
    // co_admin deletions store 'admin' — users don't see internal hierarchy
    const deletedBy = actorRole === "mod" ? "mod" : "admin";
    const { error } = await supabase
      .from("chat_messages")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
      })
      .eq("id", messageId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete message", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: messageId, type: "soft" });
  }

  // Author deleting own message
  const messageAge = Date.now() - new Date(message.created_at).getTime();

  // Within 20s: hard delete (vanishes)
  if (messageAge <= HARD_DELETE_WINDOW_MS) {
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete message", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: messageId, type: "hard" });
  }

  // After 20s: soft delete (tombstone)
  const { error } = await supabase
    .from("chat_messages")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: "user",
    })
    .eq("id", messageId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete message", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: messageId, type: "soft" });
}

/**
 * PATCH /api/chat/:id
 * Edit a chat message. Author only, within 5-minute window.
 * Body: { content }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json(
      { error: "Message content is required" },
      { status: 400 }
    );
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message exceeds ${MAX_MESSAGE_LENGTH} character limit` },
      { status: 400 }
    );
  }

  // Fetch the message
  const { data: message } = await supabase
    .from("chat_messages")
    .select("id, user_id, message_type, created_at, deleted_at")
    .eq("id", messageId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (message.deleted_at) {
    return NextResponse.json(
      { error: "Cannot edit a deleted message" },
      { status: 400 }
    );
  }

  if (message.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only edit your own messages" },
      { status: 403 }
    );
  }

  if (message.message_type !== "user") {
    return NextResponse.json(
      { error: "System messages cannot be edited" },
      { status: 400 }
    );
  }

  const messageAge = Date.now() - new Date(message.created_at).getTime();
  if (messageAge > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Edit window has expired (5 minutes)" },
      { status: 403 }
    );
  }

  const { data: updated, error } = await supabase
    .from("chat_messages")
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to edit message", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: updated });
}
