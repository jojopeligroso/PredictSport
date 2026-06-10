"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { getInitials } from "@/lib/display-name";
import type { ChatMessageWithUser, UseChatMember } from "./useRealtimeChat";

const ROLE_RANK: Record<string, number> = {
  participant: 0,
  mod: 1,
  co_admin: 2,
  admin: 3,
};

interface ChatMessageProps {
  message: ChatMessageWithUser;
  currentUserId: string;
  currentUserRole: string;
  members: UseChatMember[];
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onMute?: (userId: string) => void;
}

const EDIT_WINDOW_MS = 5 * 60 * 1000;

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) {
    const day = date.toLocaleDateString("en-GB", { weekday: "short" });
    return `${day} ${time}`;
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  }) + ` ${time}`;
}

/** Highlight @mentions in message content */
function renderContent(content: string): React.ReactNode {
  const mentionRegex = /@(\S+(?:\s\S+)?)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="font-semibold text-ps-amber">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

export function ChatMessage({
  message,
  currentUserId,
  currentUserRole,
  members,
  onDelete,
  onEdit,
  onMute,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwn = message.user_id === currentUserId;
  const isDeleted = !!message.deleted_at;
  const isSystem = message.message_type === "system";
  const isEdited = !!message.updated_at && !isDeleted;

  const actorRank = ROLE_RANK[currentUserRole] ?? 0;
  const targetMember = members.find((m) => m.user_id === message.user_id);
  const targetRank = ROLE_RANK[targetMember?.role ?? "participant"] ?? 0;

  const canModDelete = !isOwn && actorRank >= ROLE_RANK.mod && actorRank > targetRank;
  const canDelete = isOwn || canModDelete;
  const canMute = !isOwn && actorRank >= ROLE_RANK.mod && actorRank > targetRank;

  // Long-press handlers for context menu
  const handleTouchStart = useCallback(() => {
    if (!canMute && !canModDelete) return;
    longPressTimer.current = setTimeout(() => {
      setShowContextMenu(true);
    }, 500);
  }, [canMute, canModDelete]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // System messages
  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-ps-text-ter italic">
          {message.content}
        </span>
      </div>
    );
  }

  // Tombstone (deleted)
  if (isDeleted) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-ps-text-ter italic">
          {message.content}
        </span>
      </div>
    );
  }

  const handleEditSubmit = () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(message.id, trimmed);
    }
    setIsEditing(false);
  };

  // Check edit eligibility at click time, not render time
  const handleStartEdit = () => {
    const age = Date.now() - new Date(message.created_at).getTime();
    if (age > EDIT_WINDOW_MS) return;
    setEditContent(message.content);
    setIsEditing(true);
  };

  // Show edit button for own recent messages (rough check — actual enforcement at click + API)
  const showEditButton = isOwn && !isEditing;

  return (
    <div
      className={`group relative flex gap-2 py-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-ps-chip flex items-center justify-center">
          {message.avatar_url ? (
            <Image
              src={message.avatar_url}
              alt=""
              width={28}
              height={28}
              className="rounded-full object-cover"
            />
          ) : (
            <span className="text-[10px] font-semibold text-ps-text-sec">
              {getInitials(message.display_name)}
            </span>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}
      >
        {/* Sender name (others only) */}
        {!isOwn && (
          <p className="text-[10px] font-semibold text-ps-text-sec mb-0.5 ml-1">
            {message.display_name}
          </p>
        )}

        <div
          className={`rounded-2xl px-3 py-1.5 text-sm ${
            isOwn
              ? "bg-ps-amber/15 text-ps-text"
              : "bg-ps-chip text-ps-text"
          }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onContextMenu={(e) => {
            if (canMute || canModDelete) {
              e.preventDefault();
              setShowContextMenu(true);
            }
          }}
        >
          {isEditing ? (
            <div className="flex gap-1">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEditSubmit();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                className="flex-1 bg-transparent text-sm text-ps-text outline-none"
                autoFocus
              />
              <button
                onClick={handleEditSubmit}
                className="text-xs text-ps-amber font-semibold"
              >
                Save
              </button>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {renderContent(message.content)}
            </p>
          )}
        </div>

        {/* Context menu (long-press / right-click) */}
        {showContextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowContextMenu(false)}
            />
            <div className="absolute z-50 mt-1 rounded-lg border border-ps-border bg-ps-surface shadow-lg py-1 min-w-[140px]">
              {canModDelete && (
                <button
                  onClick={() => {
                    setShowContextMenu(false);
                    onDelete?.(message.id);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-ps-red hover:bg-ps-chip"
                >
                  Delete message
                </button>
              )}
              {canMute && (
                <button
                  onClick={() => {
                    setShowContextMenu(false);
                    onMute?.(message.user_id);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-ps-text-sec hover:bg-ps-chip"
                >
                  Mute this user
                </button>
              )}
            </div>
          </>
        )}

        {/* Meta row: time, edited, actions */}
        <div
          className={`flex items-center gap-1.5 mt-0.5 ${
            isOwn ? "justify-end mr-1" : "ml-1"
          }`}
        >
          <span className="text-[10px] text-ps-text-ter">
            {formatMessageTime(message.created_at)}
          </span>
          {isEdited && (
            <span className="text-[10px] text-ps-text-ter italic">
              (edited)
            </span>
          )}

          {/* Actions — visible on hover/group */}
          {(showEditButton || canDelete) && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              {showEditButton && (
                <button
                  onClick={handleStartEdit}
                  className="text-[10px] text-ps-text-ter hover:text-ps-text"
                >
                  edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete?.(message.id)}
                  className="text-[10px] text-ps-text-ter hover:text-ps-red"
                >
                  delete
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
