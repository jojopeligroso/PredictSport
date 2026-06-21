"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { RivalTeaser } from "@/components/wc/RivalTeaser";
import { OnboardingSection } from "@/components/wc/OnboardingFlow";
import type { LastChatMessage } from "../fetchDashboardData";

interface SocialSectionProps {
  isMember: boolean;
  competitionId: string;
  chatEnabled: boolean;
  lastChatMessage: LastChatMessage | null;
  liveMode: boolean;
}

export function SocialSection({
  isMember,
  competitionId,
  chatEnabled,
  lastChatMessage,
  liveMode,
}: SocialSectionProps) {
  const t = useT();

  return (
    <>
      {/* ── 5a. Rival Predictions teaser ─────────────────────────── */}
      {isMember && (
        <OnboardingSection id="other">
          <section className="ps-panel mt-5">
            <RivalTeaser competitionId={competitionId} />
          </section>
        </OnboardingSection>
      )}

      {/* ── 5b. Leaderboard link ──────────────────────────────────── */}
      <OnboardingSection id="other">
        {isMember && (
          <section className="mt-5">
            <Link
              href="/wc/leaderboard"
              className="flex items-center justify-between rounded-xl bg-ps-amber px-4 py-3 transition-colors hover:opacity-90"
            >
              <span className="text-body font-semibold text-white">
                {t('dash.leaderboard')}
              </span>
              <span className="text-body font-semibold text-white">
                →
              </span>
            </Link>
          </section>
        )}
      </OnboardingSection>

      {/* ── 5c. Chat notification card (hidden when live drawer is showing) ── */}
      {chatEnabled && isMember && lastChatMessage && !liveMode && (
        <OnboardingSection id="other">
          <section className="mt-5">
            <Link
              href="/wc/chat"
              className="flex items-center gap-3 rounded-xl border border-ps-border bg-ps-surface px-4 py-3 transition-colors hover:bg-ps-chip"
            >
              {/* Avatar */}
              {lastChatMessage.senderAvatar ? (
                <img
                  src={lastChatMessage.senderAvatar}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ps-chip text-xs font-bold text-ps-text-sec">
                  {lastChatMessage.senderName.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Message preview */}
              <div className="min-w-0 flex-1">
                <span className="truncate text-xs font-semibold text-ps-text">
                  {lastChatMessage.senderName}
                </span>
                <p className="truncate text-xs text-ps-text-sec">
                  {lastChatMessage.content.length > 60
                    ? lastChatMessage.content.slice(0, 57) + "..."
                    : lastChatMessage.content}
                </p>
              </div>
              {/* Arrow */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ps-text-ter">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </section>
        </OnboardingSection>
      )}
    </>
  );
}
