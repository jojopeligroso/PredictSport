"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTimingForSport } from "@/lib/sports/timing";
import { OnboardingFlow } from "@/components/wc/OnboardingFlow";
import { PredictionBanner } from "@/components/wc/PredictionBanner";
import { useLiveModeToggle } from "@/hooks/useLiveMode";
import { isEventLive, getPickStatus, hasCompletePick } from "./dashboard-utils";
import type { PickStatus } from "./dashboard-utils";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";
import type { DatePillSummary, ResultRow, LastChatMessage } from "./fetchDashboardData";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";
import {
  PicksSection,
  ProgressStrip,
  InviteSection,
  LiveSection,
  ResultsSection,
  GroupSection,
  SocialSection,
  TagSection,
  TournamentSection,
} from "./DashboardSections";

interface DashboardClientProps {
  competitionId: string;
  nextEvents: WindowEvent[];
  pillDateEvents: WindowEvent[];
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  recentResults: ResultRow[];
  classificationId: string | null;
  todayGroups: string[];
  todayGroupEvents: Map<string, WindowEvent[]>;
  inviteCode: string | null;
  entryClosesAt: string | null;
  memberCount: number;
  isMember: boolean;
  isAuthenticated: boolean;
  windowLocked: boolean;
  currentUserId: string | null;
  bracketProgress: { pct: number; label: string } | null;
  groupStandings?: Record<string, TeamWithStats[]>;
  onboarding?: boolean;
  datePills: DatePillSummary[];
  chatEnabled: boolean;
  isCompetitionAdmin: boolean;
  memberRole: string;
  lastChatMessage: LastChatMessage | null;
}

/**
 * DashboardClient -- slim orchestrator for the 7-section Home dashboard.
 *
 * All hooks and computed state live here; section components receive
 * the computed values as props and own their own JSX.
 */
