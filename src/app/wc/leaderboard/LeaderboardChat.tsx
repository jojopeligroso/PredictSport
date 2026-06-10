"use client";

import { useEffect } from "react";
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
  // Mark chat as seen when viewing the leaderboard
  useEffect(() => {
    try {
      localStorage.setItem("chat-last-seen", new Date().toISOString());
    } catch { /* ignore */ }
  }, []);

  return (
    <ChatWidget
      competitionId={competitionId}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      mode="full"
    />
  );
}
