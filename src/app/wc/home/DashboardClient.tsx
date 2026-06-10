"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useRef } from "react";
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
import type { ResultRow } from "./fetchDashboardData";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";
import { ChatWidget } from "@/components/chat";

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
}

type PickStatus = "complete" | "urgent" | "unpicked";

function getPickStatus(
  event: WindowEvent,
  predictions: Prediction[],
): PickStatus {
  const eventPreds = predictions.filter((p) => p.event_id === event.id);
  // "Complete" = has both winner and exact_score predictions
  const hasWinner = eventPreds.some((p) => p.prediction_type === "winner");
  const hasScore = eventPreds.some((p) => p.prediction_type === "exact_score");
  if (hasWinner && hasScore) return "complete";

  // Urgent = < 24h to lock
  const lockMs = new Date(event.lock_time).getTime();
  const nowMs = Date.now();
  if (lockMs - nowMs < 24 * 60 * 60 * 1000 && lockMs > nowMs) return "urgent";

  return "unpicked";
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
}: DashboardClientProps) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Smart close for mini chat: closed state persisted in localStorage
  const chatStorageKey = `chat-closed-${competitionId}`;
  const [chatClosed, setChatClosed] = useState(false);

  const handleChatClose = () => {
    setChatClosed(true);
    try {
      localStorage.setItem(chatStorageKey, new Date().toISOString());
    } catch { /* ignore */ }
  };

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

  // Count picks progress
  const { picked, total } = useMemo(() => {
    let picked = 0;
    for (const e of filteredEvents) {
      if (getPickStatus(e, predictions) === "complete") picked++;
    }
    return { picked, total: filteredEvents.length };
  }, [filteredEvents, predictions]);

  const now = useNowAfterMount();

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://predictsport-rust.vercel.app";

  const dashboard = (
    <div className="mx-auto max-w-[480px] px-4 pb-8">
      {/* ── 1. Progress strip ──────────────────────────────────────────── */}
      <OnboardingSection id="other">
        {total > 0 && (
          <div className="pt-3 pb-1 text-center">
            {datePills.length > 0 && (
              <DashboardDatePills
                pills={datePills}
                now={now}
                selectedDate={selectedDate}
                onSelectDate={(iso) => setSelectedDate((prev) => prev === iso ? null : iso)}
              />
            )}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ps-text-sec">
              {picked} / {total} picks
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

      {/* ── 2. Next picks (hero cards) ─────────────────────────────────── */}
      <OnboardingSection id="picks">
        {filteredEvents.length > 0 && (
          <section className="mt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              Your picks · Round 1
            </p>
            <div className="flex flex-col gap-2">
              {filteredEvents.map((event) => {
                const fixture = fixtureByEventId.get(event.id);
                if (!fixture) return null;
                const status = getPickStatus(event, predictions);
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
                    expanded={expandedEventId === event.id}
                    onToggle={() =>
                      setExpandedEventId((prev) =>
                        prev === event.id ? null : event.id,
                      )
                    }
                  />
                );
              })}
            </div>
            <div className="mt-2 text-center">
              <Link
                href="/wc"
                className="text-[13px] font-semibold text-ps-amber transition-colors hover:opacity-80"
              >
                Continue to full round →
              </Link>
            </div>
          </section>
        )}
      </OnboardingSection>

      {/* ── 3. Invite Friends ──────────────────────────────────────────── */}
      <OnboardingSection id="invite">
        {inviteCode && (
          <section className="mt-2">
            <InviteCodeBanner
              inviteCode={inviteCode}
              competitionName="WC Predict"
              joinUrl={`${appUrl}/join`}
              memberCount={memberCount}
            />
          </section>
        )}
      </OnboardingSection>

      {/* ── 4. At a Glance (horizontal scroll) ────────────────────────── */}
      <OnboardingSection id="other">
        <section className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
            At a glance
          </p>
          {classificationId && currentUserId ? (
            <StatsCard
              classificationId={classificationId}
              currentUserId={currentUserId}
            />
          ) : (
            <div className="rounded-xl border border-ps-border bg-ps-surface px-4 py-5 text-center">
              <p className="text-xs text-ps-text-ter">
                Your stats will appear after the first results.
              </p>
            </div>
          )}
        </section>
      </OnboardingSection>

      {/* ── 5. Your Prediction Group ──────────────────────────────────── */}
      <OnboardingSection id="group">
        <section className="mt-4">
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

      {/* ── 5b. Mini Chat ──────────────────────────────────────────── */}
      {chatEnabled && isMember && currentUserId && !chatClosed && (
        <OnboardingSection id="other">
          <section className="mt-2">
            <div className="rounded-xl border border-ps-border bg-ps-surface overflow-hidden">
              <ChatWidget
                competitionId={competitionId}
                currentUserId={currentUserId}
                isAdmin={isCompetitionAdmin}
                mode="mini"
                onClose={handleChatClose}
              />
            </div>
          </section>
        </OnboardingSection>
      )}

      {/* ── 6. Leaderboard link ──────────────────────────────────────── */}
      <OnboardingSection id="other">
        {isMember && (
          <section className="mt-2">
            <Link
              href="/wc/leaderboard"
              className="flex items-center justify-between rounded-xl bg-ps-amber px-4 py-3 transition-colors hover:opacity-90"
            >
              <span className="text-[13px] font-semibold text-white">
                Leaderboard
              </span>
              <span className="text-[13px] font-semibold text-white">
                →
              </span>
            </Link>
          </section>
        )}
      </OnboardingSection>

      {/* ── 7. Recent Results ─────────────────────────────────────────── */}
      <OnboardingSection id="other">
        <section className="mt-2">
          {recentResults.length > 0 ? (
            <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-ps-text">
                  {resultsLabel}
                </h3>
                <span className="text-[11px] font-semibold uppercase text-ps-text-ter">
                  {recentResults.length}{" "}
                  {recentResults.length === 1 ? "match" : "matches"}
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
                Results will appear once matches are played.
              </p>
            </div>
          )}
        </section>
      </OnboardingSection>

      {/* ── 8. Today's WC Match Groups ──────────────────────────────── */}
      <OnboardingSection id="other">
        {todayGroups.length > 0 && (
          <section className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              Today&apos;s Groups
            </p>
            <FifaGroupsGrid
              mode="accordion"
              groupFilter={todayGroups}
              groupEvents={todayGroupEvents}
              predictions={predictions}
              competitionId={competitionId}
              windowLocked={windowLocked}
              backLabel="Today's Groups"
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
                    Bracket
                  </span>
                  <span className="rounded-full bg-ps-purple-soft px-1.5 py-0.5 text-[8px] font-bold uppercase text-ps-purple">
                    Anorak
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
  const mockRows = [
    { label: "You", pts: 0, isYou: true },
    { label: "Player 2", pts: 0, isYou: false },
    { label: "Player 3", pts: 0, isYou: false },
    { label: "Player 4", pts: 0, isYou: false },
  ];

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-ps-text">Your Group</h3>
        <Link
          href="/wc/leaderboard"
          className="text-[13px] font-semibold text-ps-amber transition-opacity hover:opacity-80"
        >
          See all groups →
        </Link>
      </div>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
        Group X
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
              {row.pts} pts
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-ps-text-ter">
        Groups will be drawn before the first match.
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

          return (
            <button key={p.iso} onClick={() => onSelectDate(p.iso)} className="flex shrink-0 flex-col items-center">
              <span className="mb-1 h-4" aria-hidden="true" />
              <span
                className={[
                  "flex h-12 w-11 flex-col items-center justify-center rounded-md border transition-colors",
                  isSelected
                    ? "border-ps-amber bg-ps-amber"
                    : `bg-ps-surface ${borderClass}`,
                ].join(" ")}
                style={isSelected ? undefined : pillShadow}
              >
                <span className={[
                  "font-mono text-[9px] font-bold uppercase tracking-[0.10em]",
                  isSelected ? "text-white" : "text-ps-text-ter",
                ].join(" ")}>
                  {p.weekday}
                </span>
                <span className={[
                  "font-display text-base font-extrabold leading-none",
                  isSelected ? "text-white" : "text-ps-text",
                ].join(" ")}>
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
  switch (status) {
    case "complete":
      return (
        <span className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-green text-[8px] font-extrabold leading-none text-white" aria-label="Complete">
          ✓
        </span>
      );
    case "partial":
      return (
        <span
          className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-extrabold leading-none text-white"
          style={{ background: CHROME_PALETTE.attention }}
          aria-label="Exact score needed"
        >
          !
        </span>
      );
    case "urgent":
      return (
        <span className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-red text-[7px] font-extrabold leading-none text-white" style={{ letterSpacing: "-0.5px" }} aria-label="Locks soon">
          !!
        </span>
      );
    default:
      return <span className="mt-1 h-3.5" aria-hidden="true" />;
  }
}

/** Single result row with score, user prediction, correctness, and points. */
function TodayResultRow({ result }: { result: ResultRow }) {
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
            You:{" "}
            <span className="font-semibold text-ps-text-sec">
              {userScorePick
                ? `${userScorePick.home}–${userScorePick.away}`
                : userWinnerPick}
            </span>
          </span>
          {totalPoints > 0 && (
            <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums text-[#0aa86d]">
              {winnerPoints > 0 && `+${winnerPoints} winner`}
              {winnerPoints > 0 && scorePoints > 0 && " "}
              {scorePoints > 0 && `+${scorePoints} score`}
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
          <span className="text-[11px] text-ps-text-ter">No prediction</span>
        </div>
      )}
    </div>
  );
}

/** Hydration-safe "now" — null on server, stable Date after mount. */
function useNowAfterMount(): Date | null {
  const nowRef = useRef<Date | null>(null);
  return useSyncExternalStore(
    () => () => {},
    () => (nowRef.current ??= new Date()),
    () => null,
  );
}
