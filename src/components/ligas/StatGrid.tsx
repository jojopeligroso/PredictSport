import type React from "react";

/**
 * StatGrid / StatTile — compact metric display for the winter-league team
 * pages. Server-renderable (no interactivity). Values use the mono token per
 * the design system's "scores/stats/metadata" rule.
 */

export interface Stat {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional sub-line under the value (e.g. per-game rate). */
  sub?: React.ReactNode;
  /** Tint the value with the correct/wrong tokens for +/- diffs. */
  tone?: "default" | "good" | "bad";
}

function toneClass(tone: Stat["tone"]): string {
  if (tone === "good") return "text-ps-green";
  if (tone === "bad") return "text-ps-red";
  return "text-ps-text";
}

export function StatTile({ label, value, sub, tone = "default" }: Stat) {
  return (
    <div className="rounded-xl border border-ps-border bg-ps-bg-alt/40 px-3 py-2.5">
      <p className="font-mono text-micro font-bold uppercase tracking-[0.1em] text-ps-text-ter">
        {label}
      </p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${toneClass(tone)}`}>
        {value}
      </p>
      {sub ? (
        <p className="font-mono text-micro text-ps-text-ter">{sub}</p>
      ) : null}
    </div>
  );
}

export function StatGrid({
  stats,
  cols = 2,
}: {
  stats: Stat[];
  cols?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {stats.map((s, i) => (
        <StatTile key={i} {...s} />
      ))}
    </div>
  );
}

/** A single label→value row, for dense lists (splits, head-to-head). */
export function StatRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ps-text-sec">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-ps-text">
        {value}
      </span>
    </div>
  );
}
