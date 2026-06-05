"use client";

import Link from "next/link";
import { useMemo } from "react";
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

interface DashboardClientProps {
  competitionId: string;
  nextEvents: WindowEvent[];
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  recentResults: ResultRow[];
  resultsLabel: string;
  classificationId: string | null;
  todayGroups: string[];
  inviteCode: string | null;
  entryClosesAt: string | null;
  memberCount: number;
  isMember: boolean;
  isAuthenticated: boolean;
  windowLocked: boolean;
  currentUserId: string | null;
  bracketProgress: { pct: number; label: string } | null;
  onboarding?: boolean;
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
  predictions,
  fixtureByEventId,
  recentResults,
  resultsLabel,
  classificationId,
  todayGroups,
  inviteCode,
  entryClosesAt,
  memberCount,
  isMember,
  isAuthenticated,
  windowLocked,
  currentUserId,
  bracketProgress,
  onboarding,
}: DashboardClientProps) {
  // Count picks progress
  const { picked, total } = useMemo(() => {
    let picked = 0;
    for (const e of nextEvents) {
      if (getPickStatus(e, predictions) === "complete") picked++;
    }
    return { picked, total: nextEvents.length };
  }, [nextEvents, predictions]);

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
        {nextEvents.length > 0 && (
          <section className="mt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              Your picks · Round 1
            </p>
            <div className="flex flex-col gap-2">
              {nextEvents.map((event) => {
                const fixture = fixtureByEventId.get(event.id);
                if (!fixture) return null;
                const status = getPickStatus(event, predictions);
                return (
                  <DashboardPickRow
                    key={event.id}
                    fixture={fixture}
                    predictions={predictions}
                    status={status}
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

      {/* ── 3. At a Glance (horizontal scroll) ────────────────────────── */}
      <OnboardingSection id="other">
        {classificationId && currentUserId && (
          <section className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
              At a glance
            </p>
            <StatsCard
              classificationId={classificationId}
              currentUserId={currentUserId}
            />
          </section>
        )}
      </OnboardingSection>

      {/* ── 4. Your Group ──────────────────────────────────────────────── */}
      <OnboardingSection id="group">
        {classificationId && (
          <section className="mt-4">
            <GroupMiniTable
              classificationId={classificationId}
              competitionId={competitionId}
            />
          </section>
        )}
      </OnboardingSection>

      {/* ── 4b. FIFA Groups (collapsible, filtered to today's matchday) */}
      <OnboardingSection id="other">
        {todayGroups.length > 0 && (
          <section className="mt-4">
            <details open className="group">
              <summary className="flex cursor-pointer items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ps-text-ter">
                  Today&apos;s Groups
                </p>
                <svg
                  className="h-4 w-4 shrink-0 text-ps-text-ter transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-2">
                <FifaGroupsGrid mode="compact" groupFilter={todayGroups} />
              </div>
            </details>
          </section>
        )}
      </OnboardingSection>

      {/* ── 5. Recent Results ─────────────────────────────────────────── */}
      <OnboardingSection id="other">
        {recentResults.length > 0 && (
          <section className="mt-2">
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
          </section>
        )}
      </OnboardingSection>

      {/* ── 6. Invite Friends ──────────────────────────────────────────── */}
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

      {/* ── 7. Bracket strip ───────────────────────────────────────────── */}
      <OnboardingSection id="other">
        <section className="mt-2">
          <Link
            href="/wc/bracket"
            className="block rounded-xl border border-ps-border bg-ps-surface px-4 py-3 transition-colors hover:bg-ps-chip"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ps-text-sec">
                Bracket
              </span>
              <span className="rounded-full bg-ps-purple-soft px-1.5 py-0.5 text-[8px] font-bold uppercase text-ps-purple">
                Anorak
              </span>
              <span className="flex-1" />
              {bracketProgress && (
                <span className="font-mono text-[11px] tabular-nums text-ps-text-sec">
                  {bracketProgress.pct}%
                </span>
              )}
              <span className="text-[13px] font-semibold tabular-nums text-ps-text">
                →
              </span>
            </div>
            {bracketProgress && (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-ps-border">
                  <div
                    className="h-full rounded-full bg-ps-purple transition-all"
                    style={{ width: `${bracketProgress.pct}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-ps-text-ter">
                  {bracketProgress.label}
                </p>
              </div>
            )}
          </Link>
        </section>
      </OnboardingSection>
    </div>
  );

  if (onboarding) {
    return <OnboardingFlow>{dashboard}</OnboardingFlow>;
  }

  return dashboard;
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
