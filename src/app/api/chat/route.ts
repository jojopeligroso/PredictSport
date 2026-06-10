import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 50;

/**
 * GET /api/chat?competitionId=X&cursor=Y
 * List messages for a competition, cursor-based pagination (newest first).
 * Deleted messages return as tombstones (content replaced).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const competitionId = searchParams.get("competitionId");
  const cursor = searchParams.get("cursor"); // ISO timestamp

  if (!competitionId) {
    return NextResponse.json(
      { error: "competitionId is required" },
      { status: 400 }
    );
  }

  // Verify membership (RLS handles this too, but fail fast with a clear error)
  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this competition" },
      { status: 403 }
    );
  }

  let query = supabase
    .from("chat_messages")
    .select(
      "id, competition_id, user_id, content, message_type, mentioned_user_ids, created_at, updated_at, deleted_at, deleted_by"
    )
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1); // fetch one extra to detect hasMore

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: messages, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch messages", details: error.message },
      { status: 500 }
    );
  }

  const hasMore = (messages?.length ?? 0) > PAGE_SIZE;
  const page = (messages ?? []).slice(0, PAGE_SIZE);

  // Replace content on tombstoned messages
  const result = page.map((msg) => {
    if (msg.deleted_at) {
      return {
        ...msg,
        content:
          msg.deleted_by === "admin"
            ? "This message was deleted by admin"
            : "This message was deleted",
        mentioned_user_ids: [],
      };
    }
    return msg;
  });

  return NextResponse.json({
    messages: result,
    hasMore,
    nextCursor: hasMore ? page[page.length - 1].created_at : null,
  });
}

/**
 * POST /api/chat
 * Send a message to a competition chat.
 * Body: { competitionId, content, mentionedUserIds? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    competitionId: string;
    content: string;
    mentionedUserIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competitionId) {
    return NextResponse.json(
      { error: "competitionId is required" },
      { status: 400 }
    );
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

  // Verify membership
  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", body.competitionId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this competition" },
      { status: 403 }
    );
  }

  // Check chat is enabled
  const { data: competition } = await supabase
    .from("competitions")
    .select("chat_enabled")
    .eq("id", body.competitionId)
    .single();

  if (!competition?.chat_enabled) {
    return NextResponse.json(
      { error: "Chat is disabled for this competition" },
      { status: 403 }
    );
  }

  // Validate mentioned user IDs are actual members
  const mentionedUserIds = body.mentionedUserIds ?? [];
  if (mentionedUserIds.length > 0) {
    const { data: validMembers } = await supabase
      .from("competition_members")
      .select("user_id")
      .eq("competition_id", body.competitionId)
      .in("user_id", mentionedUserIds);

    const validIds = (validMembers ?? []).map((m) => m.user_id);
    if (validIds.length !== mentionedUserIds.length) {
      return NextResponse.json(
        { error: "Some mentioned users are not members of this competition" },
        { status: 400 }
      );
    }
  }

  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({
      competition_id: body.competitionId,
      user_id: user.id,
      content,
      message_type: "user",
      mentioned_user_ids: mentionedUserIds,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to send message", details: error.message },
      { status: 500 }
    );
  }

  // Fire-and-forget: push notifications for @mentions
  if (mentionedUserIds.length > 0) {
    const { data: sender } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const senderName = sender?.display_name ?? "Someone";
    const preview =
      content.length > 80 ? content.slice(0, 77) + "..." : content;

    for (const mentionedId of mentionedUserIds) {
      if (mentionedId === user.id) continue; // don't notify yourself
      sendPushToUser(
        mentionedId,
        {
          title: `${senderName} mentioned you`,
          body: preview,
          url: `/wc/leaderboard`,
          tag: `chat-mention-${message!.id}`,
        },
        "chat_mentions"
      ).catch(() => {}); // swallow errors — best effort
    }
  }

  return NextResponse.json({ message }, { status: 201 });
}
