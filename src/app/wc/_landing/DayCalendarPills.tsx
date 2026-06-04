"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHROME_PALETTE } from "./brand-palette";
import { computeDayStatus, type DayPredictionStatus } from "@/lib/wc/daily-lock";

export interface DayBucket {
  /** UTC YYYY-MM-DD. Pill targets `#date-{iso}` for scroll-to. */
  iso: string;
  /** "Thu" / "Fri" / etc. — pre-formatted UTC weekday short label. */
  weekday: string;
  /** Day-of-month number, e.g. 11. */
  dayNum: number;
  /** Count of fixtures on this date. */
  totalCount: number;
  /** Count of fixtures with BOTH winner + exact-score saved. */
  fullyComplete: number;
  /** Whether at least one fixture has a winner outcome saved. */
  hasAnyOutcome: boolean;
  /** Daily lock time (earliest kickoff that day - 10min). ISO string. */
  lockTime: string;
  /** Month name, e.g. "June". */
  month: string;
}

/**
 * Horizontal calendar pills with month labels, one pill per day.
 *
 * Status indicators below each pill:
 *   Complete → amber pill border + green ✓
 *   Partial  → purple ! (outcome saved, missing exact score)
 *   Urgent   → red ✗ (incomplete, <24h to lock)
 *   Default  → no indicator
 *
 * Month labels float above each month group, centered over the first
 * 1.5–2 pills of that month. Derived from day data, not hard-coded.
 */
export function DayCalendarPills({
  days,
  dayBeforeCloseIso,
  todayIso,
  now,
}: {
  days: DayBucket[];
  dayBeforeCloseIso: string;
  todayIso?: string;
  /** Current time for status computation. Null during SSR. */
  now: Date | null;
}) {
  // Group pills by month for label positioning.
  const monthGroups: { month: string; startIdx: number; count: number }[] = [];
  let currentMonth = "";
  for (let i = 0; i < days.length; i++) {
    if (days[i].month !== currentMonth) {
      currentMonth = days[i].month;
      monthGroups.push({ month: currentMonth, startIdx: i, count: 1 });
    } else {
      monthGroups[monthGroups.length - 1].count++;
    }
  }

  return (
    <div className="mx-auto mt-3 w-full max-w-[480px] px-4">
      {/* Month labels */}
      <div className="relative flex gap-1.5" aria-hidden="true">
        {monthGroups.map((mg) => {
          // Position label starting at the month's first pill.
          // Each pill is 44px (w-11) + 6px gap. Label spans ~1.5-2 pill widths.
          const leftPx = mg.startIdx * 50;
          return (
            <span
              key={mg.month}
              className="absolute font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-ps-text-ter"
              style={{ left: `${leftPx}px` }}
            >
              {mg.month}
            </span>
          );
        })}
        {/* Spacer to reserve height for month labels */}
        <span className="h-4" />
      </div>

      {/* Pills row */}
      <div
        role="list"
        aria-label="Matchday calendar"
        className="flex items-end gap-1.5 overflow-x-auto pb-1"
      >
        {days.map((d) => {
          const status: DayPredictionStatus = now
            ? computeDayStatus({
                totalEvents: d.totalCount,
                fullyComplete: d.fullyComplete,
                hasAnyOutcome: d.hasAnyOutcome,
                lockTime: d.lockTime,
                now,
              })
            : "upcoming";

          const isDayBefore = d.iso === dayBeforeCloseIso;
          const isToday = d.iso === todayIso;
          const isComplete = status === "complete";

          // Pill border: complete = amber, today = amber, default = border
          const borderClass = isComplete
            ? "border-ps-amber"
            : isToday
              ? "border-ps-amber"
              : "border-ps-border";

          const pillShadow = isComplete
            ? { boxShadow: "0 2px 6px -3px rgba(212,175,55,0.5)" }
            : isToday
              ? { boxShadow: "0 2px 6px -3px rgba(212,175,55,0.3)" }
              : undefined;

          return (
            <a
              key={d.iso}
              role="listitem"
              href={`#date-${d.iso}`}
              aria-label={`${d.weekday} ${d.dayNum} — ${d.fullyComplete} of ${d.totalCount} picked${isComplete ? ", complete" : ""}`}
              className="relative flex shrink-0 flex-col items-center text-center"
            >
              {/* Badge above pill: day-before-close warning */}
              {isDayBefore && <JoinCutoffBadge />}
              {!isDayBefore && <span className="mb-1 h-4" aria-hidden="true" />}

              {/* Pill */}
              <span
                className={[
                  "flex h-12 w-11 flex-col items-center justify-center rounded-md border bg-ps-surface transition-colors",
                  "hover:bg-ps-bg-alt",
                  borderClass,
                ].join(" ")}
                style={pillShadow}
              >
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.10em] text-ps-text-ter">
                  {d.weekday}
                </span>
                <span className="font-display text-base font-extrabold leading-none text-ps-text">
                  {d.dayNum}
                </span>
              </span>

              {/* Status indicator below pill */}
              <PillStatusIndicator status={status} />
            </a>
          );
        })}
      </div>
    </div>
  );
}

function PillStatusIndicator({ status }: { status: DayPredictionStatus }) {
  switch (status) {
    case "complete":
      // Green tick on amber-accented pill — completion state
      return (
        <span
          className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-green text-[8px] font-extrabold leading-none text-white"
          aria-label="Complete"
        >
          ✓
        </span>
      );
    case "partial":
      // Purple exclamation — attention, exact score needed
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
      // Red X — incomplete, <24h to lock
      return (
        <span
          className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-red text-[8px] font-extrabold leading-none text-white"
          aria-label="Locks soon, incomplete"
        >
          ✗
        </span>
      );
    default:
      return <span className="mt-1 h-3.5" aria-hidden="true" />;
  }
}

/** Yellow ! badge above the day-before-joins-close pill. Tap to see message. */
function JoinCutoffBadge() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position the portal popover below the button.
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6 + window.scrollY,
      left: Math.max(12, rect.left + rect.width / 2 - 112 + window.scrollX),
    });
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span className="mb-1">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold leading-none"
        style={{
          background: CHROME_PALETTE.warning,
          color: "#191512",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
        }}
        aria-label="Join deadline info"
        aria-expanded={open}
      >
        !
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 w-56 rounded-lg border border-ps-border bg-ps-surface p-3 text-left shadow-lg"
            style={{ top: `${pos.top}px`, left: `${pos.left}px`, position: "absolute" }}
          >
            <p className="text-[11px] font-semibold text-ps-text">
              Joins close soon
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ps-text-sec">
              After this day, new players can no longer join. Share the link
              with friends before it&rsquo;s too late.
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(
                  window.location.origin + "/wc/join",
                );
                setOpen(false);
              }}
              className="mt-2 w-full rounded-lg bg-ps-text px-3 py-2 text-[11px] font-semibold text-ps-bg transition-colors hover:bg-ps-text/90"
            >
              Copy invite link
            </button>
          </div>,
          document.body,
        )}
    </span>
  );
}
