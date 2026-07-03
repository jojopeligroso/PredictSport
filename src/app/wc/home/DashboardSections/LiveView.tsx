"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { CommunityPicksCard } from "@/components/wc/CommunityPicksCard";
import { DashboardPickRow } from "@/components/wc/DashboardPickRow";
import { LiveChatDrawer } from "@/components/wc/LiveChatDrawer";
import { LiveModeToggle } from "@/components/wc/LiveModeToggle";
import { useLiveScores } from "@/hooks/useLiveScores";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import { LiveLeaderboard } from "./LiveLeaderboard";
import type { ScoreboardMatch } from "./LiveLeaderboard";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";
import type { LastChatMessage } from "../fetchDashboardData";

interface LiveViewProps {
  competitionId: string;
  liveEvents: WindowEvent[];
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  windowLocked: boolean;
  currentUserId: string | null;
  // Chat
  chatEnabled: boolean;
  isMember: boolean;
  memberRole: string;
  memberCount: number;
  lastChatMessage: LastChatMessage | null;
  // Leaderboard
  overallClassificationId: string | null;
  formatClassificationId: string | null;
  // Live-mode toggle
  liveEnabled: boolean;
  toggle: () => void;
  showPrompt: boolean;
  acceptAlwaysOff: () => void;
  declinePrompt: () => void;
}

/**
 * LiveView — replaces the entire Home dashboard while matches are live.
 *
 * Layout (top → bottom):
 *  1. Live-mode toggle (lets the user exit back to the normal dashboard)
 *  2. Live score card(s) — DashboardPickRow with in-progress score chip
 *  3. The Field — rival predictions split + most popular exact scores
 *  4. Chat drawer — tall variant, fully expandable
 *  5. Windowed leaderboard — user ±3, Format/Overall tabs only
 *
 * The normal dashboard returns automatically when the sport window
 * concludes (DashboardClient's 180s refresh clears the live state).
 */
export function LiveView({
  competitionId,
  liveEvents,
  predictions,
  fixtureByEventId,
  windowLocked,
  currentUserId,
  chatEnabled,
  isMember,
  memberRole,
  memberCount,
  lastChatMessage,
  overallClassificationId,
  formatClassificationId,
  liveEnabled,
  toggle,
  showPrompt,
  acceptAlwaysOff,
  declinePrompt,
}: LiveViewProps) {
  const t = useT();

  // In the live view, cards default to COLLAPSED (score visible in the card)
  // — opposite of the normal dashboard's auto-expand behaviour.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const liveScores = useLiveScores(liveEvents.map((e) => e.id));

  // Compact scoreboard for the "As it stands" leaderboard island.
  const scoreboard: ScoreboardMatch[] = liveEvents.flatMap((event) => {
    const fixture = fixtureByEventId.get(event.id);
    if (!fixture) return [];
    const live = liveScores[event.id];
    return [
      {
        id: event.id,
        homeTrigram:
          fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase(),
        awayTrigram:
          fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase(),
        homeScore: live?.homeScore ?? null,
        awayScore: live?.awayScore ?? null,
        status: live?.status ?? null,
      },
    ];
  });

  const toggleExpanded = (eventId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[480px] px-3 pb-8">
      {/* 1. Live-mode toggle — exit hatch back to the normal dashboard */}
      <LiveModeToggle
        liveEnabled={liveEnabled}
        onToggle={toggle}
        showPrompt={showPrompt}
        onAcceptAlwaysOff={acceptAlwaysOff}
        onDeclinePrompt={declinePrompt}
      />

      {/* 2. Live score cards */}
      <section className="mt-5">
        <p className="mb-1.5 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
          {t("dash.your_picks")}
          <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold normal-case text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {t("picks.live")}
          </span>
        </p>
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {liveEvents.map((event) => {
            const fixture = fixtureByEventId.get(event.id);
            if (!fixture) return null;
            return (
              <DashboardPickRow
                key={event.id}
                fixture={fixture}
                predictions={predictions}
                status="in_progress"
                event={event}
                competitionId={competitionId}
                fixtureByEventId={fixtureByEventId}
                windowLocked={windowLocked}
                expanded={expandedIds.has(event.id)}
                onToggle={() => toggleExpanded(event.id)}
                liveScore={liveScores[event.id] ?? null}
              />
            );
          })}
        </div>
      </section>

      {/* 3. The Field — rival predictions bar chart + most popular exact scores */}
      {isMember && (
        <section className="ps-island mt-5">
          <p className="mb-1.5 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
            {t("dash.the_field")}
            <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold normal-case text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {t("picks.live")}
            </span>
          </p>
          <CommunityPicksCard competitionId={competitionId} island />
        </section>
      )}

      {/* 4. Chat — tall drawer, fully expandable */}
      {chatEnabled && isMember && currentUserId && (
        <section className="mt-5">
          <LiveChatDrawer
            competitionId={competitionId}
            currentUserId={currentUserId}
            currentUserRole={memberRole}
            memberCount={memberCount}
            lastMessage={lastChatMessage}
            tall
          />
        </section>
      )}

      {/* 5. Windowed leaderboard — user ±3, Format/Overall */}
      <LiveLeaderboard
        overallClassificationId={overallClassificationId}
        formatClassificationId={formatClassificationId}
        currentUserId={currentUserId}
        scoreboard={scoreboard}
      />
    </div>
  );
}