export function DashboardClient({
  competitionId,
  nextEvents,
  pillDateEvents,
  predictions,
  fixtureByEventId,
  recentResults,
  classificationId,
  todayGroups,
  todayGroupEvents,
  inviteCode,
  entryClosesAt,
  memberCount,
  isMember,
  isAuthenticated,
  windowLocked,
  currentUserId,
  bracketProgress,
  groupStandings,
  onboarding,
  datePills,
  chatEnabled,
  isCompetitionAdmin,
  memberRole,
  lastChatMessage,
}: DashboardClientProps) {
  const router = useRouter();
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // In-progress events auto-expand; track which ones the user manually collapsed
  const [collapsedLiveIds, setCollapsedLiveIds] = useState<Set<string>>(new Set());
  const [resultsExpanded, setResultsExpanded] = useState(false);

  // Raw "is any match live right now" check (ignores the toggle + date filter) --
  // drives both the Live-mode toggle hook and the live poll gating.
  const liveEventExistsRaw = useMemo(
    () => nextEvents.some(isEventLive),
    [nextEvents],
  );

  const { liveEnabled, toggle, showPrompt, acceptAlwaysOff, declinePrompt } =
    useLiveModeToggle(liveEventExistsRaw);

  // Post-match push prompt trigger: if the user arrives and there are recent
  // results, set a localStorage flag so PushNotificationPrompt can re-prompt
  // users who previously dismissed notifications.
  useEffect(() => {
    if (recentResults.length > 0) {
      try {
        localStorage.setItem("ps-post-match-arrival", "1");
      } catch {
        // localStorage may be unavailable
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh: refetch server data on visibility change + every 180s while
  // live events exist, so result_confirmed updates propagate and live state clears.
  const refreshData = useCallback(() => router.refresh(), [router]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshData();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Poll every 180s while there are live events AND the user hasn't turned
    // Live mode off, so result confirmations clear the live state even if the
    // user keeps the tab open. Turning Live mode off stops the polling.
    const hasLive = liveEnabled && nextEvents.some(isEventLive);
    const interval = hasLive
      ? setInterval(() => {
          if (document.visibilityState === "visible") refreshData();
        }, 180_000)
      : undefined;

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (interval) clearInterval(interval);
    };
  }, [refreshData, nextEvents, liveEnabled]);

  // Active result check: for unconfirmed events past their expected match
  // duration (checkAfterHours), call /api/results/check to try to confirm.
  // Runs on mount and repeats every 15 min while eligible events exist.
  const checkInFlight = useRef(false);
  useEffect(() => {
    async function checkResults() {
      if (document.visibilityState !== "visible") return;
      const eligible = nextEvents.filter((e) => {
        if (e.result_confirmed) return false;
        const { checkAfterHours } = getTimingForSport(e.sport);
        const startMs = new Date(e.start_time).getTime();
        return Date.now() - startMs >= checkAfterHours * 3600000;
      });
      if (eligible.length === 0 || checkInFlight.current) return;

      const target = [...eligible].sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      )[0];

      checkInFlight.current = true;
      let anyConfirmed = false;
      try {
        const res = await fetch("/api/results/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: target.id }),
        });
        const data = await res.json();
        if (data.status === "confirmed" || data.status === "already_confirmed") {
          anyConfirmed = true;
        }
      } catch (err) {
        console.warn("[check-result]", target.id, err);
      }
      checkInFlight.current = false;
      if (anyConfirmed) router.refresh();
    }

    checkResults();
    const interval = setInterval(checkResults, 15 * 60_000);
    return () => clearInterval(interval);
  }, [nextEvents, router]);

  // Filter events by selected date pill
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return nextEvents;
    return pillDateEvents.filter((e) => {
      const d = new Date(e.start_time);
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return iso === selectedDate;
    });
  }, [nextEvents, pillDateEvents, selectedDate]);

  // Does a live event exist in the current view (ignores the toggle)?
  const liveEventExists = useMemo(
    () => filteredEvents.some((e) => getPickStatus(e, predictions, true) === "in_progress"),
    [filteredEvents, predictions],
  );

  // Effective live treatment -- only when a live event exists AND the user
  // hasn't turned Live mode off.
  const liveMode = liveEventExists && liveEnabled;

  // Count picks progress
  const { picked, total } = useMemo(() => {
    let picked = 0;
    for (const e of filteredEvents) {
      const status = getPickStatus(e, predictions, liveEnabled);
      if (status === "complete") picked++;
      else if (status === "in_progress" && hasCompletePick(e, predictions)) picked++;
    }
    return { picked, total: filteredEvents.length };
  }, [filteredEvents, predictions, liveEnabled]);

  const now = useNowAfterMount();

  // 6AM-anchored results window
  const windowedResults = useMemo(() => {
    if (recentResults.length === 0) return [];
    if (!now) return recentResults.slice(0, 3);

    const today6am = new Date(now);
    today6am.setHours(6, 0, 0, 0);
    const anchor = now >= today6am
      ? today6am
      : new Date(today6am.getTime() - 24 * 60 * 60 * 1000);

    const primary = recentResults.filter(
      (r) => new Date(r.startTime).getTime() >= anchor.getTime(),
    );
    if (primary.length > 0) return primary;

    const prevAnchor = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
    return recentResults.filter((r) => {
      const t = new Date(r.startTime).getTime();
      return t >= prevAnchor.getTime() && t < anchor.getTime();
    });
  }, [recentResults, now]);

  const RESULTS_INITIAL = 3;
  const RESULTS_MAX = 6;
  const visibleResults = resultsExpanded
    ? windowedResults.slice(0, RESULTS_MAX)
    : windowedResults.slice(0, RESULTS_INITIAL);
  const canExpandResults = !resultsExpanded && windowedResults.length > RESULTS_INITIAL;
  const remainingResultsCount = Math.min(windowedResults.length, RESULTS_MAX) - RESULTS_INITIAL;

  // Pre-compute per-result streak length
  const streakByExternalId = useMemo(() => {
    const chronological = windowedResults
      .slice()
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
    const map = new Map<string, number>();
    let running = 0;
    for (const r of chronological) {
      if (r.userWinnerPick === null) {
        map.set(r.fixture.externalId, running);
        continue;
      }
      if (r.winnerCorrect) {
        running++;
      } else {
        running = 0;
      }
      map.set(r.fixture.externalId, running);
    }
    return map;
  }, [windowedResults]);

  // "Results coming soon" count
  const awaitingResults = useMemo(() => {
    if (!now) return 0;
    const nowMs = now.getTime();
    return nextEvents.filter((e) => {
      if (e.result_confirmed) return false;
      const startMs = new Date(e.start_time).getTime();
      const { checkAfterHours } = getTimingForSport(e.sport);
      const msSinceStart = nowMs - startMs;
      return msSinceStart >= checkAfterHours * 3600000 && msSinceStart < 24 * 3600000;
    }).length;
  }, [nextEvents, now]);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://predictsport-rust.vercel.app";

  // Toggle handler for PicksSection -- updates collapsedLiveIds or expandedEventId
  const onToggleEvent = useCallback((eventId: string, status: PickStatus) => {
    if (status === "in_progress") {
      setCollapsedLiveIds((prev) => {
        const next = new Set(prev);
        if (next.has(eventId)) next.delete(eventId);
        else next.add(eventId);
        return next;
      });
    } else {
      setExpandedEventId((prev) => (prev === eventId ? null : eventId));
    }
  }, []);

  const dashboard = (
    <div className="mx-auto max-w-[480px] px-3 pb-8">
      {/* 0. Prediction urgency banner (members only) */}
      {isMember && (
        <div className="pt-2">
          <PredictionBanner events={pillDateEvents} predictions={predictions} />
        </div>
      )}

      {/* 1. Progress strip (members only) */}
      {isMember && (
        <ProgressStrip
          total={total}
          picked={picked}
          datePills={datePills}
          now={now}
          selectedDate={selectedDate}
          onSelectDate={(iso) => setSelectedDate((prev) => (prev === iso ? null : iso))}
        />
      )}

      {/* 2. Next picks / Join CTA */}
      <PicksSection
        isMember={isMember}
        isAuthenticated={isAuthenticated}
        competitionId={competitionId}
        filteredEvents={filteredEvents}
        predictions={predictions}
        fixtureByEventId={fixtureByEventId}
        windowLocked={windowLocked}
        liveEnabled={liveEnabled}
        collapsedLiveIds={collapsedLiveIds}
        expandedEventId={expandedEventId}
        onToggleEvent={onToggleEvent}
      />

      {/* 3. Invite Friends */}
      <InviteSection
        inviteCode={inviteCode}
        memberCount={memberCount}
        appUrl={appUrl}
      />

      {/* 4. Live toggle + at-a-glance + live chat + community picks */}
      <LiveSection
        liveEventExists={liveEventExists}
        liveEnabled={liveEnabled}
        liveMode={liveMode}
        toggle={toggle}
        showPrompt={showPrompt}
        acceptAlwaysOff={acceptAlwaysOff}
        declinePrompt={declinePrompt}
        competitionId={competitionId}
        classificationId={classificationId}
        currentUserId={currentUserId}
        chatEnabled={chatEnabled}
        isMember={isMember}
        memberRole={memberRole}
        memberCount={memberCount}
        lastChatMessage={lastChatMessage}
      />

      {/* 5. Results */}
      <ResultsSection
        awaitingResults={awaitingResults}
        liveMode={liveMode}
        visibleResults={visibleResults}
        windowedResults={windowedResults}
        streakByExternalId={streakByExternalId}
        canExpandResults={canExpandResults}
        remainingResultsCount={remainingResultsCount}
        onExpandResults={() => setResultsExpanded(true)}
      />

      {/* 6. Your Prediction Group */}
      <GroupSection
        isMember={isMember}
        classificationId={classificationId}
        competitionId={competitionId}
      />

      {/* 7. Social -- rival teaser, leaderboard, chat card */}
      <SocialSection
        isMember={isMember}
        competitionId={competitionId}
        chatEnabled={chatEnabled}
        lastChatMessage={lastChatMessage}
        liveMode={liveMode}
      />

      {/* 7b. Reputation tag card */}
      <TagSection
        competitionId={competitionId}
        isMember={isMember}
      />

      {/* 8. Tournament groups + bracket */}
      <TournamentSection
        todayGroups={todayGroups}
        todayGroupEvents={todayGroupEvents}
        predictions={predictions}
        competitionId={competitionId}
        windowLocked={windowLocked}
        groupStandings={groupStandings}
        bracketProgress={bracketProgress}
      />
    </div>
  );

  if (onboarding) {
    return <OnboardingFlow>{dashboard}</OnboardingFlow>;
  }

  return dashboard;
}

/**
 * Hydration-safe "now" -- null on server, Date after mount.
 * Updates when the page regains visibility so pick statuses
 * (urgent/locked/in_progress) recompute after PWA resume.
 */
function useNowAfterMount(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return now;
}
