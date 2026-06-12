"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { computeDayStatus, formatLockCountdown } from "@/lib/wc/daily-lock";
import { CHROME_PALETTE } from "@/app/wc/_landing/brand-palette";
import type { DatePillSummary } from "./fetchDashboardData";
import { DashboardPickRow } from "@/components/wc/DashboardPickRow";
import { GroupMiniTable } from "@/components/wc/GroupMiniTable";
import { FifaGroupsGrid } from "@/components/wc/FifaGroupsGrid";
import { StatsCard } from "@/components/wc/StatsCard";
import { InviteCodeBanner } from "@/components/InviteCodeBanner";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import {
  OnboardingFlow,
  OnboardingSection,
} from "@/components/wc/OnboardingFlow";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";
import type { ResultRow, LastChatMessage } from "./fetchDashboardData";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";
import { PredictionBanner } from "@/components/wc/PredictionBanner";
import { RivalTeaser } from "@/components/wc/RivalTeaser";
import { CommunityPicksCard } from "@/components/wc/CommunityPicksCard";

interface DashboardClientProps {
  competitionId: string;
  nextEvents: WindowEvent[];
  pillDateEvents: WindowEvent[];
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  recentResults: ResultRow[];
  resultsLabel: string;
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

type PickStatus = "complete" | "urgent" | "unpicked" | "in_progress";

function getPickStatus(
  event: WindowEvent,
  predictions: Prediction[],
): PickStatus {
  // In-progress (LIVE): match has started but not yet resulted.
  // Only active between start_time and start_time + 6h to prevent stuck live state.
  const lockMs = new Date(event.lock_time).getTime();
  const startMs = new Date(event.start_time).getTime();
  const nowMs = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  if (startMs <= nowMs && !event.result_confirmed && nowMs < startMs + SIX_HOURS)
    return "in_progress";

  // Locked: past lock_time but match hasn't started (or 6h window expired).
  // No further action possible — treat as complete regardless of pick state.
  if (lockMs <= nowMs && !event.result_confirmed) return "complete";

  const eventPreds = predictions.filter((p) => p.event_id === event.id);
  // "Complete" = has both winner and exact_score predictions
  const hasWinner = eventPreds.some((p) => p.prediction_type === "winner");
  const hasScore = eventPreds.some((p) => p.prediction_type === "exact_score");
  if (hasWinner && hasScore) return "complete";

  // Urgent = < 36h to lock
  if (lockMs - nowMs < 36 * 60 * 60 * 1000 && lockMs > nowMs) return "urgent";

  return "unpicked";
}

/** Check if user has both winner + exact_score predictions for an event. */
function hasCompletePick(event: WindowEvent, predictions: Prediction[]): boolean {
  const eventPreds = predictions.filter((p) => p.event_id === event.id);
  return (
    eventPreds.some((p) => p.prediction_type === "winner") &&
    eventPreds.some((p) => p.prediction_type === "exact_score")
  );
}

/**
 * DashboardClient — renders the 7-section Home dashboard.
 *
 * Layout follows the approved mockup: hero pick cards (host-city colors),
 * horizontal "at a glance" scroll, group table card, results card, invite
 * row, and bracket strip.
 */
export function DashboardClient({
  competitionId,
  nextEvents,
  pillDateEvents,
  predictions,
  fixtureByEventId,
  recentResults,
  resultsLabel,
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
  const t = useT();
  const router = useRouter();
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // In-progress events auto-expand; track which ones the user manually collapsed
  const [collapsedLiveIds, setCollapsedLiveIds] = useState<Set<string>>(new Set());

  // Auto-refresh: refetch server data on visibility change + every 60s while
  // live events exist, so result_confirmed updates propagate and live state clears.
  const refreshData = useCallback(() => router.refresh(), [router]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshData();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Poll every 60s while there are live events, so result confirmations
    // clear the live state even if the user keeps the tab open.
    const hasLive = nextEvents.some((e) => {
      const startMs = new Date(e.start_time).getTime();
      const nowMs = Date.now();
      return startMs <= nowMs && !e.result_confirmed && nowMs < startMs + 6 * 60 * 60 * 1000;
    });
    const interval = hasLive ? setInterval(refreshData, 60_000) : undefined;

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (interval) clearInterval(interval);
    };
  }, [refreshData, nextEvents]);

