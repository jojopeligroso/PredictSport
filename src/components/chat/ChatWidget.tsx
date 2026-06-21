"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage } from "./ChatMessage";
import { MentionAutocomplete, findAtTrigger } from "./MentionAutocomplete";
import { useRealtimeChat, MINI_SIZE } from "./useRealtimeChat";
import type { ChatMessageWithUser } from "./useRealtimeChat";
import { useT } from "@/lib/i18n";

const MAX_IMAGE_DIMENSION = 1200;
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Compress an image file client-side using canvas (skips GIFs to preserve animation) */
async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        resolve(file);
        return;
      }

      const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            resolve(file);
          }
        },
        file.type,
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

interface ChatWidgetProps {
  competitionId: string;
  currentUserId: string;
  currentUserRole: string;
  mode: "mini" | "full";
}

export function ChatWidget({
  competitionId,
  currentUserId,
  currentUserRole,
  mode,
}: ChatWidgetProps) {
  const t = useT();
  const {
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
  } = useRealtimeChat({ competitionId, currentUserId, mode });

  const [inputValue, setInputValue] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessageWithUser | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessageCount = useRef(0);

  const autosizeInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 5 * 24; // ~5 lines at line-height 24px; overflow scrolls internally
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);

  useEffect(() => {
    autosizeInput();
  }, [inputValue, replyTo, mediaPreview, autosizeInput]);

  // Compute mute remaining time
  const isMuted = mutedUntil ? new Date(mutedUntil) > new Date() : false;
  const muteRemainingMin = isMuted
    ? Math.ceil((new Date(mutedUntil!).getTime() - Date.now()) / 60000)
    : 0;

  const handleMuteUser = useCallback(
    async (userId: string) => {
      const result = await muteUser(competitionId, userId);
      if (result.error) {
        setMuteError(result.error);
        setTimeout(() => setMuteError(null), 3000);
      }
    },
    [competitionId, muteUser]
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCount.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setInputValue(val);
    setCursorPosition(pos);

    // Check if we should show mention autocomplete
    const atIdx = findAtTrigger(val, pos);
    setShowMentions(atIdx >= 0);
  };

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (displayName: string, atIndex: number) => {
      const before = inputValue.slice(0, atIndex);
      const after = inputValue.slice(cursorPosition);
      const newValue = `${before}@${displayName} ${after}`;
      setInputValue(newValue);
      setShowMentions(false);

      // Focus and set cursor after the inserted mention
      setTimeout(() => {
        if (inputRef.current) {
          const newPos = atIndex + displayName.length + 2; // @name + space
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPos, newPos);
          setCursorPosition(newPos);
        }
      }, 0);
    },
    [inputValue, cursorPosition]
  );

  // Extract mentioned user IDs from message text
  const extractMentionedUserIds = useCallback(
    (text: string): string[] => {
      const ids: string[] = [];
      for (const member of members) {
        if (text.includes(`@${member.display_name}`)) {
          ids.push(member.user_id);
        }
      }
      return ids;
    },
    [members]
  );

  // Handle reply
  const handleReply = useCallback((msg: ChatMessageWithUser) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  }, []);

  // Scroll to a specific message
  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = scrollRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight
      el.classList.add("bg-ps-amber/10");
      setTimeout(() => el.classList.remove("bg-ps-amber/10"), 1500);
    }
  }, []);

  // Validate and stage a media file (shared by file input and paste)
  const stageMediaFile = useCallback(async (file: File) => {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
      setSendError(t('chat.error_file_type'));
      setTimeout(() => setSendError(null), 4000);
      return;
    }

    const maxSize = file.type === "image/gif" ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setSendError(file.type === "image/gif" ? t('chat.error_gif_size') : t('chat.error_image_size'));
      setTimeout(() => setSendError(null), 4000);
      return;
    }

    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setMediaPreview({ file: compressed, url: previewUrl });
  }, [t]);

  // Handle file selection from file input
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    stageMediaFile(file);
  }, [stageMediaFile]);

  // Handle paste — extract image from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) stageMediaFile(file);
        return;
      }
    }
  }, [stageMediaFile]);

  // Clear media preview
  const clearMedia = useCallback(() => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview.url);
      setMediaPreview(null);
    }
  }, [mediaPreview]);

  // Send message
  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content && !mediaPreview) return;
    if (isSending || isUploading) return;

    const mentionedIds = extractMentionedUserIds(content);
    const currentReplyTo = replyTo;
    const currentMedia = mediaPreview;

    setInputValue("");
    setShowMentions(false);
    setSendError(null);
    setReplyTo(null);
    setMediaPreview(null);

    try {
      let mediaUrl: string | undefined;
      let mediaType: "image" | "gif" | undefined;

      // Upload media first if present
      if (currentMedia) {
        setIsUploading(true);
        try {
          const result = await uploadMedia(currentMedia.file);
          mediaUrl = result.url;
          mediaType = result.mediaType;
        } finally {
          setIsUploading(false);
          URL.revokeObjectURL(currentMedia.url);
        }
      }

      await sendMessage({
        content,
        mentionedUserIds: mentionedIds,
        replyToId: currentReplyTo?.id,
        mediaUrl,
        mediaType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('chat.error_send');
      setSendError(msg);
      setInputValue(content); // restore input so user can retry
      setReplyTo(currentReplyTo); // restore reply target
      setTimeout(() => setSendError(null), 4000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let mention autocomplete handle arrow/enter/tab when visible
    if (showMentions && ["ArrowDown", "ArrowUp", "Tab"].includes(e.key)) {
      return; // MentionAutocomplete handles these via its own onKeyDown
    }

    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }

    // Escape clears reply
    if (e.key === "Escape" && replyTo) {
      setReplyTo(null);
    }
  };

  // Mini mode: show limited messages
  const displayMessages =
    mode === "mini" ? messages.slice(-MINI_SIZE) : messages;

  // Date separator key — local YYYY-MM-DD
  const localDateKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatDateSeparator = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return t('chat.date_today');
    if (diffDays === 1) return t('chat.date_yesterday');
    // Same year: "Mon 9 Jun" — different year: include year
    const opts: Intl.DateTimeFormatOptions =
      d.getFullYear() === now.getFullYear()
        ? { weekday: "short", day: "numeric", month: "short" }
        : { day: "numeric", month: "short", year: "numeric" };
    return d.toLocaleDateString(undefined, opts);
  };

  // Compute grouping: consecutive messages from the same sender within 10 min
  const GROUP_WINDOW_MS = 10 * 60 * 1000;
  const groupPositions = displayMessages.map((msg, i) => {
    const prev = i > 0 ? displayMessages[i - 1] : null;
    const next = i < displayMessages.length - 1 ? displayMessages[i + 1] : null;

    const canGroupWith = (a: typeof msg, b: typeof msg) =>
      a.user_id === b.user_id &&
      a.message_type !== "system" &&
      b.message_type !== "system" &&
      !a.deleted_at &&
      !b.deleted_at &&
      Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) <= GROUP_WINDOW_MS;

    const isFirstInGroup = !prev || !canGroupWith(prev, msg);
    const isLastInGroup = !next || !canGroupWith(msg, next);

    return { isFirstInGroup, isLastInGroup };
  });

  if (isLoading) {
    return (
      <div className={`${mode === "full" ? "h-[75vh]" : ""} flex items-center justify-center`}>
        <span className="text-xs text-ps-text-ter">{t('chat.loading')}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden ${
        mode === "full" ? "h-full" : "max-h-[480px]"
      }`}
    >
      {/* Header (full mode only — mini mode header is provided by parent) */}
      {mode === "full" && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-ps-border">
          <span className="text-xs font-semibold text-ps-text-sec">
            {t('chat.header')}
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
      >
        {/* Load more button (full mode) */}
        {mode === "full" && hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              className="text-xs text-ps-amber font-semibold hover:underline"
            >
              {t('chat.load_older')}
            </button>
          </div>
        )}

        {displayMessages.length === 0 ? (
          <div className={`flex items-center justify-center ${mode === "mini" ? "py-4" : "h-full"}`}>
            <p className="text-xs text-ps-text-ter">
              {t('chat.empty')}
            </p>
          </div>
        ) : (
          displayMessages.map((msg, i) => {
            const prev = i > 0 ? displayMessages[i - 1] : null;
            const showDateSeparator =
              !prev || localDateKey(prev.created_at) !== localDateKey(msg.created_at);
            return (
              <div key={msg.id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-micro uppercase tracking-wide text-ps-text-ter">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <ChatMessage
                  message={msg}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  members={members}
                  isFirstInGroup={groupPositions[i].isFirstInGroup}
                  isLastInGroup={groupPositions[i].isLastInGroup}
                  onDelete={deleteMessage}
                  onEdit={editMessage}
                  onMute={handleMuteUser}
                  onReply={handleReply}
                  onScrollToMessage={handleScrollToMessage}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="relative border-t border-ps-border px-3 py-2">
        {(sendError || muteError) && (
          <div className="mb-2 rounded-lg bg-ps-red/10 px-3 py-1.5 text-xs text-ps-red">
            {sendError || muteError}
          </div>
        )}

        {isMuted ? (
          <div className="text-center py-1.5 text-xs text-ps-text-ter italic">
            {t('chat.muted', { minutes: muteRemainingMin })}
          </div>
        ) : (
          <>
            {showMentions && (
              <MentionAutocomplete
                members={members.filter((m) => m.user_id !== currentUserId)}
                inputValue={inputValue}
                cursorPosition={cursorPosition}
                onSelect={handleMentionSelect}
                onClose={() => setShowMentions(false)}
              />
            )}

            {/* Reply preview bar */}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 rounded-lg bg-ps-chip/50 px-3 py-1.5 border-l-2 border-ps-amber">
                <div className="flex-1 min-w-0">
                  <p className="text-micro font-semibold text-ps-amber truncate">
                    {replyTo.display_name}
                  </p>
                  <p className="text-caption text-ps-text-sec truncate">
                    {replyTo.media_url
                      ? replyTo.media_type === "gif" ? t('chat.gif') : t('chat.photo')
                      : replyTo.content}
                  </p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="flex-shrink-0 text-ps-text-ter hover:text-ps-text text-sm font-bold"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Media preview */}
            {mediaPreview && (
              <div className="relative mb-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaPreview.url}
                  alt={t('chat.attach_preview')}
                  className="max-h-32 max-w-[200px] rounded-lg object-contain border border-ps-border"
                />
                <button
                  onClick={clearMedia}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ps-red text-white text-xs font-bold flex items-center justify-center shadow"
                >
                  &times;
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Media upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="self-end flex-shrink-0 rounded-xl p-1.5 text-ps-text-ter hover:text-ps-text hover:bg-ps-chip transition-colors disabled:opacity-40"
                title={t('chat.attach_button')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />

              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onSelect={(e) =>
                  setCursorPosition(
                    (e.target as HTMLTextAreaElement).selectionStart ?? 0
                  )
                }
                placeholder={replyTo ? t('chat.placeholder_reply') : t('chat.placeholder')}
                maxLength={2000}
                className="flex-1 resize-none overflow-y-auto rounded-xl border border-ps-border bg-ps-bg px-3 py-1.5 text-sm leading-6 text-ps-text placeholder:text-ps-text-ter focus:outline-none focus:ring-1 focus:ring-ps-amber"
              />
              <button
                onClick={handleSend}
                disabled={(!inputValue.trim() && !mediaPreview) || isSending || isUploading}
                className="self-end rounded-xl bg-ps-amber px-3 py-1.5 text-sm font-bold text-ps-bg hover:opacity-90 disabled:opacity-40 tap-target"
              >
                {isUploading ? "..." : isSending ? "..." : t('chat.send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
