"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useMemo, useSyncExternalStore } from "react";
import { WindowPickList, type WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";
import {
  WC_JOINS_CLOSE_AT,
  dayBeforeCloseUtcDate,
  joinCutoffWarningState,
} from "@/lib/wc/join-cutoff";
import { PredictionBanner } from "@/components/wc/PredictionBanner";
import {
  computeDayStatus,
  getDailyLockTimes,
  type DayPredictionStatus,
} from "@/lib/wc/daily-lock";
import { DayCalendarPills, type DayBucket } from "./DayCalendarPills";
import { JoinCutoffBanner } from "./JoinCutoffBanner";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { CHROME_PALETTE } from "./brand-palette";
import { WcJoinCard } from "@/components/wc/WcJoinCard";

/**
 * Md1PicksLanding — client root for the picks-first /wc landing.
 *
 * Receives a single MD1 payload (events + user predictions + fixture
 * metadata) from src/app/wc/page.tsx. Owns the `?view=` URL state, computes
 * bucketed sections by date or group, renders chrome (hero, progress strip,
 * 8-day calendar, banner, toggle), then delegates each section's pick UI to
 * the shared WindowPickList with surface="card".
 *
 * Anonymous + non-member visitors see a blurred preview with a tap-to-join
 * overlay (ADR 0014). The hero, calendar, and toggle stay crisp — the format
 * is communicated without giving the picks away.
 */

interface Md1PicksLandingProps {
  competitionId: string;
  /** All MD1 events for the WC competition, ordered by start_time. */
  events: WindowEvent[];
  /** The current user's predictions for those events. Empty if not a member. */
  predictions: Prediction[];
  /** Map of `event.id` → WcFixture for the card-surface variant. */
  fixtureByEventId: Map<string, WcFixture>;
  /** True if the user has a competition_members row for the WC competition. */
  isMember: boolean;
  /** True if the user is signed in at all (separate from membership). */
  isAuthenticated: boolean;
  /** Whether the parent window is hard-locked (round status = locked/scored). Rare for MD1 landing. */
  windowLocked: boolean;
}

export function Md1PicksLanding(props: Md1PicksLandingProps) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>(
    () => (searchParams.get("view") === "group" ? "group" : "date"),
  );

  const handleViewChange = (next: ViewMode) => {
    setView(next);
    // Sync URL for shareability without triggering a server round-trip
    const params = new URLSearchParams(searchParams.toString());
    if (next === "date") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/wc?${qs}` : "/wc");
  };

  // The picks UI is only interactive for members. Anon + non-member visitors
  // see the surface in read-only/blurred mode with a tap-to-join overlay.
  const previewMode = !props.isMember;

  // Track "now" for the day-of/day-before banner state. We snapshot once on
  // mount via useSyncExternalStore so the server and the first client render
  // agree (both see `null`), and the banner only appears after hydration.
  // This avoids the cascading-render lint and SSR/client clock drift.
  const now = useNowAfterMount();

  const cutoffState = useMemo(
    () => (now ? joinCutoffWarningState(now) : "none"),
    [now],
  );

  // Pre-formatted UTC close-date label, e.g. "Sun 14 Jun". Stable across
  // server + client (no timezone-of-runner ambiguity).
  const closeDateLabel = useMemo(() => {
    const d = new Date(WC_JOINS_CLOSE_AT);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(d);
  }, []);

  const dayBeforeCloseIso = dayBeforeCloseUtcDate();
  const todayIso = useMemo(() => (now ? utcDateIso(now) : undefined), [now]);

  // Build day buckets. One per UTC calendar date that has at least one MD1
  // fixture. We derive labels via Intl in UTC to match the seed data.
  const dayBuckets = useMemo<DayBucket[]>(
    () => buildDayBuckets(props.events, props.predictions),
    [props.events, props.predictions],
  );

  // Overall progress — every match needs BOTH winner + exact_score saved to
  // count as "done", matching the day-pill ✓ accent rule.
  const { picked, total } = useMemo(
    () => countFullyPicked(props.events, props.predictions),
    [props.events, props.predictions],
  );

  // Earliest lock time for the countdown on the join card.
  const firstLockTime = useMemo(() => {
    if (props.events.length === 0) return null;
    return props.events.reduce((min, e) =>
      e.lock_time < min ? e.lock_time : min,
    props.events[0].lock_time);
  }, [props.events]);

  // Bucket events for the chosen view. The card surface picks logic key is
  // `event.id`, so re-bucketing parents does not unmount rows — optimistic
  // pick state survives the toggle.
  const sections = useMemo(() => {
    if (view === "group")
      return bucketByGroup(props.events, props.fixtureByEventId, props.predictions, now);
    return bucketByDate(props.events, props.predictions, now);
  }, [view, props.events, props.fixtureByEventId, props.predictions, now]);

  return (
    <div className="pb-16">
      {/* Hero — 3-part Group Stage header */}
      <header className="mx-auto mt-5 w-full max-w-[480px] px-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wc/fifa-wc2026-mark.svg"
            alt="FIFA World Cup 2026"
            width={44}
            height={44}
            className="h-11 w-auto shrink-0"
          />
          <div className="-mt-1 flex-1">
            <h1 className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-tight text-ps-text">
              Pick the winners
            </h1>
            <p className="mt-1.5 font-serif text-sm italic text-ps-text-sec">
              Call it before kickoff.
            </p>
          </div>
        </div>
      </header>

      {/* Progress strip — hidden for non-members */}
      {!previewMode && <div className="mx-auto mt-4 w-full max-w-[480px] px-4">
        <div className="flex items-center gap-3 rounded-lg border border-ps-border bg-ps-surface px-3.5 py-2.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ps-text-ter">
            MD1 picks
          </span>
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-ps-bg-alt"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-ps-amber transition-[width] duration-300"
              style={{
                width: `${total > 0 ? Math.round((picked / total) * 100) : 0}%`,
              }}
            />
          </div>
          <span className="font-mono text-xs font-bold tabular-nums text-ps-text">
            {picked}
            <span className="font-semibold text-ps-text-ter"> / {total}</span>
          </span>
        </div>
      </div>}

      {/* 8-day calendar pills with month labels */}
      <DayCalendarPills
        days={dayBuckets}
        dayBeforeCloseIso={dayBeforeCloseIso}
        todayIso={todayIso}
        now={now}
        hideIndicators={previewMode}
      />

      {/* Soft cutoff banner */}
      <JoinCutoffBanner state={cutoffState} closeDateLabel={closeDateLabel} />

      {/* By date / By group — hidden for non-members */}
      {!previewMode && <ViewToggle value={view} onChange={handleViewChange} />}

      {/* Prediction urgency banner — members only */}
      {!previewMode && (
        <div className="mx-auto mt-2 max-w-[480px] px-4">
          <PredictionBanner events={props.events} predictions={props.predictions} />
        </div>
      )}

      {/* Sections — blurred for non-members with a tap-to-join overlay */}
      <div className="relative mt-3">
        <div
          className={
            previewMode
              ? "pointer-events-none select-none [filter:blur(2px)_saturate(0.7)]"
              : ""
          }
          aria-hidden={previewMode || undefined}
        >
          <Sections
            sections={sections}
            competitionId={props.competitionId}
            predictions={props.predictions}
            fixtureByEventId={props.fixtureByEventId}
            windowLocked={props.windowLocked || previewMode}
            now={now}
          />
        </div>

        {previewMode && (
          <PreviewOverlay isAuthenticated={props.isAuthenticated} competitionId={props.competitionId} firstLockTime={firstLockTime} />
        )}
      </div>
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────

interface Section {
  /** DOM id target, e.g. "date-2026-06-11" or "group-A". */
  domId: string;
  /** Heading text. */
  heading: string;
  /** Optional sub-text under the heading. */
  sub?: string;
  events: WindowEvent[];
  /** Lock time for this section's countdown. */
  lockTime?: string;
  /** Prediction status for this section. */
  status?: DayPredictionStatus;
  /** True if this is a group-view section (countdown needs info explainer). */
  isGroupSection?: boolean;
}

/**
 * Walk sections accumulating event count; cut at day boundaries
 * where cumulative >= batchSize. Returns the index of the first
 * section NOT included in this batch.
 */
function nextBatchEnd(sections: Section[], startIdx: number, batchSize: number): number {
  let cumulative = 0;
  for (let i = startIdx; i < sections.length; i++) {
    cumulative += sections[i].events.length;
    if (cumulative >= batchSize && i > startIdx) return i + 1;
  }
  return sections.length;
}

function Sections({
  sections,
  competitionId,
  predictions,
  fixtureByEventId,
  windowLocked,
  now,
}: {
  sections: Section[];
  competitionId: string;
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  windowLocked: boolean;
  now: Date | null;
}) {
  // 1A: Progressive disclosure — show ~6 matches per batch
  const [revealedBatches, setRevealedBatches] = useState(1);
  // 1B: Auto-collapse completed days — track manually expanded ones
  const [expandedCompleted, setExpandedCompleted] = useState<Set<string>>(
    () => new Set(),
  );

  // Compute visible section count based on batches.
  // Auto-extend if all visible sections are complete so there's always
  // something actionable on screen.
  const visibleCount = useMemo(() => {
    let end = 0;
    for (let batch = 0; batch < revealedBatches; batch++) {
      end = nextBatchEnd(sections, end, 6);
    }
    // Keep revealing while every visible section is complete
    while (
      end < sections.length &&
      sections.slice(0, end).every((s) => s.status === "complete")
    ) {
      end = nextBatchEnd(sections, end, 6);
    }
    return end;
  }, [sections, revealedBatches]);

  if (sections.length === 0) {
    return (
      <p className="mx-auto mt-6 w-full max-w-[480px] px-4 text-center text-sm text-ps-text-sec">
        No matchday 1 fixtures scheduled yet.
      </p>
    );
  }

  // Don't render until `now` is available (avoids flash where sections render
  // as upcoming cards then immediately collapse when statuses compute).
  if (!now) {
    return <div className="mx-auto w-full max-w-[480px] px-4" />;
  }

  const visibleSections = sections.slice(0, visibleCount);
  const remainingEvents = sections
    .slice(visibleCount)
    .reduce((sum, s) => sum + s.events.length, 0);

  return (
    <div className="mx-auto w-full max-w-[480px] px-4">
      {visibleSections.map((s) => {
        const status = s.status ?? "upcoming";
        const isComplete = status === "complete";
        const isCollapsed = isComplete && !expandedCompleted.has(s.domId);
        const eligible =
          now &&
          s.lockTime &&
          !isComplete &&
          new Date(s.lockTime).getTime() > now.getTime();

        // 1B: Slim collapsed card for completed days
        if (isCollapsed) {
          const pickedCount = s.events.filter((e) =>
            predictions.some((p) => p.event_id === e.id),
          ).length;
          return (
            <section key={s.domId} id={s.domId} className="mt-5 scroll-mt-20">
              <button
                onClick={() =>
                  setExpandedCompleted((prev) => new Set(prev).add(s.domId))
                }
                className="flex w-full items-center justify-between rounded-lg border border-ps-border bg-ps-surface px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <SectionStatusIcon status="complete" />
                  <span className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-ps-text">
                    {s.heading}
                  </span>
                  <span className="font-mono text-[10px] text-ps-green">
                    {pickedCount}/{s.events.length} picked
                  </span>
                </div>
                <svg
                  className="h-4 w-4 text-ps-text-sec"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </section>
          );
        }

        return (
          <section key={s.domId} id={s.domId} className="mt-5 scroll-mt-20">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-ps-border pb-1.5">
              <div className="flex items-center gap-2">
                {/* Status icon beside heading */}
                <SectionStatusIcon status={status} />
                <h2 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-ps-text">
                  {s.heading}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Collapse button for expanded completed sections */}
                {isComplete && expandedCompleted.has(s.domId) && (
                  <button
                    onClick={() =>
                      setExpandedCompleted((prev) => {
                        const next = new Set(prev);
                        next.delete(s.domId);
                        return next;
                      })
                    }
                    className="text-ps-text-sec"
                  >
                    <svg
                      className="h-4 w-4 rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                )}
                {/* Partial: "Exact score needed" label */}
                {status === "partial" && (
                  <span
                    className="font-mono text-[9px] font-semibold uppercase tracking-wide"
                    style={{ color: CHROME_PALETTE.attention }}
                  >
                    Exact score needed
                  </span>
                )}
                {/* Live dd:hh:mm:ss countdown + optional group info */}
                {eligible && s.lockTime && (
                  <span className="flex items-center gap-1">
                    <SectionCountdown
                      lockTime={s.lockTime}
                      urgent={status === "urgent"}
                    />
                    {s.isGroupSection && <GroupCountdownInfo />}
                  </span>
                )}
                {/* Match count */}
                {!eligible && status !== "partial" && s.sub && (
                  <span className="font-mono text-[11px] text-ps-text-ter">
                    {s.sub}
                  </span>
                )}
              </div>
            </div>
            <WindowPickList
              competitionId={competitionId}
              events={s.events}
              predictions={predictions}
              windowLocked={windowLocked}
              surface="card"
              fixtureByEventId={fixtureByEventId}
              showCardCountdown={s.isGroupSection}
            />
          </section>
        );
      })}

      {/* 1A: Show more button */}
      {remainingEvents > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setRevealedBatches((b) => b + 1)}
            className="flex flex-col items-center rounded-xl px-6 py-3 transition-opacity hover:opacity-80"
            style={{ backgroundColor: CHROME_PALETTE.attention }}
          >
            <span className="text-sm font-semibold text-white">
              Show more matches (+{remainingEvents} remaining)
            </span>
            {revealedBatches === 1 && (
              <span className="mt-1 text-[11px] font-serif italic text-white/75">
                No rush &mdash; just have your picks in before kickoff day
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/** Status icon beside section heading — same semantics as pill indicators. */
function SectionStatusIcon({ status }: { status: DayPredictionStatus }) {
  switch (status) {
    case "complete":
      return (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ps-green text-[9px] font-extrabold leading-none text-white">
          ✓
        </span>
      );
    case "partial":
      return (
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold leading-none text-white"
          style={{ background: CHROME_PALETTE.attention }}
        >
          !
        </span>
      );
    case "urgent":
      return (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ps-red text-[9px] font-extrabold leading-none text-white">
          ✗
        </span>
      );
    default:
      return null;
  }
}

// ── Preview overlay ─────────────────────────────────────────────────────────

function PreviewOverlay({
  isAuthenticated,
  competitionId,
  firstLockTime,
}: {
  isAuthenticated: boolean;
  competitionId: string;
  firstLockTime: string | null;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-6">
      <div className="mx-4 flex max-w-[420px] flex-col gap-4">
        {/* Card 1 — Format explainer */}
        <div className="pointer-events-auto rounded-2xl border border-ps-border bg-ps-surface px-6 py-5 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ps-amber/15">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="text-ps-amber">
              <path d="M10 2L12.5 7.5L18 8.5L14 12.5L15 18L10 15.5L5 18L6 12.5L2 8.5L7.5 7.5L10 2Z" fill="currentColor" />
            </svg>
          </div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-ps-amber-deep">
            How it works
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-ps-text-sec">
            Pick the winner of every match and guess the exact score for bonus
            points. The group stage locks one matchday at a time — predict before
            kickoff, then climb the leaderboard.
          </p>
          <Link
            href="/wc/rules"
            className="mt-3 inline-block text-xs font-semibold text-ps-amber transition-colors hover:opacity-80"
          >
            Full rules →
          </Link>
        </div>

        {/* Card 2 — Join CTA (shared component) */}
        <WcJoinCard
          isAuthenticated={isAuthenticated}
          competitionId={competitionId}
          firstLockTime={firstLockTime}
          className="pointer-events-auto shadow-lg"
        />
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Client-mount-aware "now". Returns null on the server and during initial
 * client render (hydration-safe), then the wall clock once mounted. The
 * sub-resolution doesn't matter for our day-bucket comparison; we don't
 * re-subscribe to time changes, so this is effectively a one-shot mount
 * snapshot via React's hydration-safe primitive.
 */
function useNowAfterMount(): Date | null {
  const nowRef = useRef<Date | null>(null);
  return useSyncExternalStore(
    // No-op subscribe — we never trigger updates. The return signal that
    // matters is the client-snapshot fn returning a stable Date once mounted.
    () => () => {},
    // Cache the snapshot in a ref so successive renders see the same Date
    // object. Returning `new Date()` directly causes Maximum-update-depth:
    // React would see a different reference every render and re-schedule
    // forever. A ref (not module-level) ensures the value is scoped to
    // this component instance, so navigating away and back gets a fresh Date.
    () => (nowRef.current ??= new Date()),
    // Server snapshot — null guarantees hydration matches.
    () => null,
  );
}

function utcDateIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function bucketByDate(
  events: WindowEvent[],
  predictions: Prediction[],
  now: Date | null,
): Section[] {
  const buckets = new Map<string, WindowEvent[]>();
  for (const e of events) {
    const iso = utcDateIso(new Date(e.start_time));
    const list = buckets.get(iso) ?? [];
    list.push(e);
    buckets.set(iso, list);
  }

  const dailyLocks = getDailyLockTimes(events);
  const { winnerByEvent, scoreByEvent } = buildPredictionMaps(predictions);

  const sorted = Array.from(buckets.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return sorted.map(([iso, list]) => {
    const d = new Date(iso + "T12:00:00Z");
    const heading = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(d);
    const lockTime = dailyLocks.get(iso) ?? list[0]?.lock_time;
    const { fullyComplete, hasAnyOutcome } = countSectionCompletion(list, winnerByEvent, scoreByEvent);
    const status = now && lockTime
      ? computeDayStatus({ totalEvents: list.length, fullyComplete, hasAnyOutcome, lockTime, now })
      : undefined;
    return {
      domId: `date-${iso}`,
      heading,
      sub: `${list.length} ${list.length === 1 ? "match" : "matches"}`,
      events: list,
      lockTime,
      status,
    };
  });
}

function bucketByGroup(
  events: WindowEvent[],
  fixtureByEventId: Map<string, WcFixture>,
  predictions: Prediction[],
  now: Date | null,
): Section[] {
  const buckets = new Map<string, WindowEvent[]>();
  for (const e of events) {
    const fixture = fixtureByEventId.get(e.id);
    const key = fixture?.group ?? "?";
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }

  const { winnerByEvent, scoreByEvent } = buildPredictionMaps(predictions);

  const sorted = Array.from(buckets.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return sorted.map(([letter, list]) => {
    // For group view, countdown refers to the earliest visible match's daily lock.
    const earliestLock = list
      .map((e) => e.lock_time)
      .sort()[0];
    const { fullyComplete, hasAnyOutcome } = countSectionCompletion(list, winnerByEvent, scoreByEvent);
    const status = now && earliestLock
      ? computeDayStatus({ totalEvents: list.length, fullyComplete, hasAnyOutcome, lockTime: earliestLock, now })
      : undefined;
    return {
      domId: `group-${letter}`,
      heading: letter === "?" ? "Unmatched" : `Group ${letter}`,
      sub: `${list.length} ${list.length === 1 ? "match" : "matches"}`,
      events: list,
      lockTime: earliestLock,
      status,
      isGroupSection: true,
    };
  });
}

/** Live dd:hh:mm:ss countdown for section headings. */
function SectionCountdown({ lockTime, urgent }: { lockTime: string; urgent: boolean }) {
  const [text, setText] = useState<string | null>(() => fmtDdHhMmSs(lockTime));

  useEffect(() => {
    const tick = () => {
      const next = fmtDdHhMmSs(lockTime);
      setText(next);
      if (!next) clearInterval(id);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockTime]);

  if (!text) return null;

  return (
    <span
      className={`font-mono text-[10px] font-semibold tabular-nums ${
        urgent ? "text-ps-red" : "text-ps-text-ter"
      }`}
      role="timer"
      aria-live="off"
    >
      {text}
    </span>
  );
}

function fmtDdHhMmSs(lockTime: string): string | null {
  const diff = new Date(lockTime).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Info button for group-view countdowns — explains what the countdown refers to. */
function GroupCountdownInfo() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ps-chip text-[9px] font-bold text-ps-text-ter hover:bg-ps-border"
        aria-label="Countdown info"
        aria-expanded={open}
      >
        ?
      </button>
      {open && (
        <span className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-ps-border bg-ps-surface p-2.5 text-[11px] leading-snug text-ps-text-sec shadow-lg">
          This countdown refers to the earliest match shown in this group section.
        </span>
      )}
    </span>
  );
}

/** Shared prediction lookup maps — avoids duplicate iteration. */
function buildPredictionMaps(predictions: Prediction[]) {
  const winnerByEvent = new Map<string, boolean>();
  const scoreByEvent = new Map<string, boolean>();
  for (const p of predictions) {
    if (p.prediction_type === "winner") {
      const v = p.prediction_data?.value ?? p.prediction_data?.selection;
      if (v) winnerByEvent.set(p.event_id, true);
    } else if (p.prediction_type === "exact_score") {
      const data = p.prediction_data ?? {};
      if (data.home !== undefined && data.away !== undefined) {
        scoreByEvent.set(p.event_id, true);
      }
    }
  }
  return { winnerByEvent, scoreByEvent };
}

/** Count completion for a section's events. */
function countSectionCompletion(
  events: WindowEvent[],
  winnerByEvent: Map<string, boolean>,
  scoreByEvent: Map<string, boolean>,
) {
  let fullyComplete = 0;
  let hasAnyOutcome = false;
  for (const e of events) {
    if (winnerByEvent.get(e.id)) hasAnyOutcome = true;
    if (winnerByEvent.get(e.id) && scoreByEvent.get(e.id)) fullyComplete++;
  }
  return { fullyComplete, hasAnyOutcome };
}

function buildDayBuckets(
  events: WindowEvent[],
  predictions: Prediction[],
): DayBucket[] {
  // Group events by UTC date.
  const dateToEvents = new Map<string, WindowEvent[]>();
  for (const e of events) {
    const iso = utcDateIso(new Date(e.start_time));
    const list = dateToEvents.get(iso) ?? [];
    list.push(e);
    dateToEvents.set(iso, list);
  }

  // Daily lock times from event lock_time (already set to daily model in DB).
  const dailyLocks = getDailyLockTimes(events);

  // Precompute "fully picked" per event id.
  const winnerByEvent = new Map<string, boolean>();
  const scoreByEvent = new Map<string, boolean>();
  for (const p of predictions) {
    if (p.prediction_type === "winner") {
      const v = p.prediction_data?.value ?? p.prediction_data?.selection;
      if (v) winnerByEvent.set(p.event_id, true);
    } else if (p.prediction_type === "exact_score") {
      const data = p.prediction_data ?? {};
      if (data.home !== undefined && data.away !== undefined) {
        scoreByEvent.set(p.event_id, true);
      }
    }
  }

  const buckets: DayBucket[] = [];
  const sortedDates = Array.from(dateToEvents.keys()).sort();
  for (const iso of sortedDates) {
    const list = dateToEvents.get(iso) ?? [];
    let fullyComplete = 0;
    let anyOutcome = false;
    for (const e of list) {
      if (winnerByEvent.get(e.id)) anyOutcome = true;
      if (winnerByEvent.get(e.id) && scoreByEvent.get(e.id)) fullyComplete++;
    }
    const d = new Date(iso + "T12:00:00Z");
    const weekday = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    }).format(d);
    const month = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      timeZone: "UTC",
    }).format(d);

    // Lock time: from the daily lock map, or fall back to earliest event's own lock_time.
    const lockTime = dailyLocks.get(iso) ?? list[0]?.lock_time ?? iso + "T00:00:00Z";

    buckets.push({
      iso,
      weekday,
      dayNum: d.getUTCDate(),
      totalCount: list.length,
      fullyComplete,
      hasAnyOutcome: anyOutcome,
      lockTime,
      month,
    });
  }
  return buckets;
}

function countFullyPicked(
  events: WindowEvent[],
  predictions: Prediction[],
): { picked: number; total: number } {
  const winnerByEvent = new Set<string>();
  const scoreByEvent = new Set<string>();
  for (const p of predictions) {
    if (p.prediction_type === "winner") {
      const v = p.prediction_data?.value ?? p.prediction_data?.selection;
      if (v) winnerByEvent.add(p.event_id);
    } else if (p.prediction_type === "exact_score") {
      const data = p.prediction_data ?? {};
      if (data.home !== undefined && data.away !== undefined) {
        scoreByEvent.add(p.event_id);
      }
    }
  }
  let picked = 0;
  for (const e of events) {
    if (winnerByEvent.has(e.id) && scoreByEvent.has(e.id)) picked++;
  }
  return { picked, total: events.length };
}

