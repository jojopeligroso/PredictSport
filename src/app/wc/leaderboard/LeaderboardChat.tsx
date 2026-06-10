"use client";

import { useEffect } from "react";
import { ChatWidget } from "@/components/chat";

interface LeaderboardChatProps {
  competitionId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export function LeaderboardChat({
  competitionId,
  currentUserId,
  isAdmin,
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
      isAdmin={isAdmin}
      mode="full"
    />
  );
}
