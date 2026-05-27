"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useRef, useMemo, useSyncExternalStore } from "react";
import { WindowPickList, type WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";
import {
  WC_JOINS_CLOSE_AT,
  dayBeforeCloseUtcDate,
  joinCutoffWarningState,
} from "@/lib/wc/join-cutoff";
import { DayCalendarPills, type DayBucket } from "./DayCalendarPills";
import { JoinCutoffBanner } from "./JoinCutoffBanner";
import { ViewToggle, type ViewMode } from "./ViewToggle";

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

  // Bucket events for the chosen view. The card surface picks logic key is
  // `event.id`, so re-bucketing parents does not unmount rows — optimistic
  // pick state survives the toggle.
  const sections = useMemo(() => {
    if (view === "group") return bucketByGroup(props.events, props.fixtureByEventId);
    return bucketByDate(props.events);
  }, [view, props.events, props.fixtureByEventId]);

  return (
    <div className="pb-16">
      {/* Hero */}
      <header className="mx-auto mt-5 w-full max-w-[480px] px-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ps-amber-deep">
          Round 1 · Group stage
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-extrabold uppercase tracking-tight text-ps-text">
          Pick the winners
        </h1>
        <p className="mt-1.5 font-serif text-sm italic text-ps-text-sec">
          Twenty-four openers. Eight days. One winner per match.
        </p>
      </header>

      {/* Progress strip */}
      <div className="mx-auto mt-4 w-full max-w-[480px] px-4">
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
      </div>

      {/* 8-day calendar pills */}
      <DayCalendarPills
        days={dayBuckets}
        dayBeforeCloseIso={dayBeforeCloseIso}
        todayIso={todayIso}
      />

      {/* Soft cutoff banner */}
      <JoinCutoffBanner state={cutoffState} closeDateLabel={closeDateLabel} />

      {/* By date / By group */}
      <ViewToggle value={view} onChange={handleViewChange} />

      {/* Sections — blurred for non-members with a tap-to-join overlay */}
      <div className="relative mt-3">
        <div
          className={
            previewMode
              ? "pointer-events-none select-none [filter:blur(6px)_saturate(0.7)]"
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
          />
        </div>

        {previewMode && (
          <PreviewOverlay isAuthenticated={props.isAuthenticated} />
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
}

function Sections({
  sections,
  competitionId,
  predictions,
  fixtureByEventId,
  windowLocked,
}: {
  sections: Section[];
  competitionId: string;
  predictions: Prediction[];
  fixtureByEventId: Map<string, WcFixture>;
  windowLocked: boolean;
}) {
  if (sections.length === 0) {
    return (
      <p className="mx-auto mt-6 w-full max-w-[480px] px-4 text-center text-sm text-ps-text-sec">
        No matchday 1 fixtures scheduled yet.
      </p>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[480px] px-4">
      {sections.map((s) => (
        <section key={s.domId} id={s.domId} className="mt-5 scroll-mt-20">
          <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-ps-border pb-1.5">
            <h2 className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-ps-text">
              {s.heading}
            </h2>
            {s.sub && (
              <span className="font-mono text-[11px] text-ps-text-ter">
                {s.sub}
              </span>
            )}
          </div>
          <WindowPickList
            competitionId={competitionId}
            events={s.events}
            predictions={predictions}
            windowLocked={windowLocked}
            surface="card"
            fixtureByEventId={fixtureByEventId}
          />
        </section>
      ))}
    </div>
  );
}

// ── Preview overlay ─────────────────────────────────────────────────────────

function PreviewOverlay({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-12">
      <div className="pointer-events-auto mx-4 max-w-[360px] rounded-2xl border border-ps-border bg-ps-surface px-5 py-5 text-center shadow-lg">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ps-amber-deep">
          Preview
        </p>
        <h2 className="mt-1.5 font-display text-lg font-extrabold uppercase tracking-tight text-ps-text">
          Join the game to pick
        </h2>
        <p className="mt-1.5 text-xs text-ps-text-sec">
          Twenty-four openers, a bracket if you want it, leaderboard bragging
          rights. Joins close 3 days after kickoff.
        </p>
        <Link
          href={isAuthenticated ? "/wc/join" : "/login?next=/wc/join"}
          className="mt-4 inline-block w-full rounded-xl bg-ps-text px-4 py-3 text-sm font-semibold text-ps-bg transition-colors hover:bg-ps-text/90"
        >
          {isAuthenticated ? "Join now" : "Sign in to join"}
        </Link>
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

function bucketByDate(events: WindowEvent[]): Section[] {
  const buckets = new Map<string, WindowEvent[]>();
  for (const e of events) {
    const iso = utcDateIso(new Date(e.start_time));
    const list = buckets.get(iso) ?? [];
    list.push(e);
    buckets.set(iso, list);
  }
  // Sort sections by date.
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return sorted.map(([iso, list]) => {
    const d = new Date(iso + "T12:00:00Z"); // midday UTC to dodge locale edge cases
    const heading = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(d);
    return {
      domId: `date-${iso}`,
      heading,
      sub: `${list.length} ${list.length === 1 ? "match" : "matches"}`,
      events: list,
    };
  });
}

function bucketByGroup(
  events: WindowEvent[],
  fixtureByEventId: Map<string, WcFixture>,
): Section[] {
  const buckets = new Map<string, WindowEvent[]>();
  for (const e of events) {
    const fixture = fixtureByEventId.get(e.id);
    const key = fixture?.group ?? "?";
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return sorted.map(([letter, list]) => ({
    domId: `group-${letter}`,
    heading: letter === "?" ? "Unmatched" : `Group ${letter}`,
    sub: `${list.length} ${list.length === 1 ? "match" : "matches"}`,
    events: list,
  }));
}

function buildDayBuckets(
  events: WindowEvent[],
  predictions: Prediction[],
): DayBucket[] {
  // Group event IDs by UTC date.
  const dateToEvents = new Map<string, WindowEvent[]>();
  for (const e of events) {
    const iso = utcDateIso(new Date(e.start_time));
    const list = dateToEvents.get(iso) ?? [];
    list.push(e);
    dateToEvents.set(iso, list);
  }

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
    for (const e of list) {
      if (winnerByEvent.get(e.id) && scoreByEvent.get(e.id)) fullyComplete++;
    }
    const d = new Date(iso + "T12:00:00Z");
    const weekday = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    }).format(d);
    buckets.push({
      iso,
      weekday,
      dayNum: d.getUTCDate(),
      totalCount: list.length,
      fullyComplete,
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

