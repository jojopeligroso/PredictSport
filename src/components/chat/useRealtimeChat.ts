"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseChatMember {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

interface ChatMessageWithUser extends ChatMessage {
  display_name: string;
  avatar_url: string | null;
}

interface UseRealtimeChatOptions {
  competitionId: string;
  currentUserId: string;
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
  muteUser: (competitionId: string, userId: string) => Promise<{ error?: string; muted_until?: string }>;
  isSending: boolean;
  /** Current user's muted_until timestamp (null if not muted) */
  mutedUntil: string | null;
}

const PAGE_SIZE = 50;
const MINI_SIZE = 5;

/** Tombstone content for deleted messages */
function tombstoneContent(msg: ChatMessage): string {
  if (!msg.deleted_at) return msg.content;
  if (msg.deleted_by === "admin") return "This message was deleted by admin";
  if (msg.deleted_by === "mod") return "This message was deleted by mod";
  return "This message was deleted";
}

export function useRealtimeChat({
  competitionId,
  currentUserId,
  mode = "full",
}: UseRealtimeChatOptions): UseRealtimeChatReturn {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [members, setMembers] = useState<UseChatMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
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
        .select("user_id, role, chat_muted_until, users!inner(display_name, avatar_url)")
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
            role: row.role,
          };
        });
        memberMap.current = new Map(mapped.map((m) => [m.user_id, m]));
        setMembers(mapped);

        // Track current user's mute status
        const me = data.find((r) => r.user_id === currentUserId);
        setMutedUntil(me?.chat_muted_until ?? null);
      }
    }

    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, currentUserId]);

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
          // Deduplicate: skip if already added by optimistic sendMessage
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, enriched]
          );
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

  // Send message — add to state immediately on success (don't rely on realtime)
  const sendMessage = useCallback(
    async (content: string, mentionedUserIds?: string[]) => {
      setIsSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitionId,
            content,
            mentionedUserIds: mentionedUserIds ?? [],
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to send message");
        }

        const { message: saved } = await res.json();
        if (saved) {
          const user = resolveUser(saved.user_id);
          const enriched: ChatMessageWithUser = {
            ...saved,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
          };
          // Add immediately; realtime INSERT will be deduped
          setMessages((prev) =>
            prev.some((m) => m.id === saved.id) ? prev : [...prev, enriched]
          );
        }
      } finally {
        setIsSending(false);
      }
    },
    [competitionId, resolveUser]
  );

  // Delete message — update state immediately (don't rely on realtime)
  const deleteMessage = useCallback(async (messageId: string) => {
    const res = await fetch(`/api/chat/${messageId}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      if (data.type === "hard") {
        // Remove from state
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else {
        // Soft delete — show tombstone
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: "This message was deleted",
                  deleted_at: new Date().toISOString(),
                  deleted_by: "user",
                  mentioned_user_ids: [],
                }
              : m
          )
        );
      }
    }
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

  // Mute user
  const muteUser = useCallback(
    async (cId: string, userId: string) => {
      const res = await fetch("/api/chat/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: cId, userId }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      return { muted_until: data.muted_until };
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
    muteUser,
    isSending,
    mutedUntil,
  };
}

export type { ChatMessageWithUser, UseChatMember };
