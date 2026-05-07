"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Avatar,
  FormBadge,
  AccuracyRing,
  MovementBadge,
  SectionHeader,
  SendToThread,
} from "@/components/ui";
import { psDefaultLeaderboardCopy } from "@/lib/whatsapp";

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

/**
 * Derive rivalry text from the two closest-scoring entries at the top.
 */
function getRivalryBanner(entries: LeaderboardEntry[]): { headline: string; body: string } | null {
  if (entries.length < 2) return null;
  const top = entries[0]!;
  const second = entries[1]!;
  const gap = top.total_points - second.total_points;
  if (gap > 10) return null; // only show when it's close
  if (gap === 0) {
    return {
      headline: "Dead heat",
      body: `${top.display_name} and ${second.display_name} are level on points — tiebreaker decides it.`,
    };
  }
  return {
    headline: "Going to the wire",
    body: `${top.display_name} leads by just ${gap} point${gap === 1 ? "" : "s"} — ${second.display_name} is right on their heels.`,
  };
}

/**
 * Compute per-sport accuracy leaders from all entries.
 */
function getBestInClass(
  entries: LeaderboardEntry[]
): Array<{ sport: string; name: string; pct: number }> {
  // Build per-sport per-user accuracy
  const perSportUser = new Map<string, Map<string, { correct: number; total: number; name: string }>>();
  for (const entry of entries) {
    for (const pred of entry.predictions) {
      if (pred.is_correct === null) continue;
      const sport = pred.sport;
      if (!perSportUser.has(sport)) perSportUser.set(sport, new Map());
      const userMap = perSportUser.get(sport)!;
      const existing = userMap.get(entry.user_id) ?? { correct: 0, total: 0, name: entry.display_name };
      existing.total++;
      if (pred.is_correct) existing.correct++;
      userMap.set(entry.user_id, existing);
    }
  }

  const result: Array<{ sport: string; name: string; pct: number }> = [];
  for (const [sport, userMap] of perSportUser) {
    let best: { name: string; pct: number } | null = null;
    for (const { correct, total, name } of userMap.values()) {
      if (total < 2) continue; // need at least 2 predictions to qualify
      const pct = Math.round((correct / total) * 100);
      if (!best || pct > best.pct) {
        best = { name, pct };
      }
    }
    if (best) {
      result.push({ sport, name: best.name, pct: best.pct });
    }
  }

  return result.slice(0, 3);
}

const SPORT_META: Record<string, { emoji: string; label: string }> = {
  soccer: { emoji: "⚽", label: "Soccer" },
  football: { emoji: "⚽", label: "Football" },
  gaa: { emoji: "🏐", label: "GAA" },
  f1: { emoji: "🏎️", label: "F1" },
  rugby: { emoji: "🏉", label: "Rugby" },
  golf: { emoji: "⛳", label: "Golf" },
  tennis: { emoji: "🎾", label: "Tennis" },
  basketball: { emoji: "🏀", label: "Basketball" },
  nfl: { emoji: "🏈", label: "NFL" },
  nba: { emoji: "🏀", label: "NBA" },
  baseball: { emoji: "⚾", label: "Baseball" },
  mlb: { emoji: "⚾", label: "MLB" },
  hockey: { emoji: "🏒", label: "Hockey" },
  nhl: { emoji: "🏒", label: "NHL" },
  snooker: { emoji: "🎱", label: "Snooker" },
  horseracing: { emoji: "🐎", label: "Racing" },
  horse_racing: { emoji: "🐎", label: "Racing" },
};

