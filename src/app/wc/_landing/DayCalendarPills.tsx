"use client";

import { CHROME_PALETTE } from "./brand-palette";

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
}

/**
 * Horizontal calendar pills, one per MD1 day.
 *
 *   Default      → cream pill, day-of-week label + day number
 *   Today        → amber underline beneath the pill
 *   All complete → amber ✓ accent rendered BELOW the pill
 *   Day before
 *     joins close → yellow `!` badge rendered ABOVE the pill
 *
 * Tapping a pill smooth-scrolls to `#date-{iso}` in the page below.
 *
 * Pills are 8 wide for WC2026 MD1 (Jun 11 → Jun 18). The component takes the
 * day list as a prop so it stays generic enough to reuse for MD2/MD3 later.
 */
export function DayCalendarPills({
  days,
  dayBeforeCloseIso,
  todayIso,
}: {
  days: DayBucket[];
  /** UTC date (YYYY-MM-DD) immediately before joins close. The `!` lives above this pill. */
  dayBeforeCloseIso: string;
  /** UTC date for "today". The amber underline marks this pill. Pass undefined if not in window. */
  todayIso?: string;
}) {
  return (
    <div
      role="list"
      aria-label="Matchday calendar"
      className="mx-auto mt-3 flex w-full max-w-[480px] items-end gap-1.5 overflow-x-auto px-4 pb-1"
    >
      {days.map((d) => {
        const isComplete = d.totalCount > 0 && d.fullyComplete === d.totalCount;
        const isDayBefore = d.iso === dayBeforeCloseIso;
        const isToday = d.iso === todayIso;
        return (
          <a
            key={d.iso}
            role="listitem"
            href={`#date-${d.iso}`}
            aria-label={`${d.weekday} ${d.dayNum} — ${d.fullyComplete} of ${d.totalCount} picked`}
            className="relative flex shrink-0 flex-col items-center text-center"
          >
            {/* `!` badge above the pill — day before joins close. */}
            {isDayBefore && (
              <span
                className="mb-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold leading-none"
                style={{
                  background: CHROME_PALETTE.warning,
                  color: "#191512",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
                }}
                aria-hidden="true"
              >
                !
              </span>
            )}
            {!isDayBefore && <span className="mb-1 h-4" aria-hidden="true" />}

            {/* Pill itself */}
            <span
              className={[
                "flex h-12 w-11 flex-col items-center justify-center rounded-md border bg-ps-surface transition-colors",
                "hover:bg-ps-bg-alt",
                isToday ? "border-ps-amber" : "border-ps-border",
              ].join(" ")}
              style={
                isToday
                  ? { boxShadow: "0 2px 6px -3px rgba(245,158,11,0.5)" }
                  : undefined
              }
            >
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.10em] text-ps-text-ter">
                {d.weekday}
              </span>
              <span className="font-display text-base font-extrabold leading-none text-ps-text">
                {d.dayNum}
              </span>
            </span>

            {/* ✓ amber accent below the pill — all matches that day complete. */}
            {isComplete ? (
              <span
                className="mt-1 inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-extrabold leading-none text-white"
                style={{ background: "#f59e0b" }}
                aria-hidden="true"
              >
                ✓
              </span>
            ) : (
              <span className="mt-1 h-3" aria-hidden="true" />
            )}
          </a>
        );
      })}
    </div>
  );
}
