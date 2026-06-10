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


  return (
    <div
      ref={containerRef}
      onFocus={() => setExpanded(true)}
      onTouchStart={() => { if (!expanded) setExpanded(true); }}
      onBlur={handleBlur}
      className={`flex flex-col overflow-hidden transition-[height] duration-300 ease-out ${
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
