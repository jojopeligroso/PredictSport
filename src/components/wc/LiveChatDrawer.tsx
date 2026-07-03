"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { useRealtimeChat } from "@/components/chat/useRealtimeChat";

interface LiveChatDrawerProps {
  competitionId: string;
  currentUserId: string;
  currentUserRole: string;
  memberCount: number;
  /** Last chat message from server for the collapsed teaser */
  lastMessage: {
    senderName: string;
    senderAvatar: string | null;
    content: string;
  } | null;
  /** Full-height expansion for the live view (70vh vs the default 42vh mini). */
  tall?: boolean;
}

const DRAWER_MESSAGES = 8;
const DRAWER_MESSAGES_TALL = 40;
const GROUP_WINDOW_MS = 10 * 60 * 1000;

/**
 * LiveChatDrawer — inline mini-chat for the dashboard during live mode.
 *
 * Collapsed: 48px teaser row with last message preview + unread badge.
 * Expanded: ~40vh mini-chat with last 8 messages + single-line input.
 *
 * Key design decisions (avoiding old ChatWidget mistakes):
 * - Self-contained component, not inlined in DashboardClient
 * - Only activates useRealtimeChat when expanded (no polling when collapsed)
 * - Inline in dashboard flow (not fixed/overlay) so user can see match cards above
 * - Single-line input (not textarea) — keep it simple
 * - No media upload, no mention autocomplete — mini experience
 */
export function LiveChatDrawer({
  competitionId,
  currentUserId,
  currentUserRole,
  memberCount,
  lastMessage,
  tall = false,
}: LiveChatDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  return expanded ? (
    <ExpandedDrawer
      competitionId={competitionId}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      memberCount={memberCount}
      tall={tall}
      onCollapse={() => setExpanded(false)}
    />
  ) : (
    <CollapsedTeaser
      lastMessage={lastMessage}
      onExpand={() => setExpanded(true)}
    />
  );
}

/* ── Collapsed Teaser ───────────────────────────────────────────────── */

function CollapsedTeaser({
  lastMessage,
  onExpand,
}: {
  lastMessage: LiveChatDrawerProps["lastMessage"];
  onExpand: () => void;
}) {
  if (!lastMessage) return null;

  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center gap-3 rounded-xl border border-ps-border border-l-2 border-l-ps-amber bg-ps-surface px-3 py-2"
      style={{ height: 48 }}
    >
      {/* Avatar */}
      {lastMessage.senderAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lastMessage.senderAvatar}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ps-chip text-xs font-bold text-ps-text-sec">
          {lastMessage.senderName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Message preview */}
      <div className="min-w-0 flex-1 text-left">
        <span className="text-xs font-semibold text-ps-text">
          {lastMessage.senderName}
        </span>
        <p className="truncate text-xs text-ps-text-sec">
          {lastMessage.content.length > 55
            ? lastMessage.content.slice(0, 52) + "..."
            : lastMessage.content}
        </p>
      </div>

      {/* Chevron up */}
      <svg
        className="h-4 w-4 shrink-0 text-ps-text-ter"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 15l7-7 7 7"
        />
      </svg>
    </button>
  );
}

/* ── Expanded Drawer ────────────────────────────────────────────────── */

function ExpandedDrawer({
  competitionId,
  currentUserId,
  currentUserRole,
  memberCount,
  tall,
  onCollapse,
}: {
  competitionId: string;
  currentUserId: string;
  currentUserRole: string;
  memberCount: number;
  tall: boolean;
  onCollapse: () => void;
}) {
  const {
    messages,
    members,
    isLoading,
    sendMessage,
    deleteMessage,
    editMessage,
    isSending,
    mutedUntil,
  } = useRealtimeChat({ competitionId, currentUserId, mode: "mini" });

  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  const isMuted = mutedUntil ? new Date(mutedUntil) > new Date() : false;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCount.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Show last N social messages — user chat + reckons, never the system
  // activity feed (mirrors the "Chat" tab on /wc/chat and the teaser query).
  const displayMessages = messages
    .filter(
      (m) => m.message_type === "user" || m.message_type === "system_reckons",
    )
    .slice(-(tall ? DRAWER_MESSAGES_TALL : DRAWER_MESSAGES));

  // Compute grouping: consecutive messages from same sender within 10 min
  const groupPositions = displayMessages.map((msg, i) => {
    const prev = i > 0 ? displayMessages[i - 1] : null;
    const next = i < displayMessages.length - 1 ? displayMessages[i + 1] : null;

    const canGroupWith = (a: typeof msg, b: typeof msg) =>
      a.user_id === b.user_id &&
      a.message_type !== "system" &&
      b.message_type !== "system" &&
      !a.deleted_at &&
      !b.deleted_at &&
      Math.abs(
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ) <= GROUP_WINDOW_MS;

    const isFirstInGroup = !prev || !canGroupWith(prev, msg);
    const isLastInGroup = !next || !canGroupWith(msg, next);

    return { isFirstInGroup, isLastInGroup };
  });

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isSending) return;
    setInputValue("");
    try {
      await sendMessage({ content });
    } catch {
      setInputValue(content); // restore on failure
    }
  }, [inputValue, isSending, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div
      className="rounded-xl border border-ps-border border-l-2 border-l-ps-amber bg-ps-surface overflow-hidden"
      style={{ height: tall ? "min(70vh, 560px)" : "min(42vh, 330px)" }}
    >
      {/* Header bar — 36px */}
      <div className="flex items-center justify-between border-b border-ps-border px-3" style={{ height: 36 }}>
        <span className="text-xs font-semibold uppercase tracking-wider text-ps-text-sec">
          Chat
        </span>
        <div className="flex items-center gap-2">
          <span className="text-micro text-ps-text-ter">
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={onCollapse}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ps-text-sec transition-colors hover:bg-ps-bg-alt hover:text-ps-text"
            aria-label="Close chat drawer"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Message list — fills remaining space minus header (36px) and input (56px) */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden px-3 py-1.5"
        style={{ height: "calc(100% - 36px - 56px)" }}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-micro text-ps-text-ter">Loading...</span>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-micro text-ps-text-ter">
              No messages yet. Say something.
            </span>
          </div>
        ) : (
          displayMessages.map((msg, i) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              members={members}
              isFirstInGroup={groupPositions[i].isFirstInGroup}
              isLastInGroup={groupPositions[i].isLastInGroup}
              onDelete={deleteMessage}
              onEdit={editMessage}
            />
          ))
        )}
      </div>

      {/* Input bar — 56px */}
      <div className="border-t border-ps-border px-3 py-2" style={{ height: 56 }}>
        {isMuted ? (
          <div className="flex h-full items-center justify-center text-micro italic text-ps-text-ter">
            You are muted.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={2000}
              className="flex-1 rounded-xl border border-ps-border bg-ps-bg px-3 py-1.5 text-sm text-ps-text placeholder:text-ps-text-ter focus:outline-none focus:ring-1 focus:ring-ps-amber"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending}
              className="rounded-xl bg-ps-amber px-3 py-1.5 text-sm font-bold text-ps-bg hover:opacity-90 disabled:opacity-40"
            >
              {isSending ? "..." : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
