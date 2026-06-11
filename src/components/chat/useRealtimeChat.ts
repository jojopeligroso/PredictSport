"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import type { ChatMessage } from "@/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseChatMember {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
}

interface ReplyPreview {
  id: string;
  display_name: string;
  content: string;
  media_type: string | null;
}

interface ChatMessageWithUser extends ChatMessage {
  display_name: string;
  avatar_url: string | null;
  reply_preview: ReplyPreview | null;
}

interface UseRealtimeChatOptions {
  competitionId: string;
  currentUserId: string;
  /** Mini mode only shows recent messages; full mode supports pagination */
  mode?: "mini" | "full";
}

interface SendMessageOptions {
  content: string;
  mentionedUserIds?: string[];
  replyToId?: string;
  mediaUrl?: string;
  mediaType?: "image" | "gif";
}

interface UseRealtimeChatReturn {
  messages: ChatMessageWithUser[];
  members: UseChatMember[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (options: SendMessageOptions) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  muteUser: (competitionId: string, userId: string) => Promise<{ error?: string; muted_until?: string }>;
  uploadMedia: (file: File) => Promise<{ url: string; mediaType: "image" | "gif" }>;
  isSending: boolean;
  /** Current user's muted_until timestamp (null if not muted) */
  mutedUntil: string | null;
}

const PAGE_SIZE = 50;
export const MINI_SIZE = 20;

/** Tombstone content for deleted messages */
function tombstoneContent(msg: ChatMessage, t: (k: string) => string): string {
  if (!msg.deleted_at) return msg.content;
  if (msg.deleted_by === "admin") return t("chat.deleted_by_admin");
  if (msg.deleted_by === "mod") return t("chat.deleted_by_mod");
  return t("chat.deleted");
}

export function useRealtimeChat({
  competitionId,
  currentUserId,
  mode = "full",
}: UseRealtimeChatOptions): UseRealtimeChatReturn {
  const t = useT();
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [members, setMembers] = useState<UseChatMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const latestTimestampRef = useRef<string | null>(null);
  const supabase = createClient();

  // Build a user lookup from members
  const memberMap = useRef<Map<string, UseChatMember>>(new Map());

  const resolveUser = useCallback(
    (userId: string): { display_name: string; avatar_url: string | null } => {
      const m = memberMap.current.get(userId);
      return m
        ? { display_name: m.display_name, avatar_url: m.avatar_url }
        : { display_name: t("chat.unknown_user"), avatar_url: null };
    },
    [t]
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

  /** Build reply preview for a message by looking up the parent in a batch of messages */
  const buildReplyPreview = useCallback(
    (msg: ChatMessage, allMessages: ChatMessage[]): ReplyPreview | null => {
      if (!msg.reply_to_id) return null;
      const parent = allMessages.find((m) => m.id === msg.reply_to_id);
      if (!parent) return null;
      const parentUser = resolveUser(parent.user_id);
      return {
        id: parent.id,
        display_name: parentUser.display_name,
        content: parent.deleted_at
          ? t("chat.deleted")
          : parent.content.length > 80
            ? parent.content.slice(0, 77) + "..."
            : parent.content,
        media_type: parent.media_type ?? null,
      };
    },
    [resolveUser, t]
  );

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

        // For reply previews, also fetch any referenced parent messages not in this page
        const replyIds = page
          .filter((m) => m.reply_to_id)
          .map((m) => m.reply_to_id as string)
          .filter((id) => !page.some((m) => m.id === id));

        let parentMessages: ChatMessage[] = [];
        if (replyIds.length > 0) {
          const { data: parents } = await supabase
            .from("chat_messages")
            .select("*")
            .in("id", replyIds);
          parentMessages = parents ?? [];
        }

        const allForLookup = [...page, ...parentMessages];

        const enriched: ChatMessageWithUser[] = page.map((msg) => {
          const user = resolveUser(msg.user_id);
          return {
            ...msg,
            content: tombstoneContent(msg, t),
            mentioned_user_ids: msg.deleted_at ? [] : msg.mentioned_user_ids,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            reply_preview: buildReplyPreview(msg, allForLookup),
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
          // Build reply preview from existing messages in state
          let replyPreview: ReplyPreview | null = null;
          if (msg.reply_to_id) {
            setMessages((prev) => {
              const parent = prev.find((m) => m.id === msg.reply_to_id);
              if (parent) {
                replyPreview = {
                  id: parent.id,
                  display_name: parent.display_name,
                  content: parent.deleted_at
                    ? t("chat.deleted")
                    : parent.content.length > 80
                      ? parent.content.slice(0, 77) + "..."
                      : parent.content,
                  media_type: parent.media_type ?? null,
                };
              }
              const enriched: ChatMessageWithUser = {
                ...msg,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                reply_preview: replyPreview,
              };
              return prev.some((m) => m.id === msg.id) ? prev : [...prev, enriched];
            });
            return;
          }
          const enriched: ChatMessageWithUser = {
            ...msg,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            reply_preview: null,
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
                    content: tombstoneContent(updated, t),
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

  // Track latest message timestamp for polling
  useEffect(() => {
    if (messages.length > 0) {
      latestTimestampRef.current = messages[messages.length - 1].created_at;
    }
  }, [messages]);

  // Polling fallback — fetch new messages every 5s (realtime is unreliable)
  useEffect(() => {
    if (memberMap.current.size === 0) return;

    const poll = async () => {
      // Skip polling when tab is hidden
      if (document.hidden) return;

      const since = latestTimestampRef.current;
      let query = supabase
        .from("chat_messages")
        .select("*")
        .eq("competition_id", competitionId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (since) {
        query = query.gt("created_at", since);
      } else {
        // No messages yet — fetch the latest batch
        query = supabase
          .from("chat_messages")
          .select("*")
          .eq("competition_id", competitionId)
          .order("created_at", { ascending: false })
          .limit(mode === "mini" ? MINI_SIZE : PAGE_SIZE);
      }

      const { data } = await query;
      if (!data || data.length === 0) return;

      // For the "no since" case, reverse to oldest-first
      const sorted = since ? data : [...data].reverse();

      setMessages((prev) => {
        const allForLookup = [...prev, ...sorted];
        const enriched: ChatMessageWithUser[] = sorted.map((msg) => {
          const u = resolveUser(msg.user_id);
          return {
            ...msg,
            content: tombstoneContent(msg, t),
            mentioned_user_ids: msg.deleted_at ? [] : msg.mentioned_user_ids,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            reply_preview: buildReplyPreview(msg, allForLookup),
          };
        });
        const existingIds = new Set(prev.map((m) => m.id));
        const newMsgs = enriched.filter((m) => !existingIds.has(m.id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs];
      });
    };

    const interval = setInterval(poll, mode === "mini" ? 5000 : 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, mode, members]);

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

      setMessages((prev) => {
        const allForLookup = [...page, ...prev];
        const enriched: ChatMessageWithUser[] = page.map((msg) => {
          const u = resolveUser(msg.user_id);
          return {
            ...msg,
            content: tombstoneContent(msg, t),
            mentioned_user_ids: msg.deleted_at ? [] : msg.mentioned_user_ids,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            reply_preview: buildReplyPreview(msg, allForLookup),
          };
        });
        return [...enriched.reverse(), ...prev];
      });
      setHasMore(hasMoreResults);
    }
  }, [competitionId, hasMore, messages, resolveUser, supabase, buildReplyPreview, t]);

  // Send message — add to state immediately on success (don't rely on realtime)
  const sendMessage = useCallback(
    async (options: SendMessageOptions) => {
      setIsSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitionId,
            content: options.content,
            mentionedUserIds: options.mentionedUserIds ?? [],
            replyToId: options.replyToId ?? undefined,
            mediaUrl: options.mediaUrl ?? undefined,
            mediaType: options.mediaType ?? undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t("chat.error_send_message"));
        }

        const { message: saved } = await res.json();
        if (saved) {
          const user = resolveUser(saved.user_id);
          // Build reply preview from current messages
          let replyPrev: ReplyPreview | null = null;
          if (saved.reply_to_id) {
            setMessages((prev) => {
              const parent = prev.find((m) => m.id === saved.reply_to_id);
              if (parent) {
                replyPrev = {
                  id: parent.id,
                  display_name: parent.display_name,
                  content: parent.deleted_at
                    ? t("chat.deleted")
                    : parent.content.length > 80
                      ? parent.content.slice(0, 77) + "..."
                      : parent.content,
                  media_type: parent.media_type ?? null,
                };
              }
              const enriched: ChatMessageWithUser = {
                ...saved,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                reply_preview: replyPrev,
              };
              return prev.some((m) => m.id === saved.id) ? prev : [...prev, enriched];
            });
          } else {
            const enriched: ChatMessageWithUser = {
              ...saved,
              display_name: user.display_name,
              avatar_url: user.avatar_url,
              reply_preview: null,
            };
            // Add immediately; realtime INSERT will be deduped
            setMessages((prev) =>
              prev.some((m) => m.id === saved.id) ? prev : [...prev, enriched]
            );
          }
        }
      } finally {
        setIsSending(false);
      }
    },
    [competitionId, resolveUser, t]
  );

  // Upload media to Supabase Storage
  const uploadMedia = useCallback(
    async (file: File): Promise<{ url: string; mediaType: "image" | "gif" }> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("competitionId", competitionId);

      const res = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("chat.error_upload"));
      }

      return res.json();
    },
    [competitionId, t]
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
                  content: t("chat.deleted"),
                  deleted_at: new Date().toISOString(),
                  deleted_by: "user",
                  mentioned_user_ids: [],
                }
              : m
          )
        );
      }
    }
  }, [t]);

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
    uploadMedia,
    isSending,
    mutedUntil,
  };
}

export type { ChatMessageWithUser, UseChatMember, ReplyPreview };