  // Silent result check on mount: for events 2+ hours past start that aren't
  // confirmed, call the user-triggered result check. If any confirm, refresh.
  // Intentionally runs once on mount only — deps are captured at initial render.
  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const eligible = nextEvents.filter((e) => {
      const startMs = new Date(e.start_time).getTime();
      return !e.result_confirmed && Date.now() - startMs >= TWO_HOURS;
    });
    if (eligible.length === 0) return;

    (async () => {
      let anyConfirmed = false;
      for (const event of eligible) {
        try {
          const res = await fetch("/api/results/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_id: event.id }),
          });
          const data = await res.json();
          if (data.status === "confirmed" || data.status === "already_confirmed") {
            anyConfirmed = true;
          }
        } catch (err) {
          console.warn("[check-result]", event.id, err);
        }
      }
      if (anyConfirmed) router.refresh();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
  }, []);

  // Filter events by selected date pill
  // No pill selected → original capped nextEvents (unchanged deploy behavior)
  // Pill selected → all events for that date from pillDateEvents
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return nextEvents;
    return pillDateEvents.filter((e) => {
      const d = new Date(e.start_time);
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return iso === selectedDate;
    });
  }, [nextEvents, pillDateEvents, selectedDate]);

  // Detect live state — any in-progress event triggers island mode
  const hasLiveEvent = useMemo(
    () => filteredEvents.some((e) => getPickStatus(e, predictions) === "in_progress"),
    [filteredEvents, predictions],
  );

  // Count picks progress (in-progress events with complete picks still count as picked)
  const { picked, total } = useMemo(() => {
    let picked = 0;
    for (const e of filteredEvents) {
      const status = getPickStatus(e, predictions);
      if (status === "complete") picked++;
      else if (status === "in_progress" && hasCompletePick(e, predictions)) picked++;
    }
    return { picked, total: filteredEvents.length };
  }, [filteredEvents, predictions]);

  const now = useNowAfterMount();

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://predictsport-rust.vercel.app";

  const dashboard = (
    <div className="mx-auto max-w-[480px] px-3 pb-8">
      {/* ── 0. Prediction urgency banner ──────────────────────────────── */}
      <div className="pt-2">
        <PredictionBanner events={pillDateEvents} predictions={predictions} />
      </div>

      {/* ── 1. Progress strip ──────────────────────────────────────────── */}
      <OnboardingSection id="other">
        {total > 0 && (
          <div className="ps-panel mt-2 text-center">
            {datePills.length > 0 && (
              <DashboardDatePills
                pills={datePills}
                now={now}
                selectedDate={selectedDate}
                onSelectDate={(iso) => setSelectedDate((prev) => prev === iso ? null : iso)}
              />
            )}
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ps-text-sec">
              {t('dash.picks_progress', { picked, total })}
            </p>
            <div className="mx-auto mt-1.5 h-1 max-w-[200px] overflow-hidden rounded-full bg-ps-border">
              <div
                className="h-full rounded-full bg-ps-amber transition-all"
                style={{ width: `${total > 0 ? (picked / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </OnboardingSection>

      {/* ── 2. Next picks (hero cards — on floor, no panel) ────────────── */}
      <OnboardingSection id="picks">
        {filteredEvents.length > 0 && (
          <section className="mt-2">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              {t('dash.your_picks')}
            </p>
            <div className="flex flex-col gap-1.5">
              {filteredEvents.map((event) => {
                const fixture = fixtureByEventId.get(event.id);
                if (!fixture) return null;
                const status = getPickStatus(event, predictions);
                // In-progress events auto-expand unless manually collapsed
                const isLiveExpanded =
                  status === "in_progress" && !collapsedLiveIds.has(event.id);
                return (
                  <DashboardPickRow
                    key={event.id}
                    fixture={fixture}
                    predictions={predictions}
                    status={status}
                    event={event}
                    competitionId={competitionId}
                    fixtureByEventId={fixtureByEventId}
                    windowLocked={windowLocked}
                    expanded={isLiveExpanded || expandedEventId === event.id}
                    onToggle={() => {
                      if (status === "in_progress") {
                        setCollapsedLiveIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(event.id)) next.delete(event.id);
                          else next.add(event.id);
                          return next;
                        });
                      } else {
                        setExpandedEventId((prev) =>
                          prev === event.id ? null : event.id,
                        );
                      }
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 text-center">
              <Link
                href="/wc"
                className="text-[13px] font-semibold text-ps-amber transition-colors hover:opacity-80"
              >
                {t('dash.continue_round')}
              </Link>
            </div>
          </section>
        )}
      </OnboardingSection>

      {/* ── 3. Invite Friends ──────────────────────────────────────────── */}
      <OnboardingSection id="invite">
        {inviteCode && (
          <section className="ps-panel mt-2">
            <InviteCodeBanner
              inviteCode={inviteCode}
              competitionName="WC Predict"
              joinUrl={`${appUrl}/join`}
              memberCount={memberCount}
            />
          </section>
        )}
      </OnboardingSection>

      {/* ── 4. At a Glance / The Field (live state swaps content) ──── */}
      <OnboardingSection id="other">
        {hasLiveEvent ? (
          /* Live: island with community picks (THE FIELD) */
          <section className="ps-island mt-2">
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              {t('dash.the_field')}
              <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-[9px] font-bold normal-case text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" style={{ animation: "pulse-live 2s infinite" }} />
                {t('picks.live')}
              </span>
            </p>
            <CommunityPicksCard competitionId={competitionId} island />
          </section>
        ) : (
          /* Idle: stats panel */
          <section className="ps-panel mt-2">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              {t('dash.at_a_glance')}
            </p>
            {classificationId && currentUserId ? (
              <StatsCard
                classificationId={classificationId}
                currentUserId={currentUserId}
                competitionId={competitionId}
              />
            ) : (
              <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-5 text-center">
                <p className="text-xs text-ps-text-ter">
                  {t('dash.stats_placeholder')}
                </p>
              </div>
            )}
          </section>
        )}
      </OnboardingSection>

      {/* ── 4b. Community Picks (hidden during live — merged into island) */}
      {isMember && !hasLiveEvent && (
        <OnboardingSection id="other">
          <div className="ps-panel mt-2">
            <CommunityPicksCard competitionId={competitionId} />
          </div>
        </OnboardingSection>
      )}

      {/* ── 5. Your Prediction Group ──────────────────────────────────── */}
      <OnboardingSection id="group">
        <section className="ps-panel mt-2">
          {classificationId ? (
            <GroupMiniTable
              classificationId={classificationId}
              competitionId={competitionId}
            />
          ) : (
            <MockGroupCard />
          )}
        </section>
      </OnboardingSection>

      {/* ── 5a. Rival Predictions teaser ─────────────────────────── */}
      {isMember && (
        <OnboardingSection id="other">
          <section className="ps-panel mt-2">
            <RivalTeaser competitionId={competitionId} />
          </section>
        </OnboardingSection>
      )}

      {/* ── 5b. Leaderboard link ──────────────────────────────────── */}
      <OnboardingSection id="other">
        {isMember && (
          <section className="mt-2">
            <Link
              href="/wc/leaderboard"
              className="flex items-center justify-between rounded-xl bg-ps-amber px-4 py-3 transition-colors hover:opacity-90"
            >
              <span className="text-[13px] font-semibold text-white">
                {t('dash.leaderboard')}
              </span>
              <span className="text-[13px] font-semibold text-white">
                →
              </span>
            </Link>
          </section>
        )}
      </OnboardingSection>

      {/* ── 5c. Chat notification card ──────────────────────────── */}
      {chatEnabled && isMember && lastChatMessage && (
        <OnboardingSection id="other">
          <section className="mt-2">
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
                <span className="text-xs font-semibold text-ps-text">
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

      {/* ── 7. Recent Results ─────────────────────────────────────────── */}
      <OnboardingSection id="other">
        <section className="ps-panel mt-2">
          {recentResults.length > 0 ? (
            <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-ps-text">
                  {resultsLabel}
                </h3>
                <span className="text-[11px] font-semibold uppercase text-ps-text-ter">
                  {t(recentResults.length === 1 ? 'wc.match' : 'wc.matches', { count: recentResults.length })}
                </span>
              </div>
              <div className="mt-3 space-y-0 divide-y divide-ps-border">
                {recentResults.map((r) => (
                  <TodayResultRow key={r.fixture.externalId} result={r} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-5 text-center">
              <p className="text-xs text-ps-text-ter">
                {t('dash.results_placeholder')}
              </p>
            </div>
          )}
        </section>
      </OnboardingSection>

      {/* ── 8. Today's WC Match Groups ──────────────────────────────── */}
      <OnboardingSection id="other">
        {todayGroups.length > 0 && (
          <section className="ps-panel mt-2">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              {t('dash.todays_groups')}
            </p>
            <FifaGroupsGrid
              mode="accordion"
              groupFilter={todayGroups}
              groupEvents={todayGroupEvents}
              predictions={predictions}
              competitionId={competitionId}
              windowLocked={windowLocked}
              backLabel={t('dash.todays_groups')}
              standings={groupStandings}
            />
          </section>
        )}
      </OnboardingSection>

      {/* ── 9. Bracket strip (collapsed by default) ──────────────────── */}
      {bracketProgress && (
      <OnboardingSection id="other">
        <section className="mt-2">
          <details className="group">
            <summary className="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <Link
                href="/wc/bracket"
                className="flex w-full items-center justify-between rounded-xl border border-ps-border bg-ps-surface px-4 py-3 transition-colors hover:bg-ps-chip"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ps-text-sec">
                    {t('dash.bracket')}
                  </span>
                  <span className="rounded-full bg-ps-purple-soft px-1.5 py-0.5 text-[8px] font-bold uppercase text-ps-purple">
                    {t('dash.anorak')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {bracketProgress && (
                    <span className="font-mono text-[11px] tabular-nums text-ps-text-sec">
                      {bracketProgress.pct}%
                    </span>
                  )}
                  <span className="text-[13px] font-semibold tabular-nums text-ps-text">
                    →
                  </span>
                </div>
              </Link>
            </summary>
          </details>
        </section>
      </OnboardingSection>
      )}
    </div>
  );

  if (onboarding) {
    return <OnboardingFlow>{dashboard}</OnboardingFlow>;
  }

  return dashboard;
}

/** Placeholder group table shown during onboarding when no classification exists. */
function MockGroupCard() {
  const t = useT();
  const mockRows = [
    { label: "You", pts: 0, isYou: true },
    { label: "Player 2", pts: 0, isYou: false },
    { label: "Player 3", pts: 0, isYou: false },
    { label: "Player 4", pts: 0, isYou: false },
  ];

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-ps-text">{t('dash.your_group')}</h3>
        <Link
          href="/wc/leaderboard"
          className="text-[13px] font-semibold text-ps-amber transition-opacity hover:opacity-80"
        >
          {t('dash.see_all_groups')}
        </Link>
      </div>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
        {t('dash.group_x')}
      </p>
      <div className="mt-3 space-y-0 divide-y divide-ps-border">
        {mockRows.map((row, i) => (
          <div
            key={row.label}
            className={[
              "flex items-center gap-3 py-2",
              row.isYou ? "font-bold text-ps-amber" : "text-ps-text",
            ].join(" ")}
          >
            <span className="w-4 shrink-0 font-mono text-[11px] tabular-nums text-ps-text-ter">
              {i + 1}.
            </span>
            <span className="flex-1 text-sm">{row.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-ps-text-sec">
              {row.pts} {t('common.pts')}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-ps-text-ter">
        {t('dash.groups_drawn_message')}
      </p>
    </div>
  );
}

/** Date pills showing status for the next 3 match dates. Chrome element — ps-* tokens only. */
function DashboardDatePills({
  pills,
  now,
  selectedDate,
  onSelectDate,
}: {
  pills: DatePillSummary[];
  now: Date | null;
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
}) {
  if (pills.length === 0) return null;

  // Find earliest urgent pill for warning banner
  let warningText: string | null = null;
  for (const p of pills) {
    const status = now
      ? computeDayStatus({
          totalEvents: p.totalCount,
          fullyComplete: p.fullyComplete,
          hasAnyOutcome: p.hasAnyOutcome,
          lockTime: p.lockTime,
          now,
        })
      : "upcoming";
    if (status === "urgent") {
      const countdown = formatLockCountdown(p.lockTime, now!);
      if (countdown) warningText = `\u26A0 ${countdown} to submit ${p.weekday} picks`;
      break;
    }
  }

  return (
    <>
      <div className="flex justify-center gap-1.5">
        {pills.map((p) => {
          const status = now
            ? computeDayStatus({
                totalEvents: p.totalCount,
                fullyComplete: p.fullyComplete,
                hasAnyOutcome: p.hasAnyOutcome,
                lockTime: p.lockTime,
                now,
              })
            : "upcoming";

          const isComplete = status === "complete";
          const isUrgent = status === "urgent";
          const borderClass = isComplete || isUrgent ? "border-ps-amber" : "border-ps-border";
          const pillShadow = isComplete
            ? { boxShadow: "0 2px 6px -3px rgba(212,175,55,0.5)" }
            : isUrgent
              ? { boxShadow: "0 2px 6px -3px rgba(212,175,55,0.3)" }
              : undefined;

          const isSelected = selectedDate === p.iso;

          const pillBorder = isSelected
            ? "border-ps-amber"
            : isComplete
              ? "border-ps-amber"
              : borderClass;
          const selectedShadow = isSelected || isComplete
            ? { boxShadow: "0 2px 6px -3px rgba(212,175,55,0.5)" }
            : pillShadow;

          return (
            <button key={p.iso} onClick={() => onSelectDate(p.iso)} className="flex shrink-0 flex-col items-center">
              <span className="mb-1 h-4" aria-hidden="true" />
              <span
                className={[
                  "flex h-12 w-11 flex-col items-center justify-center rounded-md border bg-ps-surface transition-colors",
                  "hover:bg-ps-bg-alt",
                  pillBorder,
                ].join(" ")}
                style={selectedShadow}
              >
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.10em] text-ps-text-ter">
                  {p.weekday}
                </span>
                <span className="font-display text-base font-extrabold leading-none text-ps-text">
                  {p.dayNum}
                </span>
              </span>
              <DashboardPillIndicator status={status} />
            </button>
          );
        })}
      </div>
      {warningText && (
        <p className="mt-2 text-[11px] font-semibold text-ps-red">{warningText}</p>
      )}
    </>
  );
}

function DashboardPillIndicator({ status }: { status: string }) {
  const t = useT();
  switch (status) {
    case "complete":
      return (
        <span className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-green text-[8px] font-extrabold leading-none text-white" aria-label={t('calendar.complete')}>
          ✓
        </span>
      );
    case "partial":
      return (
        <span
          className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-extrabold leading-none text-white"
          style={{ background: CHROME_PALETTE.attention }}
          aria-label={t('calendar.exact_score_needed')}
        >
          !
        </span>
      );
    case "urgent":
      return (
        <span className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-red text-[7px] font-extrabold leading-none text-white" style={{ letterSpacing: "-0.5px" }} aria-label={t('calendar.locks_soon')}>
          !!
        </span>
      );
    default:
      return <span className="mt-1 h-3.5" aria-hidden="true" />;
  }
}

/** Single result row with score, user prediction, correctness, and points. */
function TodayResultRow({ result }: { result: ResultRow }) {
  const t = useT();
  const { fixture, homeScore, awayScore, userWinnerPick, userScorePick, winnerCorrect, scoreCorrect, winnerPoints, scorePoints } = result;
  const homeTri = fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTri = fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  // Correctness color: green (both), light green (winner only), red (wrong), grey (no pred)
  const hasPrediction = userWinnerPick !== null;
  const bothCorrect = winnerCorrect === true && scoreCorrect === true;
  const winnerOnly = winnerCorrect === true && scoreCorrect !== true;
  const wrong = hasPrediction && winnerCorrect === false;

  let dotColor = "bg-ps-border"; // grey — no prediction
  if (bothCorrect) dotColor = "bg-[#0aa86d]";
  else if (winnerOnly) dotColor = "bg-[#0aa86d]/50";
  else if (wrong) dotColor = "bg-[#e23d4f]";

  const totalPoints = winnerPoints + scorePoints;

  return (
    <div className="py-3">
      {/* Match score row */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />
        <CountryFlag name={fixture.home} size={22} shape="pill" />
        <span className="text-sm font-semibold text-ps-text">{homeTri}</span>
        <span className="flex-1 text-center font-mono text-base font-bold tabular-nums text-ps-text">
          {homeScore} – {awayScore}
        </span>
        <span className="text-sm font-semibold text-ps-text">{awayTri}</span>
        <CountryFlag name={fixture.away} size={22} shape="pill" />
      </div>

      {/* User prediction + points breakdown */}
      {hasPrediction ? (
        <div className="mt-1 flex items-center gap-2 pl-4.5">
          <span className="text-[11px] text-ps-text-ter">
            {t('dash.you_label')}{" "}
            <span className="font-semibold text-ps-text-sec">
              {userScorePick
                ? `${userScorePick.home}–${userScorePick.away}`
                : userWinnerPick}
            </span>
          </span>
          {totalPoints > 0 && (
            <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-[#0aa86d]">
              {winnerPoints > 0 && t('dash.winner_points', { points: winnerPoints })}
              {winnerPoints > 0 && scorePoints > 0 && " "}
              {scorePoints > 0 && t('dash.score_points', { points: scorePoints })}
            </span>
          )}
          {totalPoints === 0 && (
            <span className="ml-auto font-mono text-[11px] tabular-nums text-ps-text-ter">
              +0
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1 pl-4.5">
          <span className="text-[11px] text-ps-text-ter">{t('dash.no_prediction')}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Hydration-safe "now" — null on server, Date after mount.
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