function sportMeta(sport: string): { emoji: string; label: string } {
  return SPORT_META[sport.toLowerCase()] ?? { emoji: "🏆", label: sport };
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

// -- Podium card config --

const PODIUM_CONFIG = {
  1: {
    gradient: "from-[#3b82f6] to-[#8b5cf6]",
    medal: "🥇",
  },
  2: {
    gradient: "from-[#94a3b8] to-[#475569]",
    medal: "🥈",
  },
  3: {
    gradient: "from-[#d97706] to-[#92400e]",
    medal: "🥉",
  },
} as const;

// -- Podium card (top 3 — vertical stack, gradient bg) --

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
        className={`relative w-full overflow-hidden bg-gradient-to-r ${config.gradient} p-[12px_14px] text-left`}
        style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}
      >
        {/* Faded rank watermark — bottom-right, 110px, 10% opacity */}
        <span
          className="pointer-events-none absolute select-none font-display leading-none text-white/10"
          style={{ fontSize: 110, bottom: -22, right: -6 }}
          aria-hidden="true"
        >
          {entry.rank}
        </span>

        <div className="relative flex items-center gap-3">
          {/* Medal + Avatar */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="text-[22px] leading-none" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} aria-hidden="true">
              {config.medal}
            </span>
            <Avatar
              initials={initials}
              color={color}
              size={42}
              ring="0 0 0 2px rgba(255,255,255,0.5)"
            />
          </div>

          {/* Name + form badges */}
          <div className="min-w-0 flex-1">
            <Link
              href={`/leaderboard/${entry.user_id}`}
              className="truncate font-bold text-white hover:underline"
              style={{ fontSize: 14, letterSpacing: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {entry.display_name}
            </Link>
            {form.length > 0 && (
              <div className="mt-1 flex items-center gap-[3px]">
                {form.map((letter, i) => (
                  // Form badges on gradient: white-tinted squares matching prototype
                  <span
                    key={i}
                    className="inline-flex items-center justify-center font-extrabold text-white"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.2)",
                      fontSize: 9,
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Points — Bebas Neue 26px */}
          <div className="shrink-0 text-right">
            <p className="font-display leading-none text-white" style={{ fontSize: 26, letterSpacing: 0.6 }}>
              {entry.total_points}
            </p>
            <p
              className="mt-0.5 font-bold uppercase text-white/85"
              style={{ fontSize: 9, letterSpacing: 1 }}
            >
              points
            </p>
          </div>
        </div>

        {/* Expand chevron */}
        <div className="absolute right-3 top-3">
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
        className={`group w-full px-3 py-[11px] text-left transition-colors hover:bg-ps-chip ${
          !isLast ? "border-b border-ps-border" : ""
        }`}
      >
        <div className="flex items-center gap-[10px]">
          {/* Rank */}
          <span
            className="w-[18px] shrink-0 text-center font-extrabold tabular-nums text-ps-text-ter"
            style={{ fontSize: 12.5 }}
          >
            {entry.rank}
          </span>

          {/* Avatar */}
          <Avatar initials={initials} color={color} size={30} />

          {/* Name + form */}
          <div className="min-w-0 flex-1">
            <Link
              href={`/leaderboard/${entry.user_id}`}
              className="truncate font-bold text-ps-text hover:underline"
              style={{ fontSize: 13 }}
              onClick={(e) => e.stopPropagation()}
            >
              {entry.display_name}
            </Link>
            {form.length > 0 && (
              <div className="mt-[3px] flex gap-[2px]">
                {form.map((letter, i) => (
                  <FormBadge key={i} letter={letter} size={14} />
                ))}
              </div>
            )}
          </div>

          {/* Accuracy ring */}
          {entry.total_predictions > 0 ? (
            <AccuracyRing value={accuracyValue} size={32} />
          ) : (
            <span className="w-8 text-center text-xs text-ps-text-ter">—</span>
          )}

          {/* Points + movement stacked */}
          <div className="shrink-0 min-w-[40px] text-right">
            <p
              className="font-extrabold tabular-nums leading-none text-ps-text"
              style={{ fontSize: 16 }}
            >
              {entry.total_points}
            </p>
            <div className="mt-1">
              <MovementBadge mv={0} />
            </div>
          </div>

          {/* WA share */}
          <div onClick={(e) => e.stopPropagation()}>
            <SendToThread
              variant="icon"
              defaultText={psDefaultLeaderboardCopy({
                name: entry.display_name,
                points: entry.total_points,
                movement: 0,
              })}
            />
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

// -- Best in Class section --

function BestInClass({ entries }: { entries: LeaderboardEntry[] }) {
  const bests = getBestInClass(entries);
  if (bests.length === 0) return null;

  return (
    <div className="mt-[14px]">
      <SectionHeader label="Best in Class" accent="var(--ps-green)" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {bests.map((b) => {
          const meta = sportMeta(b.sport);
          return (
            <div
              key={b.sport}
              className="rounded-xl border border-ps-border bg-ps-surface px-2 py-[10px] text-center"
            >
              <div className="text-[18px] leading-none">{meta.emoji}</div>
              <div
                className="mt-0.5 font-extrabold uppercase text-ps-text-sec"
                style={{ fontSize: 9, letterSpacing: 1 }}
              >
                {meta.label}
              </div>
              <div className="mt-1 font-extrabold text-ps-text" style={{ fontSize: 13 }}>
                {b.name}
              </div>
              <div className="mt-0.5 font-bold text-ps-green" style={{ fontSize: 11 }}>
                {b.pct}% acc
              </div>
            </div>
          );
        })}
      </div>
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
  const rivalry = getRivalryBanner(entries);

  return (
    <>
      {/* Rivalry banner — amber dashed border, shown when top 2 are close */}
      {rivalry && (
        <div
          className="mx-0 mt-[6px] mb-3 flex items-center gap-[10px] rounded-xl px-3 py-[10px]"
          style={{
            background: "rgba(245,158,11,0.14)",
            border: "1px dashed var(--ps-amber)",
          }}
        >
          <span className="text-[18px] leading-none" aria-hidden="true">🔥</span>
          <div className="min-w-0 flex-1">
            <p
              className="font-extrabold uppercase text-ps-amber-deep"
              style={{ fontSize: 9.5, letterSpacing: 1.2 }}
            >
              {rivalry.headline}
            </p>
            <p className="mt-0.5 text-ps-text" style={{ fontSize: 12, lineHeight: 1.35 }}>
              {rivalry.body}
            </p>
          </div>
        </div>
      )}

      {/* Podium cards — stacked vertically */}
      {podium.length > 0 && (
        <div className="flex flex-col gap-2">
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

      {/* "The Rest" table */}
      {rest.length > 0 && (
        <div className="mt-[14px]">
          <SectionHeader label="The Rest" accent="var(--ps-blue)" />
          <div className="mt-3 overflow-hidden rounded-2xl border border-ps-border bg-ps-surface">
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

      {/* Best in Class */}
      <BestInClass entries={entries} />

      {/* Tiebreaker resolution (shown only when relevant) */}
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
