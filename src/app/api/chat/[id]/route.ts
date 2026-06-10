import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const HARD_DELETE_WINDOW_MS = 10 * 1000; // 10 seconds
const MAX_MESSAGE_LENGTH = 2000;

/**
 * DELETE /api/chat/:id
 * Delete a chat message.
 * - Author within 10s: hard delete (no trace)
 * - Author after 10s: soft delete (tombstone)
 * - Admin: hard delete always
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

  // Check if user is admin of competition
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", message.competition_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this competition" },
      { status: 403 }
    );
  }

  const isAdmin = membership.role === "admin" || membership.role === "co_admin";

  if (!isAuthor && !isAdmin) {
    return NextResponse.json(
      { error: "You can only delete your own messages" },
      { status: 403 }
    );
  }

  const messageAge = Date.now() - new Date(message.created_at).getTime();

  // Admin always hard-deletes; author within 10s hard-deletes
  if (isAdmin || (isAuthor && messageAge <= HARD_DELETE_WINDOW_MS)) {
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

  // Author after 10s: soft delete (tombstone)
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

  if (message.message_type === "system") {
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
