"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseChatMember {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface ChatMessageWithUser extends ChatMessage {
  display_name: string;
  avatar_url: string | null;
}

interface UseRealtimeChatOptions {
  competitionId: string;
  /** Mini mode only shows recent messages; full mode supports pagination */
  mode?: "mini" | "full";
}

interface UseRealtimeChatReturn {
  messages: ChatMessageWithUser[];
  members: UseChatMember[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (content: string, mentionedUserIds?: string[]) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  isSending: boolean;
}

const PAGE_SIZE = 50;
const MINI_SIZE = 5;

/** Tombstone content for deleted messages */
function tombstoneContent(msg: ChatMessage): string {
  if (!msg.deleted_at) return msg.content;
  return msg.deleted_by === "admin"
    ? "This message was deleted by admin"
    : "This message was deleted";
}

export function useRealtimeChat({
  competitionId,
  mode = "full",
}: UseRealtimeChatOptions): UseRealtimeChatReturn {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [members, setMembers] = useState<UseChatMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  // Build a user lookup from members
  const memberMap = useRef<Map<string, UseChatMember>>(new Map());

  const resolveUser = useCallback(
    (userId: string): { display_name: string; avatar_url: string | null } => {
      const m = memberMap.current.get(userId);
      return m
        ? { display_name: m.display_name, avatar_url: m.avatar_url }
        : { display_name: "Unknown", avatar_url: null };
    },
    []
  );

  // Fetch members
  useEffect(() => {
    async function fetchMembers() {
      const { data } = await supabase
        .from("competition_members")
        .select("user_id, users!inner(display_name, avatar_url)")
        .eq("competition_id", competitionId);

      if (data) {
        const mapped: UseChatMember[] = data.map((row) => {
          const u = row.users as unknown as {
            display_name: string;
            avatar_url: string | null;
          };
          return {
            user_id: row.user_id,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
          };
        });
        memberMap.current = new Map(mapped.map((m) => [m.user_id, m]));
        setMembers(mapped);
      }
    }

    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  // Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
      setIsLoading(true);
      const limit = mode === "mini" ? MINI_SIZE : PAGE_SIZE;

      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("competition_id", competitionId)
        .order("created_at", { ascending: false })
        .limit(limit + 1);

      if (data) {
        const hasMoreResults = data.length > limit;
        const page = data.slice(0, limit);

        const enriched: ChatMessageWithUser[] = page.map((msg) => {
          const user = resolveUser(msg.user_id);
          return {
            ...msg,
            content: tombstoneContent(msg),
            mentioned_user_ids: msg.deleted_at ? [] : msg.mentioned_user_ids,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
          };
        });

        // Reverse so oldest is first (chat reads top-to-bottom)
        setMessages(enriched.reverse());
        setHasMore(hasMoreResults);
      }
      setIsLoading(false);
    }

    // Wait for members to load first
    if (memberMap.current.size > 0) {
      fetchMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, mode, members]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${competitionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          const user = resolveUser(msg.user_id);
          const enriched: ChatMessageWithUser = {
            ...msg,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
          };
          setMessages((prev) => [...prev, enriched]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    content: tombstoneContent(updated),
                    updated_at: updated.updated_at,
                    deleted_at: updated.deleted_at,
                    deleted_by: updated.deleted_by,
                    mentioned_user_ids: updated.deleted_at
                      ? []
                      : updated.mentioned_user_ids,
                  }
                : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, resolveUser]);

  // Load more (pagination — full mode only)
  const loadMore = useCallback(async () => {
    if (!hasMore || messages.length === 0) return;

    const oldest = messages[0];
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("competition_id", competitionId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (data) {
      const hasMoreResults = data.length > PAGE_SIZE;
      const page = data.slice(0, PAGE_SIZE);

      const enriched: ChatMessageWithUser[] = page.map((msg) => {
        const user = resolveUser(msg.user_id);
        return {
          ...msg,
          content: tombstoneContent(msg),
          mentioned_user_ids: msg.deleted_at ? [] : msg.mentioned_user_ids,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        };
      });

      // Prepend older messages (reversed so oldest-first)
      setMessages((prev) => [...enriched.reverse(), ...prev]);
      setHasMore(hasMoreResults);
    }
  }, [competitionId, hasMore, messages, resolveUser, supabase]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, mentionedUserIds?: string[]) => {
      setIsSending(true);
      try {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitionId,
            content,
            mentionedUserIds: mentionedUserIds ?? [],
          }),
        });
      } finally {
        setIsSending(false);
      }
    },
    [competitionId]
  );

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    await fetch(`/api/chat/${messageId}`, { method: "DELETE" });
  }, []);

  // Edit message
  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      await fetch(`/api/chat/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    },
    []
  );

  return {
    messages,
    members,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
    deleteMessage,
    editMessage,
    isSending,
  };
}

export type { ChatMessageWithUser, UseChatMember };
