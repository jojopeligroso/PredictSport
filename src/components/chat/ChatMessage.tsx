"use client";

import { useState } from "react";
import Image from "next/image";
import { getInitials } from "@/lib/display-name";
import type { ChatMessageWithUser } from "./useRealtimeChat";

interface ChatMessageProps {
  message: ChatMessageWithUser;
  currentUserId: string;
  isAdmin: boolean;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
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
  isAdmin,
  onDelete,
  onEdit,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isOwn = message.user_id === currentUserId;
  const isDeleted = !!message.deleted_at;
  const isSystem = message.message_type === "system";
  const isEdited = !!message.updated_at && !isDeleted;
  const canDelete = isOwn || isAdmin;

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
      className={`group flex gap-2 py-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
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
