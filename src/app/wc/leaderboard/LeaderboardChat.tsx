"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatWidget } from "@/components/chat";

interface LeaderboardChatProps {
  competitionId: string;
  currentUserId: string;
  currentUserRole: string;
}

export function LeaderboardChat({
  competitionId,
  currentUserId,
  currentUserRole,
}: LeaderboardChatProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mark chat as seen when viewing the leaderboard
  useEffect(() => {
    try {
      localStorage.setItem("chat-last-seen", new Date().toISOString());
    } catch { /* ignore */ }
  }, []);

  // Collapse when clicking outside
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setExpanded(false);
      }
    },
    [],
  );

  // Expand when user scrolls up within the chat (reading older messages)
  const handleScroll = useCallback(() => {
    if (!expanded) setExpanded(true);
  }, [expanded]);

  return (
    <div
      ref={containerRef}
      onFocus={() => setExpanded(true)}
      onBlur={handleBlur}
      onScroll={handleScroll}
      className={`flex flex-col transition-[height] duration-300 ease-out ${
        expanded ? "h-[80vh]" : "h-[280px]"
      }`}
    >
      <ChatWidget
        competitionId={competitionId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        mode="full"
      />
    </div>
  );
}
