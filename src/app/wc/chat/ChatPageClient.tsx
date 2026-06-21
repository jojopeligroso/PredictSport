"use client";

import { useEffect } from "react";
import Link from "next/link";
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

const LEADERBOARD_PILLS = [
  { tab: "overall", labelKey: "classification.overall_label" },
  { tab: "format", labelKey: "classification.format_label" },
  { tab: "rivals", labelKey: "rivals.tab_label" },
] as const;

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
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-56px-env(safe-area-inset-bottom))] max-w-[480px] flex-col">
      {/* Classification pills → leaderboard */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2.5">
        {LEADERBOARD_PILLS.map(({ tab, labelKey }) => (
          <Link
            key={tab}
            href={`/wc/leaderboard?tab=${tab}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ps-surface px-3 py-1.5 text-xs font-semibold text-ps-text-sec transition-colors hover:bg-ps-amber hover:text-ps-text"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 19.24 7 20v2" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 19.24 17 20v2" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            {t(labelKey)}
          </Link>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-ps-border px-4 py-2">
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
