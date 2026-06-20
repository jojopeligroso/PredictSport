"use client";

import { useCallback, useEffect, useState } from "react";

interface ConfidenceData {
  totalPicks: number;
  distribution: number[]; // [level1, level2, level3, level4, level5]
  highConfidenceCount: number;
}

interface ConfidenceAccordionProps {
  eventId: string;
  competitionId: string;
  /** ISO timestamp: pick_reveal_at or lock_time + 5min */
  revealAt: string;
}

const LEVEL_LABELS = ["Hopeful", "Leaning", "Confident", "V. Sure", "Dead Cert"];

/**
 * Segmented bar colors — least to most confident.
 * Using Tailwind classes via className for SSR compat.
 */
const SEGMENT_COLORS = [
  "bg-ps-text/[0.12]",
  "bg-ps-text/25",
  "bg-ps-amber/70",
  "bg-ps-amber",
  "bg-orange-600",
];

/**
 * ConfidenceAccordion — expandable row at the bottom of a match card
 * showing the prediction group's aggregate confidence distribution.
 *
 * Only renders after pick_reveal_at has passed (same gate as rival predictions).
 * Fetches data on first expand to avoid unnecessary API calls.
 */
export function ConfidenceAccordion({
  eventId,
  competitionId,
  revealAt,
}: ConfidenceAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<ConfidenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Gate on reveal time — check on mount and re-check periodically
  useEffect(() => {
    const check = () => {
      if (new Date() >= new Date(revealAt)) {
        setRevealed(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const interval = setInterval(() => {
      if (check()) clearInterval(interval);
    }, 30_000);
    return () => clearInterval(interval);
  }, [revealAt]);

  const fetchData = useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tournament/group-confidence?event_id=${eventId}&competition_id=${competitionId}`,
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail — the accordion just won't show data
    } finally {
      setLoading(false);
    }
  }, [eventId, competitionId, data, loading]);

  const handleToggle = useCallback(() => {
    if (!expanded && !data) {
      fetchData();
    }
    setExpanded((prev) => !prev);
  }, [expanded, data, fetchData]);

  if (!revealed) return null;

  const total = data?.totalPicks ?? 0;
  const dist = data?.distribution ?? [0, 0, 0, 0, 0];
  const highCount = data?.highConfidenceCount ?? 0;

  return (
    <div className="mt-px">
      {/* Collapsed row — tap target */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-3 py-2.5"
        style={{ minHeight: 44 }}
        aria-expanded={expanded}
        aria-label="Crowd confidence"
      >
        <span className="text-[10px] font-medium text-ps-text-ter">
          Crowd confidence
        </span>
        <svg
          className="h-4 w-4 text-ps-text-ter/30 transition-transform duration-150 ease-out"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded content — slide down */}
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{
          maxHeight: expanded ? 120 : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="border-t border-ps-border/[0.08] px-3 pb-3 pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <span className="text-[10px] text-ps-text-ter">Loading...</span>
            </div>
          ) : data && total > 0 ? (
            <>
              {/* Text summary */}
              <p className="text-xs font-medium text-ps-text">
                {total} pick{total !== 1 ? "s" : ""} —{" "}
                {highCount} confident or higher
              </p>

              {/* Segmented bar (thermometer) */}
              <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full">
                {dist.map((count, i) => {
                  if (count === 0) return null;
                  const pct = (count / total) * 100;
                  return (
                    <div
                      key={i}
                      className={`${SEGMENT_COLORS[i]} first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${pct}%`, minWidth: count > 0 ? 4 : 0 }}
                    />
                  );
                })}
              </div>

              {/* Detail row — counts positioned below bar */}
              <div className="mt-1 flex">
                {dist.map((count, i) => {
                  const pct = total > 0 ? (count / total) * 100 : 20;
                  return (
                    <div
                      key={i}
                      className="text-center"
                      style={{
                        width: count > 0 ? `${pct}%` : 0,
                        minWidth: count > 0 ? 16 : 0,
                        display: count > 0 ? "block" : "none",
                      }}
                    >
                      <span
                        className="font-mono text-[11px] text-ps-text/40"
                        title={LEVEL_LABELS[i]}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-ps-text-ter">
              No confidence data available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
