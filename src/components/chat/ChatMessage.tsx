"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT, useLocale } from "@/lib/i18n";
import type { ChatMessageWithUser, UseChatMember, ReplyPreview } from "./useRealtimeChat";
import { TagRevealCard, type TagRevealMetadata } from "./TagRevealCard";

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
  /** First message in a sender group — show name + avatar */
  isFirstInGroup?: boolean;
  /** Last message in a sender group — show timestamp */
  isLastInGroup?: boolean;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onMute?: (userId: string) => void;
  onReply?: (message: ChatMessageWithUser) => void;
  onScrollToMessage?: (messageId: string) => void;
}

const EDIT_WINDOW_MS = 5 * 60 * 1000;

function formatMessageTime(iso: string, locale: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const intlLocale = locale === "es" ? "es-MX" : "en-GB";

  const time = date.toLocaleTimeString(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (diffDays === 0) return time;
  if (diffDays === 1) return `${locale === "es" ? "Ayer" : "Yesterday"} ${time}`;
  if (diffDays < 7) {
    const day = date.toLocaleDateString(intlLocale, { weekday: "short" });
    return `${day} ${time}`;
  }
  return date.toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "short",
  }) + ` ${time}`;
}

/** Render tag change/reject content with **bold** tag names */
function renderTagChangeContent(content: string): React.ReactNode {
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="font-bold text-ps-text-sec">
        {match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
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
  isFirstInGroup = true,
  isLastInGroup = true,
  onDelete,
  onEdit,
  onMute,
  onReply,
  onScrollToMessage,
}: ChatMessageProps) {
  const t = useT();
  const { locale } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [pressing, setPressing] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeOffset = useRef(0);
  const messageEl = useRef<HTMLDivElement>(null);
  const bubbleEl = useRef<HTMLDivElement>(null);

  const isOwn = message.user_id === currentUserId;
  const isDeleted = !!message.deleted_at;
  const isSystem = message.message_type !== "user";
  const isEdited = !!message.updated_at && !isDeleted;

  const actorRank = ROLE_RANK[currentUserRole] ?? 0;
  const targetMember = members.find((m) => m.user_id === message.user_id);
  const targetRank = ROLE_RANK[targetMember?.role ?? "participant"] ?? 0;

  const canModDelete = !isOwn && actorRank >= ROLE_RANK.mod && actorRank > targetRank;
  const messageAge = Date.now() - new Date(message.created_at).getTime();
  const HARD_DELETE_WINDOW_MS = 20 * 1000;
  const canOwnDelete = isOwn && messageAge <= HARD_DELETE_WINDOW_MS;
  const canDelete = canOwnDelete || canModDelete;
  const canMute = !isOwn && actorRank >= ROLE_RANK.mod && actorRank > targetRank;
  const canReply = !isDeleted && !isSystem && !!onReply;
  const canEdit = isOwn && !isEditing && (Date.now() - new Date(message.created_at).getTime()) <= EDIT_WINDOW_MS;
  const hasAnyAction = canReply || canEdit || canDelete || canMute || canModDelete;

  // Cancel any active long-press visual + timer
  const cancelPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setPressing(false);
  }, []);

  // Long-press handlers for context menu
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      swipeStartX.current = e.touches[0].clientX;
      if (!hasAnyAction) return;
      // Immediate visual feedback
      setPressing(true);
      longPressTimer.current = setTimeout(() => {
        setPressing(false);
        setShowContextMenu(true);
      }, 400);
    },
    [hasAnyAction]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (swipeStartX.current === null) return;
      const dx = e.touches[0].clientX - swipeStartX.current;
      // Cancel long-press on any significant move
      if (Math.abs(dx) > 10) {
        cancelPress();
      }
      // Only allow right swipe for reply (non-deleted, non-system)
      if (dx > 0 && !isDeleted && !isSystem && onReply) {
        swipeOffset.current = Math.min(dx, 80);
        if (messageEl.current) {
          messageEl.current.style.transform = `translateX(${swipeOffset.current}px)`;
          messageEl.current.style.transition = "none";
        }
      }
    },
    [isDeleted, isSystem, onReply, cancelPress]
  );

  const handleTouchEnd = useCallback(() => {
    cancelPress();
    // If swiped far enough, trigger reply
    if (swipeOffset.current >= 60 && onReply && !isDeleted && !isSystem) {
      onReply(message);
    }
    // Animate back
    if (messageEl.current) {
      messageEl.current.style.transform = "translateX(0)";
      messageEl.current.style.transition = "transform 0.2s ease-out";
    }
    swipeStartX.current = null;
    swipeOffset.current = 0;
  }, [message, onReply, isDeleted, isSystem, cancelPress]);

  // System messages — dispatch by message_type for structured rendering
  if (isSystem) {
    // Strip internal metadata tags (e.g. "[reckons:eventId] ") from display
    const systemContent = message.content.replace(/^\[reckons:[^\]]+\]\s*/, "");

    // Tag reveal: announcement text + inline TagRevealCard
    if (message.message_type === "system_tag_reveal" && message.metadata) {
      const tagMeta = message.metadata as unknown as TagRevealMetadata;
      if (!tagMeta?.factCard) {
        return (
          <div className="flex justify-center py-1">
            <span className="text-xs text-ps-text-ter italic">{systemContent}</span>
          </div>
        );
      }
      return (
        <div className="flex justify-center py-1">
          <div className="max-w-[85%]">
            <p className="text-xs text-ps-text-ter italic text-center">
              {systemContent}
            </p>
            <TagRevealCard metadata={tagMeta} />
          </div>
        </div>
      );
    }

    // Tag change: italic, secondary color, tag names in bold
    if (message.message_type === "system_tag_change") {
      return (
        <div className="flex justify-center py-1">
          <span className="text-xs text-ps-text-ter italic">
            {renderTagChangeContent(systemContent)}
          </span>
        </div>
      );
    }

    // Tag reject: centered, italic, text-xs, secondary color
    if (message.message_type === "system_tag_reject") {
      return (
        <div className="flex justify-center py-1">
          <span className="text-xs text-ps-text-ter italic">
            {renderTagChangeContent(systemContent)}
          </span>
        </div>
      );
    }

    // Round summary: rendered as system message for now (full implementation later)
    // Falls through to default system rendering below.

    // Default system message rendering
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-ps-text-ter italic">
          {systemContent}
        </span>
      </div>
    );
  }

  // Tombstone (deleted) — still show sender for attribution
  if (isDeleted) {
    return (
      <div className={`flex gap-2 py-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && (
            <p className="text-micro font-semibold text-ps-text-ter mb-0.5 ml-1">
              {message.display_name}
            </p>
          )}
          <div className="rounded-2xl px-3 py-1.5 bg-ps-chip/50">
            <p className="text-xs text-ps-text-ter italic">{message.content}</p>
          </div>
          <div className={`mt-0.5 ${isOwn ? "text-right mr-1" : "ml-1"}`}>
            <span className="text-micro text-ps-text-ter">
              {formatMessageTime(message.created_at, locale)}
            </span>
          </div>
        </div>
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

  const showName = isFirstInGroup;
  const showTimestamp = isLastInGroup;

  return (
    <>
      <div
        ref={messageEl}
        data-message-id={message.id}
        className={`group relative flex gap-2 ${isFirstInGroup ? "pt-1.5" : "pt-px"} ${isOwn ? "flex-row-reverse" : "flex-row"}`}
        style={{ touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Message bubble */}
        <div
          className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}
        >
          {/* Sender name — only on first in group */}
          {showName && (
            <p className={`truncate text-caption font-semibold text-ps-text-sec mb-0.5 ${isOwn ? "text-right mr-1" : "ml-1"}`}>
              {message.display_name}
            </p>
          )}

          <div
            ref={bubbleEl}
            className={`rounded-2xl px-3 py-1.5 text-body transition-all duration-150 ${
              pressing ? "scale-[0.97] opacity-80" : ""
            } ${
              isOwn
                ? "bg-ps-amber/15 text-ps-text"
                : "bg-ps-chip text-ps-text"
            }`}
            onContextMenu={(e) => {
              if (hasAnyAction) {
                e.preventDefault();
                setShowContextMenu(true);
              }
            }}
          >
            {/* Reply preview */}
            {message.reply_preview && (
              <button
                type="button"
                onClick={() => onScrollToMessage?.(message.reply_preview!.id)}
                className={`w-full text-left mb-1.5 rounded-lg px-2 py-1 border-l-2 border-ps-amber/60 ${
                  isOwn ? "bg-ps-amber/10" : "bg-ps-bg/50"
                }`}
              >
                <p className="text-micro font-semibold text-ps-amber truncate">
                  {message.reply_preview.display_name}
                </p>
                <p className="text-caption text-ps-text-sec truncate">
                  {message.reply_preview.media_type
                    ? message.reply_preview.media_type === "gif" ? t("chat.gif") : t("chat.photo")
                    : message.reply_preview.content}
                </p>
              </button>
            )}

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
                  {t("chat.save")}
                </button>
              </div>
            ) : (
              <>
                {/* Media content */}
                {message.media_url && !message.deleted_at && (
                  <button
                    type="button"
                    onClick={() => setShowImageLightbox(true)}
                    className="block mb-1 rounded-lg overflow-hidden max-w-[240px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.media_url}
                      alt={message.media_type === "gif" ? t("chat.gif") : t("chat.photo")}
                      className="w-full h-auto max-h-[300px] object-contain rounded-lg"
                      loading="lazy"
                    />
                  </button>
                )}

                {/* Text content */}
                {message.content && (
                  <p className="whitespace-pre-wrap break-words">
                    {renderContent(message.content)}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Action sheet rendered via portal — see bottom of component */}

          {/* Meta row: time, edited, actions — only on last in group (or when actions available) */}
          {(showTimestamp || canEdit || canDelete || canReply) && (
            <div
              className={`flex items-center gap-1.5 mt-0.5 ${
                isOwn ? "justify-end mr-1" : "ml-1"
              }`}
            >
              {showTimestamp && (
                <span className="text-micro text-ps-text-ter">
                  {formatMessageTime(message.created_at, locale)}
                </span>
              )}
              {isEdited && showTimestamp && (
                <span className="text-micro text-ps-text-ter italic">
                  {t("chat.edited")}
                </span>
              )}

              {/* Actions — visible on hover */}
              {(canEdit || canDelete || canReply) && (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {canReply && (
                    <button
                      onClick={() => onReply?.(message)}
                      className="text-micro text-ps-text-ter hover:text-ps-text"
                    >
                      {t("chat.action_reply")}
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={handleStartEdit}
                      className="text-micro text-ps-text-ter hover:text-ps-text"
                    >
                      {t("chat.action_edit")}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDelete?.(message.id)}
                      className="text-micro text-ps-text-ter hover:text-ps-red"
                    >
                      {t("chat.action_delete")}
                    </button>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action sheet (bottom drawer) — portalled to body */}
      {showContextMenu && typeof document !== "undefined" &&
        createPortal(
          <ChatActionSheet
            message={message}
            canReply={canReply}
            canEdit={canEdit}
            canDelete={canDelete}
            canMute={canMute}
            onReply={() => { setShowContextMenu(false); onReply?.(message); }}
            onEdit={() => { setShowContextMenu(false); handleStartEdit(); }}
            onDelete={() => { setShowContextMenu(false); onDelete?.(message.id); }}
            onMute={() => { setShowContextMenu(false); if (message.user_id) onMute?.(message.user_id); }}
            onDismiss={() => setShowContextMenu(false)}
          />,
          document.body
        )
      }

      {/* Image lightbox */}
      {showImageLightbox && message.media_url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImageLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold"
            onClick={() => setShowImageLightbox(false)}
          >
            &times;
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.media_url}
            alt={message.media_type === "gif" ? t("chat.gif") : t("chat.photo")}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/* ── Action Sheet (bottom drawer) ──────────────────────────────────── */

interface ChatActionSheetProps {
  message: ChatMessageWithUser;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canMute: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMute: () => void;
  onDismiss: () => void;
}

function ChatActionSheet({
  message,
  canReply,
  canEdit,
  canDelete,
  canMute,
  onReply,
  onEdit,
  onDelete,
  onMute,
  onDismiss,
}: ChatActionSheetProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  const preview = message.media_url
    ? message.media_type === "gif" ? t("chat.gif") : t("chat.photo")
    : message.content.length > 80
      ? message.content.slice(0, 80) + "..."
      : message.content;

  return (
    <div
      className="fixed inset-0 z-[90]"
      style={{ touchAction: "manipulation" }}
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ backgroundColor: visible ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0)" }}
        onClick={dismiss}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 mx-auto max-w-[480px] rounded-t-2xl border-t border-ps-border bg-ps-surface"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 250ms cubic-bezier(0.32, 0.72, 0, 1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-ps-text-ter/30" />
        </div>

        {/* Message preview */}
        <div className="mx-4 mb-2 rounded-xl bg-ps-chip/50 px-3 py-2">
          <p className="text-caption font-semibold text-ps-text-sec truncate">
            {message.display_name}
          </p>
          <p className="text-xs text-ps-text-ter truncate mt-0.5">
            {preview}
          </p>
        </div>

        {/* Action buttons */}
        <div className="px-2 pb-2">
          {canReply && (
            <ActionSheetButton
              icon={<IconReply />}
              label={t("chat.reply")}
              onClick={onReply}
            />
          )}
          {canEdit && (
            <ActionSheetButton
              icon={<IconEdit />}
              label={t("chat.action_edit")}
              onClick={onEdit}
            />
          )}
          {canDelete && (
            <ActionSheetButton
              icon={<IconTrash />}
              label={t("chat.delete_message")}
              onClick={onDelete}
              destructive
            />
          )}
          {canMute && (
            <ActionSheetButton
              icon={<IconMute />}
              label={t("chat.mute_user")}
              onClick={onMute}
              destructive
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionSheetButton({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors active:bg-ps-chip ${
        destructive ? "text-ps-red" : "text-ps-text"
      }`}
      style={{ touchAction: "manipulation", minHeight: 48 }}
    >
      <span className="flex h-5 w-5 items-center justify-center shrink-0">{icon}</span>
      {label}
    </button>
  );
}

/* ── Action Sheet Icons ────────────────────────────────────────────── */

function IconReply() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconMute() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.49-.34 2.18" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
