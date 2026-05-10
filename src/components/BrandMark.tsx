"use client";

import { OracleDot } from "@/components/OracleDot";
import { UmpireLogo } from "@/components/UmpireLogo";
import { BubbleCall } from "@/components/BubbleCall";

interface BrandMarkProps {
  /** CSS width/height classes passed through to the rendered mark */
  className?: string;
  /**
   * Sport slug. GAA sports always render UmpireLogo.
   * Other sports use a daily-stable weighted random selection:
   *   60% OracleDot | 30% UmpireLogo | 10% BubbleCall
   */
  sport?: string;
}

const GAA_SPORTS = new Set(["gaa", "gaelic_football", "hurling"]);

/**
 * Returns a stable pseudo-random float [0, 1) seeded by today's date string.
 * Changes daily but is consistent within a single day.
 */
function dailyRandom(): number {
  const seed = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    // Simple djb2-style hash
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Normalise to [0, 1)
  return (hash % 10000) / 10000;
}

/**
 * Selects a mark based on weighted daily-stable random:
 *   0.00 – 0.59 → OracleDot   (60%)
 *   0.60 – 0.89 → UmpireLogo  (30%)
 *   0.90 – 0.99 → BubbleCall  (10%)
 */
function selectMark(): "oracle" | "umpire" | "bubble" {
  const r = dailyRandom();
  if (r < 0.6) return "oracle";
  if (r < 0.9) return "umpire";
  return "bubble";
}

/**
 * BrandMark — rotates between the three brand marks.
 * GAA sports are always shown with UmpireLogo.
 * All other sports use a daily-stable weighted random selection.
 *
 * Usage:
 *   <BrandMark className="w-8 h-auto" />
 *   <BrandMark sport="gaa" className="w-8 h-auto" />
 *   <BrandMark sport="formula_1" className="w-8 h-auto" />
 */
export function BrandMark({ className, sport }: BrandMarkProps) {
  if (sport && GAA_SPORTS.has(sport)) {
    return <UmpireLogo className={className} />;
  }

  const mark = selectMark();

  if (mark === "oracle") return <OracleDot className={className} />;
  if (mark === "bubble") return <BubbleCall className={className} />;
  return <UmpireLogo className={className} />;
}
