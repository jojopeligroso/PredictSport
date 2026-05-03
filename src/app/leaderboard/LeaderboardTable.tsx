"use client";

import { useState } from "react";
import Image from "next/image";

// -- Types for data passed from the server component --

export interface EventPrediction {
  event_id: string;
  event_name: string;
  sport: string;
  prediction_data: Record<string, unknown>;
  result_data: Record<string, unknown> | null;
  is_correct: boolean | null;
  is_partial: boolean;
  points_awarded: number;
}

export interface TiebreakerInfo {
  question_text: string;
  correct_value: number | null;
  user_answer: number | null;
  distance: number | null;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  rank: number;
  total_points: number;
  correct_count: number;
  partial_count: number;
  wrong_count: number;
  total_predictions: number;
  accuracy: number;
  streak: number;
  tiebreaker: TiebreakerInfo | null;
  predictions: EventPrediction[];
}

// -- Subcomponents --

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
      {rank}
    </span>
  );
}

function Avatar({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
      />
    );
  }

  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 ring-2 ring-zinc-100 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-800">
      {initials}
    </span>
  );
}

function StreakIndicator({ streak }: { streak: number }) {
  if (streak < 2) return null;
  return (
    <span
      className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
      title={`${streak} correct in a row`}
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 1C5.5 1 3 3 3 6c0 2 1 3 2 4.5C6 12 6 13 6 14h4c0-1 0-2 1-3.5C12 9 13 8 13 6c0-3-2.5-5-5-5zm-1 14h2v1H7v-1z" />
      </svg>
      {streak}
    </span>
  );
}

function OutcomeBadge({
  isCorrect,
  isPartial,
}: {
  isCorrect: boolean | null;
  isPartial: boolean;
}) {
  if (isCorrect === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        Pending
      </span>
    );
  }
  if (isCorrect) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        Correct
      </span>
    );
  }
  if (isPartial) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
      Wrong
    </span>
  );
}

function formatPredictionValue(data: Record<string, unknown>): string {
  // Handle common prediction_data shapes
  if (data?.selection && typeof data.selection === "string") {
    return data.selection;
  }
  if (data?.value !== undefined) {
    return String(data.value);
  }
  if (data?.winner && typeof data.winner === "string") {
    return data.winner;
  }
  // Fallback: show stringified JSON briefly
  const str = JSON.stringify(data);
  return str.length > 60 ? str.slice(0, 57) + "..." : str;
}

function formatResultValue(data: Record<string, unknown> | null): string {
  if (!data) return "Awaiting result";
  if (data?.winner && typeof data.winner === "string") {
    return data.winner;
  }
  if (data?.result && typeof data.result === "string") {
    return data.result;
  }
  if (data?.value !== undefined) {
    return String(data.value);
  }
  const str = JSON.stringify(data);
  return str.length > 60 ? str.slice(0, 57) + "..." : str;
}

// -- Expanded row detail --

