"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DashboardPickRow } from "@/components/wc/DashboardPickRow";
import { GroupMiniTable } from "@/components/wc/GroupMiniTable";
import { StatsCard } from "@/components/wc/StatsCard";
import { InviteCodeBanner } from "@/components/InviteCodeBanner";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";

interface DashboardClientProps {
  competitionId: string;
  nextEvents: WindowEvent[];
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  todayFixtures: WcFixture[];
  classificationId: string | null;
  inviteCode: string | null;
  entryClosesAt: string | null;
  memberCount: number;
  isMember: boolean;
  isAuthenticated: boolean;
  windowLocked: boolean;
  currentUserId: string | null;
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
  todayFixtures,
  classificationId,
  inviteCode,
  entryClosesAt,
  memberCount,
  isMember,
  isAuthenticated,
  windowLocked,
  currentUserId,
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

  return (
    <div className="mx-auto max-w-[480px] px-4 pb-8">
      {/* ── 1. Progress strip ──────────────────────────────────────────── */}
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

      {/* ── 2. Next picks (hero cards) ─────────────────────────────────── */}
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

      {/* ── 3. At a Glance (horizontal scroll) ────────────────────────── */}
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

      {/* ── 4. Your Group ──────────────────────────────────────────────── */}
      {classificationId && (
        <section className="mt-4">
          <GroupMiniTable
            classificationId={classificationId}
            competitionId={competitionId}
          />
        </section>
      )}

      {/* ── 5. Today's Results ─────────────────────────────────────────── */}
      {todayFixtures.length > 0 && (
        <section className="mt-2">
          <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ps-text">
                Today&apos;s Results
              </h3>
              <span className="text-[11px] font-semibold uppercase text-ps-text-ter">
                {todayFixtures.length}{" "}
                {todayFixtures.length === 1 ? "match" : "matches"}
              </span>
            </div>
            <div className="mt-3 space-y-0 divide-y divide-ps-border">
              {todayFixtures.map((f) => (
                <TodayResultRow key={f.externalId} fixture={f} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. Invite Friends ──────────────────────────────────────────── */}
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

      {/* ── 7. Bracket strip ───────────────────────────────────────────── */}
      <section className="mt-2">
        <Link
          href="/wc/bracket"
          className="flex items-center gap-2 rounded-xl border border-ps-border bg-ps-surface px-4 py-3 transition-colors hover:bg-ps-chip"
        >
          <span className="text-[13px] font-semibold text-ps-text-sec">
            Bracket
          </span>
          <span className="rounded-full bg-ps-purple-soft px-1.5 py-0.5 text-[8px] font-bold uppercase text-ps-purple">
            Anorak
          </span>
          <span className="flex-1" />
          <span className="text-[13px] font-semibold tabular-nums text-ps-text">
            →
          </span>
        </Link>
      </section>
    </div>
  );
}

/** Single result row for today's matches. */
function TodayResultRow({ fixture }: { fixture: WcFixture }) {
  const homeTri = fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTri = fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  return (
    <div className="flex items-center gap-2 py-3">
      <CountryFlag name={fixture.home} size={22} />
      <span className="text-sm font-semibold text-ps-text">{homeTri}</span>
      <span className="flex-1 text-center text-base font-bold tabular-nums text-ps-text">
        — : —
      </span>
      <span className="text-sm font-semibold text-ps-text">{awayTri}</span>
      <CountryFlag name={fixture.away} size={22} />
    </div>
  );
}
