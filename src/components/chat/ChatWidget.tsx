"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage } from "./ChatMessage";
import { MentionAutocomplete, findAtTrigger } from "./MentionAutocomplete";
import { useRealtimeChat } from "./useRealtimeChat";

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
    isSending,
    mutedUntil,
  } = useRealtimeChat({ competitionId, currentUserId, mode });

  const [inputValue, setInputValue] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Send message
  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isSending) return;

    const mentionedIds = extractMentionedUserIds(content);
    setInputValue("");
    setShowMentions(false);
    setSendError(null);
    try {
      await sendMessage(content, mentionedIds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      setSendError(msg);
      setInputValue(content); // restore input so user can retry
      setTimeout(() => setSendError(null), 4000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Let mention autocomplete handle arrow/enter/tab when visible
    if (showMentions && ["ArrowDown", "ArrowUp", "Tab"].includes(e.key)) {
      return; // MentionAutocomplete handles these via its own onKeyDown
    }

    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mini mode: show limited messages
  const displayMessages =
    mode === "mini" ? messages.slice(-5) : messages;

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
        <span className="text-xs text-ps-text-ter">Loading chat...</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${
        mode === "full" ? "h-[80vh] max-h-[80vh]" : "max-h-72"
      }`}
    >
      {/* Header (full mode only — mini mode header is provided by parent) */}
      {mode === "full" && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-ps-border">
          <span className="text-xs font-semibold text-ps-text-sec">
            Chat
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
        {/* Load more button (full mode) */}
        {mode === "full" && hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              className="text-xs text-ps-amber font-semibold hover:underline"
            >
              Load older messages
            </button>
          </div>
        )}

        {displayMessages.length === 0 ? (
          <div className={`flex items-center justify-center ${mode === "mini" ? "py-4" : "h-full"}`}>
            <p className="text-xs text-ps-text-ter">
              No messages yet. Say something.
            </p>
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
              onMute={handleMuteUser}
            />
          ))
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
            You&apos;re muted for {muteRemainingMin} more minute{muteRemainingMin !== 1 ? "s" : ""}
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

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSelect={(e) =>
                  setCursorPosition(
                    (e.target as HTMLInputElement).selectionStart ?? 0
                  )
                }
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
          </>
        )}
      </div>
    </div>
  );
}
