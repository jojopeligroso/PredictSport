"use client";

import { useState } from "react";
import {
  Avatar,
  FormBadge,
  AccuracyRing,
  MovementBadge,
  SectionHeader,
} from "@/components/ui";

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

// -- Helpers --

const AVATAR_PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#0aa86d",
  "#f59e0b",
  "#e23d4f",
  "#0ea5e9",
  "#d97706",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

/**
 * Map a prediction outcome to FormBadge letter.
 * W = correct, L = wrong, P = partial or pending
 */
function predictionToFormLetter(p: EventPrediction): "W" | "L" | "P" {
  if (p.is_correct === null) return "P";
  if (p.is_correct) return "W";
  if (p.is_partial) return "P";
  return "L";
}

/**
 * Get the last N predictions as form badges (most recent last).
 */
function getForm(predictions: EventPrediction[], n = 5): Array<"W" | "L" | "P"> {
  const resulted = predictions
    .filter((p) => p.is_correct !== null || p.is_partial)
    .slice(-n);
  return resulted.map(predictionToFormLetter);
}

function formatPredictionValue(data: Record<string, unknown>): string {
  if (data?.selection && typeof data.selection === "string") return data.selection;
  if (data?.value !== undefined) return String(data.value);
  if (data?.winner && typeof data.winner === "string") return data.winner;
  const str = JSON.stringify(data);
  return str.length > 60 ? str.slice(0, 57) + "..." : str;
}

function formatResultValue(data: Record<string, unknown> | null): string {
  if (!data) return "Awaiting result";
  if (data?.winner && typeof data.winner === "string") return data.winner;
  if (data?.result && typeof data.result === "string") return data.result;
  if (data?.value !== undefined) return String(data.value);
  const str = JSON.stringify(data);
  return str.length > 60 ? str.slice(0, 57) + "..." : str;
}

// -- Outcome badge (for expanded detail table) --

function OutcomeBadge({ isCorrect, isPartial }: { isCorrect: boolean | null; isPartial: boolean }) {
  if (isCorrect === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-ps-chip px-2 py-0.5 text-xs font-medium text-ps-text-sec">
        Pending
      </span>
    );
  }
  if (isCorrect) {
    return (
      <span className="inline-flex items-center rounded-full bg-ps-green-soft px-2 py-0.5 text-xs font-medium text-ps-green">
        Correct
      </span>
    );
  }
  if (isPartial) {
    return (
      <span className="inline-flex items-center rounded-full bg-ps-amber-soft px-2 py-0.5 text-xs font-medium text-ps-amber-deep">
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-ps-red-soft px-2 py-0.5 text-xs font-medium text-ps-red">
      Wrong
    </span>
  );
}

// -- Expanded row detail --

