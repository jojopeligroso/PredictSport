"use client";

import { useEffect } from "react";
import { ChatWidget } from "@/components/chat";
import { useUnreadChat } from "@/hooks/useUnreadChat";
import { useT } from "@/lib/i18n";

interface ChatPageClientProps {
  competitionId: string;
  competitionName: string;
  currentUserId: string;
  currentUserRole: string;
  memberCount: number;
}

export function ChatPageClient({
  competitionId,
  competitionName,
  currentUserId,
  currentUserRole,
  memberCount,
}: ChatPageClientProps) {
  const t = useT();
  const { markSeen } = useUnreadChat(null);

  // Mark chat as seen on mount
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-52px-env(safe-area-inset-bottom))] max-w-[480px] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ps-border px-4 py-3">
        <h1 className="text-sm font-bold text-ps-text">{competitionName}</h1>
        <span className="text-xs text-ps-text-ter">
          {t("chat.member_count", { count: memberCount })}
        </span>
      </div>

      {/* Chat widget fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <ChatWidget
          competitionId={competitionId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          mode="full"
        />
      </div>
    </div>
  );
}
