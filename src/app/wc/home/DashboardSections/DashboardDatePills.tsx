"use client";

import { useT } from "@/lib/i18n";
import { computeDayStatus, formatLockCountdown } from "@/lib/wc/daily-lock";
import { CHROME_PALETTE } from "@/app/wc/_landing/brand-palette";
import type { DatePillSummary } from "../fetchDashboardData";

export function DashboardDatePills({
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
                <span className="font-mono text-micro font-bold uppercase tracking-[0.10em] text-ps-text-ter">
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
        <p className="mt-2 text-caption font-semibold text-ps-red">{warningText}</p>
      )}
    </>
  );
}

function DashboardPillIndicator({ status }: { status: string }) {
  const t = useT();
  switch (status) {
    case "complete":
      return (
        <span className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-green text-micro font-extrabold leading-none text-white" aria-label={t('calendar.complete')}>
          ✓
        </span>
      );
    case "partial":
      return (
        <span
          className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-micro font-extrabold leading-none text-white"
          style={{ background: CHROME_PALETTE.attention }}
          aria-label={t('calendar.exact_score_needed')}
        >
          !
        </span>
      );
    case "urgent":
      return (
        <span className="mt-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ps-red text-micro font-extrabold leading-none text-white" style={{ letterSpacing: "-0.5px" }} aria-label={t('calendar.locks_soon')}>
          !!
        </span>
      );
    default:
      return <span className="mt-1 h-3.5" aria-hidden="true" />;
  }
}