function ExpandedDetail({ entry }: { entry: LeaderboardEntry }) {
  const predictions = entry.predictions ?? [];

  if (predictions.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-ps-text-sec">
        No predictions submitted
      </div>
    );
  }

  return (
    <div className="overflow-x-auto px-4 pb-4 pt-3">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
            <th className="pb-2 pr-4">Event</th>
            <th className="pb-2 pr-4">Sport</th>
            <th className="pb-2 pr-4">Prediction</th>
            <th className="pb-2 pr-4">Result</th>
            <th className="pb-2 pr-4">Outcome</th>
            <th className="pb-2 text-right">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ps-border">
          {predictions.map((p) => (
            <tr key={p.event_id} className="text-ps-text">
              <td className="py-2 pr-4 font-medium">{p.event_name}</td>
              <td className="py-2 pr-4 text-ps-text-sec">{p.sport}</td>
              <td className="py-2 pr-4">{formatPredictionValue(p.prediction_data)}</td>
              <td className="py-2 pr-4 text-ps-text-sec">{formatResultValue(p.result_data)}</td>
              <td className="py-2 pr-4">
                <OutcomeBadge isCorrect={p.is_correct} isPartial={p.is_partial} />
              </td>
              <td className="py-2 text-right font-mono text-sm font-semibold text-ps-text">
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

function TiebreakerSection({ entries }: { entries: LeaderboardEntry[] }) {
  const pointGroups = new Map<number, LeaderboardEntry[]>();
  for (const e of entries) {
    const group = pointGroups.get(e.total_points) ?? [];
    group.push(e);
    pointGroups.set(e.total_points, group);
  }

  const tiedGroups = Array.from(pointGroups.entries())
    .filter(([, group]) => group.length > 1 && group.some((e) => e.tiebreaker))
    .sort(([a], [b]) => b - a);

  if (tiedGroups.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-ps-border bg-ps-surface p-5">
      <div className="mb-4">
        <SectionHeader label="Tiebreaker Resolution" accent="var(--ps-amber)" />
      </div>
      {tiedGroups.map(([points, group]) => {
        const tb = group.find((e) => e.tiebreaker)?.tiebreaker;
        if (!tb) return null;

        return (
          <div key={points} className="mb-4 last:mb-0">
            <p className="mb-2 text-sm text-ps-text-sec">
              <span className="font-medium text-ps-text">{tb.question_text}</span>
              {tb.correct_value !== null ? (
                <span className="ml-2 rounded bg-ps-chip px-2 py-0.5 text-xs font-mono text-ps-text-sec">
                  Answer: {tb.correct_value}
                </span>
              ) : (
                <span className="ml-2 rounded bg-ps-amber-soft px-2 py-0.5 text-xs text-ps-amber-deep">
                  Tiebreaker pending
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              {group
                .sort(
                  (a, b) =>
                    (a.tiebreaker?.distance ?? Infinity) -
                    (b.tiebreaker?.distance ?? Infinity)
                )
                .map((e, i) => {
                  const isClosest = i === 0 && tb.correct_value !== null;
                  return (
                    <div
                      key={e.user_id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                        isClosest
                          ? "border-ps-green bg-ps-green-soft"
                          : "border-ps-border bg-ps-chip"
                      }`}
                    >
                      <span className="font-medium text-ps-text">{e.display_name}</span>
                      {e.tiebreaker?.user_answer !== null ? (
                        <span className="font-mono text-ps-text-sec">
                          {e.tiebreaker?.user_answer}
                        </span>
                      ) : (
                        <span className="text-ps-text-ter">No answer</span>
                      )}
                      {isClosest && e.tiebreaker?.distance !== null && (
                        <span className="text-xs text-ps-green">
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

// -- Podium card (top 3) --

const PODIUM_CONFIG = {
  1: {
    gradient: "from-[#3b82f6] to-[#8b5cf6]",
    medal: "🥇",
    label: "1ST",
  },
  2: {
    gradient: "from-[#94a3b8] to-[#475569]",
    medal: "🥈",
    label: "2ND",
  },
  3: {
    gradient: "from-[#d97706] to-[#92400e]",
    medal: "🥉",
    label: "3RD",
  },
} as const;

function PodiumCard({
  entry,
  onExpand,
  isExpanded,
}: {
  entry: LeaderboardEntry;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const config = PODIUM_CONFIG[entry.rank as 1 | 2 | 3];
  if (!config) return null;

  const initials = getInitials(entry.display_name);
  const color = avatarColor(entry.user_id);
  const form = getForm(entry.predictions);

  return (
    <div className="overflow-hidden rounded-2xl shadow-sm">
      <button
        onClick={onExpand}
        aria-expanded={isExpanded}
        aria-controls={`detail-${entry.user_id}`}
        className={`relative w-full overflow-hidden bg-gradient-to-r ${config.gradient} p-4 text-left`}
      >
        {/* Faded rank watermark */}
        <span
          className="pointer-events-none absolute bottom-0 right-2 font-display leading-none text-white/10 select-none"
          style={{ fontSize: "clamp(4rem, 12vw, 7rem)" }}
          aria-hidden="true"
        >
          {entry.rank}
        </span>

        <div className="relative flex items-center gap-3">
          {/* Medal + Avatar */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl leading-none" aria-hidden="true">
              {config.medal}
            </span>
            <Avatar
              initials={initials}
              color={color}
              size={44}
              ring="0 0 0 2px rgba(255,255,255,0.6)"
            />
          </div>

          {/* Name + form */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white/70 uppercase tracking-widest">
              {config.label}
            </p>
            <p className="truncate font-display text-[22px] leading-tight tracking-wide text-white">
              {entry.display_name}
            </p>
            {form.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1">
                {form.map((letter, i) => (
                  <FormBadge key={i} letter={letter} size={18} />
                ))}
              </div>
            )}
          </div>

          {/* Points */}
          <div className="shrink-0 text-right">
            <p className="font-display text-[36px] leading-none tracking-wide text-white">
              {entry.total_points}
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-white/60">
              pts
            </p>
          </div>
        </div>

        {/* Expand chevron */}
        <div className="absolute top-3 right-3">
          <ChevronIcon isOpen={isExpanded} light />
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div
          id={`detail-${entry.user_id}`}
          className="border-x border-b border-ps-border bg-ps-surface"
        >
          <ExpandedDetail entry={entry} />
        </div>
      )}
    </div>
  );
}

// -- Table row (rank 4+) --

function TableRow({
  entry,
  onExpand,
  isExpanded,
  isLast,
}: {
  entry: LeaderboardEntry;
  onExpand: () => void;
  isExpanded: boolean;
  isLast: boolean;
}) {
  const initials = getInitials(entry.display_name);
  const color = avatarColor(entry.user_id);
  const form = getForm(entry.predictions);
  const accuracyValue = entry.accuracy / 100;

  return (
    <div>
      <button
        onClick={onExpand}
        aria-expanded={isExpanded}
        aria-controls={`detail-${entry.user_id}`}
        className={`group w-full px-4 py-3 text-left transition-colors hover:bg-ps-chip ${
          !isLast ? "border-b border-ps-border" : ""
        }`}
      >
        {/* Mobile */}
        <div className="flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-3">
            <span className="w-6 text-center text-sm font-bold tabular-nums text-ps-text-ter">
              {entry.rank}
            </span>
            <Avatar initials={initials} color={color} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ps-text">
                {entry.display_name}
              </p>
              {form.length > 0 && (
                <div className="mt-1 flex gap-0.5">
                  {form.map((letter, i) => (
                    <FormBadge key={i} letter={letter} size={16} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-display text-xl tracking-wide text-ps-text">
              {entry.total_points}
            </span>
            <ChevronIcon isOpen={isExpanded} />
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden sm:flex sm:items-center sm:gap-3">
          {/* Rank */}
          <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-ps-text-ter">
            {entry.rank}
          </span>

          {/* Avatar */}
          <Avatar initials={initials} color={color} size={34} />

          {/* Name */}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ps-text">
            {entry.display_name}
          </span>

          {/* Form badges */}
          <div className="flex items-center gap-0.5">
            {form.length > 0 ? (
              form.map((letter, i) => <FormBadge key={i} letter={letter} size={20} />)
            ) : (
              <span className="text-xs text-ps-text-ter">—</span>
            )}
          </div>

          {/* Accuracy ring */}
          <div className="shrink-0">
            {entry.total_predictions > 0 ? (
              <AccuracyRing value={accuracyValue} size={36} />
            ) : (
              <span className="text-xs text-ps-text-ter">—</span>
            )}
          </div>

          {/* Points */}
          <span className="w-14 shrink-0 text-right font-display text-xl tracking-wide text-ps-text">
            {entry.total_points}
          </span>

          {/* Movement */}
          <div className="w-8 shrink-0 text-right">
            <MovementBadge mv={0} />
          </div>

          {/* Chevron */}
          <ChevronIcon isOpen={isExpanded} />
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div
          id={`detail-${entry.user_id}`}
          className="border-b border-ps-border bg-ps-surface2"
        >
          <ExpandedDetail entry={entry} />
        </div>
      )}
    </div>
  );
}

// -- Main export --

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  if (entries.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
        No results yet — check back once events start resolving.
      </div>
    );
  }

  const podium = entries.filter((e) => e.rank <= 3);
  const rest = entries.filter((e) => e.rank > 3);

  return (
    <>
      {/* Podium cards */}
      {podium.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {podium.map((entry) => (
            <PodiumCard
              key={entry.user_id}
              entry={entry}
              onExpand={() => toggleExpand(entry.user_id)}
              isExpanded={expandedUserId === entry.user_id}
            />
          ))}
        </div>
      )}

      {/* Rest of the table */}
      {rest.length > 0 && (
        <div className="mt-8">
          <SectionHeader label="The Rest" accent="var(--ps-blue)" />
          <div className="mt-3 overflow-hidden rounded-2xl border border-ps-border bg-ps-surface">
            {/* Column headers — desktop only */}
            <div className="hidden border-b border-ps-border px-4 py-2 sm:flex sm:items-center sm:gap-3">
              <span className="w-6 shrink-0" />
              <span className="w-[34px] shrink-0" />
              <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                Player
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                Form
              </span>
              <span className="w-9 shrink-0 text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                Acc
              </span>
              <span className="w-14 shrink-0 text-right text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                Pts
              </span>
              <span className="w-8 shrink-0 text-right text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                Mv
              </span>
              <span className="w-4 shrink-0" />
            </div>

            {rest.map((entry, idx) => (
              <TableRow
                key={entry.user_id}
                entry={entry}
                onExpand={() => toggleExpand(entry.user_id)}
                isExpanded={expandedUserId === entry.user_id}
                isLast={idx === rest.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      <TiebreakerSection entries={entries} />
    </>
  );
}

function ChevronIcon({ isOpen, light = false }: { isOpen: boolean; light?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
        isOpen ? "rotate-180" : ""
      } ${light ? "text-white/50" : "text-ps-text-ter"}`}
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
