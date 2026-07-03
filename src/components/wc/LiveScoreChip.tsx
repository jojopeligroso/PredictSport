"use client";

import type { LiveScorePayload } from "@/hooks/useLiveScores";

interface LiveScoreChipProps {
  score: LiveScorePayload;
  /** Render size — "md" for match cards, "sm" for compact rows. */
  size?: "md" | "sm";
  className?: string;
}

/**
 * LiveScoreChip — shared in-progress score display (e.g. `1 – 1`).
 *
 * Mono font per the design system (scores/stats are always JetBrains Mono).
 * Colors inherit from the parent (`currentColor`) so the chip works on both
 * city-colored fixture cards (white text) and plain surfaces.
 */
export function LiveScoreChip({ score, size = "md", className }: LiveScoreChipProps) {
  const numCls = size === "md" ? "text-base" : "text-sm";
  return (
    <span
      className={`inline-flex items-baseline gap-1 font-mono font-bold tabular-nums ${className ?? ""}`}
    >
      <span className={numCls}>{score.homeScore}</span>
      <span className="text-xs font-semibold opacity-60">–</span>
      <span className={numCls}>{score.awayScore}</span>
    </span>
  );
}