function ExpandedDetail({ entry }: { entry: LeaderboardEntry }) {
  const predictions = entry.predictions ?? [];

  if (predictions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No predictions submitted
      </div>
    );
  }

  return (
    <div className="overflow-x-auto px-4 pb-4 pt-2">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <th className="pb-2 pr-4">Event</th>
            <th className="pb-2 pr-4">Sport</th>
            <th className="pb-2 pr-4">Prediction</th>
            <th className="pb-2 pr-4">Result</th>
            <th className="pb-2 pr-4">Outcome</th>
            <th className="pb-2 text-right">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {predictions.map((p) => (
            <tr key={p.event_id} className="text-zinc-700 dark:text-zinc-300">
              <td className="py-2 pr-4 font-medium">{p.event_name}</td>
              <td className="py-2 pr-4 text-zinc-500 dark:text-zinc-400">
                {p.sport}
              </td>
              <td className="py-2 pr-4">
                {formatPredictionValue(p.prediction_data)}
              </td>
              <td className="py-2 pr-4">
                {formatResultValue(p.result_data)}
              </td>
              <td className="py-2 pr-4">
                <OutcomeBadge
                  isCorrect={p.is_correct}
                  isPartial={p.is_partial}
                />
              </td>
              <td className="py-2 text-right font-mono text-sm">
                {p.points_awarded > 0 ? `+${p.points_awarded}` : p.points_awarded}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -- Tiebreaker section --

function TiebreakerSection({
  entries,
}: {
  entries: LeaderboardEntry[];
}) {
  // Group users by total_points to find ties
  const pointGroups = new Map<number, LeaderboardEntry[]>();
  for (const e of entries) {
    const group = pointGroups.get(e.total_points) ?? [];
    group.push(e);
    pointGroups.set(e.total_points, group);
  }

  // Only show tiebreaker groups where 2+ users share the same score
  const tiedGroups = Array.from(pointGroups.entries())
    .filter(([, group]) => group.length > 1 && group.some((e) => e.tiebreaker))
    .sort(([a], [b]) => b - a);

  if (tiedGroups.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Tiebreaker Resolution
      </h3>
      {tiedGroups.map(([points, group]) => {
        const tb = group.find((e) => e.tiebreaker)?.tiebreaker;
        if (!tb) return null;

        return (
          <div key={points} className="mb-4 last:mb-0">
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">{tb.question_text}</span>
              {tb.correct_value !== null ? (
                <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono dark:bg-zinc-800">
                  Answer: {tb.correct_value}
                </span>
              ) : (
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  Tiebreaker pending
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              {group
                .sort((a, b) => (a.tiebreaker?.distance ?? Infinity) - (b.tiebreaker?.distance ?? Infinity))
                .map((e, i) => {
                  const isClosest = i === 0 && tb.correct_value !== null;
                  return (
                    <div
                      key={e.user_id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        isClosest
                          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                          : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
                      }`}
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {e.display_name}
                      </span>
                      {e.tiebreaker?.user_answer !== null ? (
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">
                          {e.tiebreaker?.user_answer}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          No answer
                        </span>
                      )}
                      {isClosest && e.tiebreaker?.distance !== null && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          (off by {e.tiebreaker?.distance})
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- Main table --

export function LeaderboardTable({
  entries,
}: {
  entries: LeaderboardEntry[];
}) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  if (entries.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        No results yet -- check back once events start resolving.
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="hidden border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:grid sm:grid-cols-12 sm:gap-2 dark:border-zinc-800 dark:text-zinc-400">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-3">Player</div>
          <div className="col-span-2 text-right">Points</div>
          <div className="col-span-1 text-center" title="Correct">
            C
          </div>
          <div className="col-span-1 text-center" title="Partial">
            P
          </div>
          <div className="col-span-1 text-center" title="Wrong">
            W
          </div>
          <div className="col-span-2 text-right">Accuracy</div>
          <div className="col-span-1 text-center">
            <span className="sr-only">Expand</span>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {entries.map((entry) => {
            const isExpanded = expandedUserId === entry.user_id;
            const rowHighlight =
              entry.rank === 1
                ? "bg-amber-50/50 dark:bg-amber-900/10"
                : entry.rank === 2
                  ? "bg-zinc-50/50 dark:bg-zinc-800/30"
                  : entry.rank === 3
                    ? "bg-orange-50/30 dark:bg-orange-900/10"
                    : "";

            return (
              <div key={entry.user_id}>
                <button
                  onClick={() => toggleExpand(entry.user_id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${rowHighlight}`}
                  aria-expanded={isExpanded}
                  aria-controls={`detail-${entry.user_id}`}
                >
                  {/* Mobile layout */}
                  <div className="flex items-center justify-between sm:hidden">
                    <div className="flex items-center gap-3">
                      <RankBadge rank={entry.rank} />
                      <Avatar url={entry.avatar_url} name={entry.display_name} />
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {entry.display_name}
                          </span>
                          <StreakIndicator streak={entry.streak} />
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {entry.correct_count}C / {entry.partial_count}P / {entry.wrong_count}W
                          {" -- "}
                          {entry.accuracy.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {entry.total_points}
                      </span>
                      <ChevronIcon isOpen={isExpanded} />
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-2">
                    <div className="col-span-1 flex justify-center">
                      <RankBadge rank={entry.rank} />
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <Avatar url={entry.avatar_url} name={entry.display_name} />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {entry.display_name}
                      </span>
                      <StreakIndicator streak={entry.streak} />
                    </div>
                    <div className="col-span-2 text-right font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {entry.total_points}
                    </div>
                    <div className="col-span-1 text-center text-sm text-emerald-600 dark:text-emerald-400">
                      {entry.correct_count}
                    </div>
                    <div className="col-span-1 text-center text-sm text-amber-600 dark:text-amber-400">
                      {entry.partial_count}
                    </div>
                    <div className="col-span-1 text-center text-sm text-red-500 dark:text-red-400">
                      {entry.wrong_count}
                    </div>
                    <div className="col-span-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.accuracy.toFixed(1)}%
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <ChevronIcon isOpen={isExpanded} />
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    id={`detail-${entry.user_id}`}
                    className="border-t border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/30"
                  >
                    <ExpandedDetail entry={entry} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <TiebreakerSection entries={entries} />
    </>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
        isOpen ? "rotate-180" : ""
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
