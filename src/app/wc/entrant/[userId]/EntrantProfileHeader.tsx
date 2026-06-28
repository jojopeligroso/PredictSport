"use client";

import Link from "next/link";
import type {
  EntrantAccuracy,
  EntrantTagRow,
  FormStreakEntry,
} from "./fetchEntrantProfileData";

interface EntrantProfileHeaderProps {
  displayName: string;
  rank: number;
  totalPoints: number;
  accuracy: EntrantAccuracy;
  formatStatus: "alive" | "eliminated" | "dead" | null;
  formStreak: FormStreakEntry[];
  activeTags: EntrantTagRow[];
  isSelf: boolean;
  from?: string;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function EntrantProfileHeader({
  displayName,
  rank,
  totalPoints,
  accuracy,
  formatStatus,
  formStreak,
  activeTags,
  isSelf,
  from,
}: EntrantProfileHeaderProps) {
  return (
    <div>
      {/* Back link */}
      <Link
        href={`/wc/leaderboard${from ? `?tab=${from}` : ""}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ps-amber-deep"
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Leaderboard
      </Link>

      {/* Name */}
      <div className="mt-3">
        <h1 className="font-display text-lg font-extrabold text-ps-text">
          {displayName}
          {isSelf && (
            <span className="ml-2 rounded bg-ps-amber/20 px-1.5 py-0.5 align-middle text-micro font-bold text-ps-amber-deep">
              You
            </span>
          )}
        </h1>
      </div>

      {/* Row 1: Rank + Points */}
      <div className="mt-2 flex items-baseline gap-4">
        <span className="font-mono text-2xl font-extrabold text-ps-amber-deep">
          {ordinalSuffix(rank)}
        </span>
        <span className="font-mono text-2xl font-extrabold text-ps-text">
          {totalPoints}
          <span className="ml-1 text-sm font-bold text-ps-text-ter">pts</span>
        </span>
      </div>

      {/* Row 2: Accuracy + Format status */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {accuracy.outcome && (
          <span className="font-mono text-sm text-ps-text-sec">
            <span className="font-bold text-ps-green">{accuracy.outcome.pct}%</span>{" "}
            outcome
          </span>
        )}
        {accuracy.exact && (
          <span className="font-mono text-sm text-ps-text-sec">
            <span className="font-bold text-ps-amber-deep">{accuracy.exact.correct}</span>{" "}
            exact
          </span>
        )}
        {formatStatus && (
          <span
            className={`text-sm font-bold ${
              formatStatus === "alive"
                ? "text-ps-green"
                : "text-ps-red"
            } ${formatStatus === "dead" ? "line-through" : ""}`}
          >
            {formatStatus === "alive"
              ? "Still In"
              : formatStatus === "eliminated"
                ? "Out"
                : "Dead"}
          </span>
        )}
      </div>

      {/* Row 3: Form streak */}
      {formStreak.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          {formStreak.map((entry) => (
            <span
              key={entry.roundNumber}
              className={`font-mono text-sm font-bold ${
                entry.correct ? "text-ps-green" : "text-ps-red"
              }`}
              title={entry.roundName}
            >
              {entry.correct ? "\u2713" : "\u2717"}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: Active tag pills */}
      {activeTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {activeTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2 py-0.5 font-display text-[10px] font-extrabold uppercase leading-none text-white"
              style={{
                backgroundColor:
                  tag.definition?.visual.gold
                    ? "#f59e0b"
                    : tag.definition?.visual.borderColor ?? "#888",
                letterSpacing: "0.05em",
              }}
            >
              {tag.definition?.layer1 ?? tag.tagName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
