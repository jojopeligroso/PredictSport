"use client";

import { useState, useMemo, useCallback } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import type {
  Event,
  Prediction,
  PredictionType,
  EventStatus,
  EventPredictionType,
} from "@/types/database";
import { Countdown } from "./countdown";
import { PredictionForm } from "./prediction-form";
import { ExactScoreSection } from "@/components/ExactScoreSection";
import {
  SportBar,
  SportPill,
  CountdownChip,
  CommunityDonut,
  PersonaCallout,
  PickButton,
  SectionHeader,
  SendToThread,
  SPORT_CONFIG,
  type SportKey,
  toSportKey,
} from "@/components/ui";
import { psDefaultSheetCopy } from "@/lib/whatsapp";
import { ResultCard } from "./ResultCard";
import { parseWinnerOptions } from "@/lib/parse-options";

const MISSED_PICK_LINES = [
  "Gone. Didn\u2019t fancy it?",
  "Too slow.",
  "That ship has sailed.",
  "Deadline waits for nobody.",
  "Missed the boat on this one.",
  "No pick, no points.",
  "Clock ran out.",
  "Sat this one out, whether you meant to or not.",
];

function getMissedPickLine(eventId: string): string {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = (hash * 31 + eventId.charCodeAt(i)) | 0;
  }
  return MISSED_PICK_LINES[Math.abs(hash) % MISSED_PICK_LINES.length]!;
}

interface EventWithPredictions extends Event {
  predictions: Prediction[];
  event_prediction_types: EventPredictionType[];
}

interface RoundSummary {
  id: string;
  round_number: number;
  name: string | null;
  status: string;
}

interface EventListProps {
  events: EventWithPredictions[];
  competitionId: string;
  competitionName?: string;
  roundNumber?: number;
  roundName?: string;
  rounds?: RoundSummary[];
  selectedRoundId?: string;
  showResultHints?: boolean;
}

type FilterChip = "all" | "open" | "locked" | SportKey;


/** Convert EventPredictionType row to PredictionTypeConfig for the form. */
function eptToConfig(ept: EventPredictionType): {
  type: PredictionType;
  label?: string;
  options?: string[];
  line?: number;
  threshold?: number;
  n?: number;
  handicap?: number;
  team?: string;
  stages?: string[];
} {
  const cfg = ept.config ?? {};
  return {
    type: ept.prediction_type,
    label: cfg.display_label as string | undefined,
    options: cfg.options as string[] | undefined,
    line: cfg.line as number | undefined,
    threshold: cfg.line as number | undefined,
    n: cfg.n as number | undefined,
    handicap: cfg.line as number | undefined,
    team: cfg.team as string | undefined,
    stages: cfg.stages as string[] | undefined,
  };
}

function getPointsSummary(predictions: Prediction[]): string | null {
  if (predictions.length === 0) return null;
  const total = predictions.reduce((sum, p) => sum + p.points_awarded, 0);
  if (total === 0 && predictions.every((p) => p.is_correct === null)) return null;
  return `${total} pts`;
}

function formatCountdownText(lockTime: string): string {
  const diff = new Date(lockTime).getTime() - Date.now();
  if (diff <= 0) return "Locked";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return `Locks in ${parts.join(" ")}`;
}

function formatResult(resultData: Record<string, unknown>): string {
  if (resultData.winner) return String(resultData.winner);
  if (resultData.answer) return String(resultData.answer);
  if (resultData.score) return String(resultData.score);
  if (resultData.value !== undefined) return String(resultData.value);
  if (resultData.stage) return String(resultData.stage);
  const entries = Object.entries(resultData);
  if (entries.length === 0) return "Result recorded";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

function formatPickValue(data: Record<string, unknown>): string {
  if (data?.value !== undefined) return String(data.value);
  if (data?.selection !== undefined) return String(data.selection);
  if (data?.winner) return String(data.winner);
  if (data?.answer) return String(data.answer);
  return "—";
}

/** Format a lock time as "Sat 16:30" */
function formatLockShort(lockTime: string): string {
  return new Date(lockTime).toLocaleDateString("en-IE", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format event subtitle: "Premier League · Sat 16:30" */
function formatSubtitle(event: Event): string {
  const date = new Date(event.start_time).toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return date;
}

/**
 * Derive pick-button options from an EventPredictionType for winner / yes_no / over_under / head_to_head types.
 * Returns null for types that need a form (text input, rankings, etc.).
 */
function getPickOptions(
  ept: EventPredictionType,
  eventName?: string,
  sport?: string
): { id: string; label: string; sub?: string }[] | null {
  const cfg = ept.config ?? {};
  switch (ept.prediction_type) {
    case "winner": {
      const opts = cfg.options as string[] | undefined;
      if (opts && opts.length > 0) return opts.map((o) => ({ id: o, label: o }));
      // Fallback: derive from event name
      if (eventName) {
        const derived = parseWinnerOptions(eventName, sport);
        if (derived.length > 0) return derived.map((o) => ({ id: o, label: o }));
      }
      return null;
    }
    case "yes_no": {
      const opts = (cfg.options as string[] | undefined) ?? ["Yes", "No"];
      return opts.map((o) => ({ id: o, label: o }));
    }
    case "over_under": {
      const threshold = cfg.line ?? cfg.threshold ?? "";
      return [
        { id: "over", label: "Over", sub: String(threshold) },
        { id: "under", label: "Under", sub: String(threshold) },
      ];
    }
    case "top_n": {
      const opts = cfg.options as string[] | undefined;
      if (opts && opts.length > 0) return opts.map((o) => ({ id: o, label: o }));
      return null;
    }
    case "head_to_head": {
      const opts = cfg.options as string[] | undefined;
      if (!opts || opts.length === 0) return null;
      return opts.map((o) => ({ id: o, label: o }));
    }
    default:
      return null;
  }
}

/** Get current pick value from existing prediction for pick-button types. */
function getPickValue(prediction: Prediction | null): string | null {
  if (!prediction) return null;
  const data = prediction.prediction_data ?? {};
  if (data.value !== undefined) return String(data.value);
  if (data.selection !== undefined) return String(data.selection);
  return null;
}

export function EventList({
  events,
  competitionId,
  competitionName,
  roundNumber,
  roundName,
  rounds = [],
  selectedRoundId: initialRoundId,
  showResultHints = true,
}: EventListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterChip, setFilterChip] = useState<FilterChip>(
    (searchParams.get("chip") as FilterChip) ?? "all"
  );

  // Round switcher state — "all" means no round filter
  const [activeRoundId, setActiveRoundId] = useState<string | "all">(
    initialRoundId ?? "all"
  );

  const [viewMode, setViewMode] = useState<"sheet" | "damage">("sheet");

  // Filter events by active round (client-side)
  const roundFilteredEvents = useMemo(() => {
    if (activeRoundId === "all") return events;
    return events.filter((e) => e.round_id === activeRoundId);
  }, [events, activeRoundId]);

  // Derive the active round object
  const activeRound = useMemo(
    () => rounds.find((r) => r.id === activeRoundId) ?? null,
    [rounds, activeRoundId]
  );

  // Per-round pick progress for switcher pills
  const roundPickProgress = useMemo(() => {
    const map: Record<string, { picked: number; total: number }> = {};
    for (const r of rounds) {
      const roundEvents = events.filter(
        (e) => e.round_id === r.id && e.status === "upcoming"
      );
      map[r.id] = {
        total: roundEvents.length,
        picked: roundEvents.filter((e) => (e.predictions ?? []).length > 0).length,
      };
    }
    return map;
  }, [events, rounds]);

  // Derive sports present in the round-filtered events list
  const sportsInEvents = useMemo(() => {
    const set = new Set<SportKey>();
    for (const e of roundFilteredEvents) {
      const key = toSportKey(e.sport);
      set.add(key);
    }
    return Array.from(set);
  }, [roundFilteredEvents]);

  // Compute hero stats (scoped to active round filter)
  const upcomingEvents = useMemo(
    () => roundFilteredEvents.filter((e) => e.status === "upcoming"),
    [roundFilteredEvents]
  );

  const resultedEvents = useMemo(
    () => roundFilteredEvents.filter((e) => e.status === "resulted"),
    [roundFilteredEvents]
  );

  const pickedCount = useMemo(
    () =>
      upcomingEvents.filter((e) => (e.predictions ?? []).length > 0).length,
    [upcomingEvents]
  );

  // eslint-disable-next-line react-hooks/purity
  const renderNow = Date.now();

  const earliestLockTime = useMemo(() => {
    const times = upcomingEvents
      .map((e) => new Date(e.lock_time).getTime())
      .filter((t) => t > renderNow);
    if (times.length === 0) return null;
    return new Date(Math.min(...times)).toISOString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingEvents]);

  const pickProgress =
    upcomingEvents.length > 0
      ? Math.round((pickedCount / upcomingEvents.length) * 100)
      : 0;

  // Hero display text — derived from active round switcher selection
  const heroTitle = activeRound?.name ?? (activeRound ? `Round ${activeRound.round_number}` : roundName ?? "YOUR PICKS");
  const derivedRoundNumber = activeRound?.round_number ?? roundNumber;
  const roundLabel = derivedRoundNumber != null && !activeRound?.name ? `Round ${derivedRoundNumber}` : null;
  const sheetLabel = "THE ROUND";

  // Filter events (chip filter applied on top of round filter)
  const filteredEvents = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return roundFilteredEvents.filter((e) => {
      if (filterChip === "all") return true;
      if (filterChip === "open") return e.status === "upcoming";
      if (filterChip === "locked")
        return (
          e.status === "locked" ||
          (e.status === "upcoming" &&
            new Date(e.lock_time).getTime() <= now)
        );
      // sport key filter
      return toSportKey(e.sport) === filterChip;
    });
  }, [roundFilteredEvents, filterChip]);

  // Sort: upcoming → locked → resulted → postponed → cancelled, then by time
  const sortedEvents = useMemo(() => {
    const statusOrder: Record<EventStatus, number> = {
      upcoming: 0,
      locked: 1,
      resulted: 2,
      postponed: 3,
      cancelled: 4,
    };
    return [...filteredEvents].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  }, [filteredEvents]);

  // Group for section headers
  const groupedEvents = useMemo(() => {
    const groups: Record<string, EventWithPredictions[]> = {};
    for (const event of sortedEvents) {
      const label =
        event.status === "upcoming"
          ? "Open"
          : event.status === "locked"
          ? "Locked"
          : event.status === "resulted"
          ? "Resulted"
          : event.status === "postponed"
          ? "Postponed"
          : "Cancelled";
      if (!groups[label]) groups[label] = [];
      groups[label].push(event);
    }
    return groups;
  }, [sortedEvents]);

  const handleSubmitPrediction = useCallback(
    async (data: {
      eventId: string;
      predictionType: PredictionType;
      predictionData: Record<string, unknown>;
    }) => {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: data.eventId,
          competition_id: competitionId,
          prediction_type: data.predictionType,
          prediction_data: data.predictionData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as Record<string, unknown>)?.error as string ??
            "Failed to submit prediction"
        );
      }

      router.refresh();
    },
    [competitionId, router]
  );

  if (events.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
        No events in this competition yet. Check back later.
      </div>
    );
  }

  const hasRounds = rounds.length > 0;

  // Build filter chip definitions
  type ChipDef = { id: FilterChip; label: string };
  const chipDefs: ChipDef[] = [{ id: "all", label: "All" }];
  for (const sk of sportsInEvents) {
    const cfg = SPORT_CONFIG[sk];
    chipDefs.push({ id: sk, label: `${cfg.emoji} ${cfg.name}` });
  }
  chipDefs.push({ id: "open", label: "Open" });
  chipDefs.push({ id: "locked", label: "Locked" });

  return (
    <div className="mt-0 space-y-0">
      {/* ── Round Switcher ─────────────────────────────────────────────── */}
      {hasRounds && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-0 pt-3 scrollbar-none">
          <button
            onClick={() => setActiveRoundId("all")}
            className={[
              "shrink-0 rounded-full px-3 py-1.5 font-semibold transition-colors",
              activeRoundId === "all"
                ? "bg-ps-text text-ps-bg"
                : "border border-ps-border bg-ps-surface text-ps-text-sec",
            ].join(" ")}
            style={{ fontSize: 11.5, whiteSpace: "nowrap" }}
          >
            All
          </button>
          {[...rounds].reverse().map((round) => {
            const isActive = activeRoundId === round.id;
            const isLocked = round.status === "locked" || round.status === "scored" || round.status === "closed";
            const label = round.name ?? `Round ${round.round_number}`;
            const progress = roundPickProgress[round.id];
            const showProgress = progress && progress.total > 0;

            return (
              <button
                key={round.id}
                onClick={() => setActiveRoundId(round.id)}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 font-semibold transition-colors",
                  isActive
                    ? "bg-ps-text text-ps-bg"
                    : "border border-ps-border bg-ps-surface",
                  !isActive && isLocked ? "text-ps-text-ter" : !isActive ? "text-ps-text-sec" : "",
                ].join(" ")}
                style={{ fontSize: 11.5, whiteSpace: "nowrap" }}
              >
                <span className="inline-flex items-center gap-1">
                  {isLocked && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <rect x="2" y="4.5" width="6" height="5" rx="1" fill="currentColor" />
                      <path
                        d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5"
                        stroke="currentColor"
                        strokeWidth="1.1"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  )}
                  {label}
                  {showProgress && !isActive && (
                    <span
                      className="ml-0.5 opacity-60"
                      style={{ fontSize: 10 }}
                    >
                      {progress.picked}/{progress.total}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Hero Header ───────────────────────────────────────────────── */}
      <div
        className="px-4 pb-4 pt-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 100%)",
        }}
      >
        {/* Brand mark row */}
        <div className="mb-4 flex items-center gap-2.5">
          <BrandMark className="h-8 w-auto shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span
              className="font-bold uppercase tracking-[0.06em] text-ps-text-sec"
              style={{ fontSize: 10, lineHeight: 1 }}
            >
              {sheetLabel}
            </span>
            {roundLabel && (
              <span
                className="font-semibold text-ps-text"
                style={{ fontSize: 13, lineHeight: 1 }}
              >
                {roundLabel}
              </span>
            )}
          </div>
        </div>

        {/* Giant round name */}
        <h1
          className="font-display text-ps-text"
          style={{
            fontSize: 44,
            lineHeight: 0.92,
            letterSpacing: "1.5px",
            fontWeight: 400,
            margin: 0,
          }}
        >
          {heroTitle.toUpperCase().split(" ").map((word, i, arr) => (
            <span key={i}>
              {word}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </h1>

        {/* Progress row */}
        <div
          className="mt-3 flex items-center gap-3 font-medium text-ps-text-sec"
          style={{ fontSize: 12 }}
        >
          <span>
            <strong className="font-bold text-ps-text">
              {pickedCount} of {upcomingEvents.length}
            </strong>{" "}
            picked
          </span>
          <span
            className="inline-block rounded-full bg-ps-text-ter"
            style={{ width: 3, height: 3 }}
          />
          {earliestLockTime ? (
            <span>Locks {formatLockShort(earliestLockTime)}</span>
          ) : (
            <span>All locked</span>
          )}
        </div>

        {/* Progress bar */}
        <div
          className="mt-2.5 overflow-hidden rounded-full"
          style={{
            height: 5,
            background: "var(--ps-border)",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pickProgress}%`,
              background: "linear-gradient(90deg, var(--ps-amber), var(--ps-amber-deep))",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* ── View Toggle: The Round / Results ──────────────────────── */}
      <div className="px-4 pt-2">
        <div
          className="grid grid-cols-2 gap-0.5 rounded-[10px] p-[3px]"
          style={{ background: "var(--ps-chip)" }}
        >
          {(["sheet", "damage"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-[7px] py-[7px] text-center text-[11px] font-bold transition-colors ${
                viewMode === mode
                  ? "bg-ps-surface text-ps-text shadow-[0_1px_3px_rgba(40,30,20,0.08)]"
                  : "text-ps-text-sec"
              }`}
            >
              {mode === "sheet" ? "The Round" : "Results"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "sheet" ? (
        <>
          {/* ── Filter Chips ───────────────────────────────────────────────── */}
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-0 pt-2 scrollbar-none">
            {chipDefs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterChip(id)}
                className={[
                  "shrink-0 rounded-full px-3 py-1.5 font-semibold transition-colors",
                  filterChip === id
                    ? "bg-ps-text text-ps-bg"
                    : "border border-ps-border bg-ps-surface text-ps-text-sec",
                ].join(" ")}
                style={{ fontSize: 11.5, whiteSpace: "nowrap" }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Event Cards ────────────────────────────────────────────────── */}
          <div className="space-y-3 px-4 pb-4 pt-3">
            {filteredEvents.length === 0 && (
              <div className="rounded-xl border border-ps-border bg-ps-surface p-8 text-center text-ps-text-sec">
                No events match the selected filter.
              </div>
            )}

            {Object.entries(groupedEvents).map(([groupLabel, groupEvents]) => (
              <div key={groupLabel} className="space-y-3">
                {Object.keys(groupedEvents).length > 1 && (
                  <SectionHeader label={`${groupLabel} (${groupEvents.length})`} />
                )}

                {groupEvents.map((event) => {
                  const sportKey = toSportKey(event.sport);
                  const isLocked =
                    new Date(event.lock_time).getTime() <= Date.now() ||
                    event.status !== "upcoming";
                  const lockDiff =
                    new Date(event.lock_time).getTime() - Date.now();
                  const isUrgent = lockDiff > 0 && lockDiff < 60 * 60 * 1000;
                  const predictionTypeConfigs = (
                    event.event_prediction_types ?? []
                  ).map(eptToConfig);
                  const pointsSummary = getPointsSummary(event.predictions);

                  const communityData: Record<string, number> = {};
                  for (const ept of event.event_prediction_types ?? []) {
                    const opts = getPickOptions(ept, event.event_name, event.sport);
                    if (opts) {
                      for (const o of opts) {
                        if (!(o.id in communityData)) communityData[o.id] = 0;
                      }
                    }
                  }

                  return (
                    <EventCard
                      key={event.id}
                      event={event}
                      sportKey={sportKey}
                      isLocked={isLocked}
                      lockDiff={lockDiff}
                      isUrgent={isUrgent}
                      predictionTypeConfigs={predictionTypeConfigs}
                      pointsSummary={pointsSummary}
                      communityData={communityData}
                      onSubmit={handleSubmitPrediction}
                      showResultHints={showResultHints}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── Tiebreaker placeholder ─────────────────────────────────────── */}
          {/* Tiebreaker section would be rendered here if round data includes one */}
        </>
      ) : (
        /* ── Results: Result Cards ────────────────────────────────────── */
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p
                className="font-bold uppercase text-ps-text-sec"
                style={{ fontSize: 11, letterSpacing: 0.8 }}
              >
                Last Round
              </p>
              <h2
                className="font-display text-ps-text"
                style={{ fontSize: 32, lineHeight: 1, letterSpacing: 1 }}
              >
                RESULTS
              </h2>
            </div>
            <div className="text-right">
              <p
                className="uppercase text-ps-text-ter"
                style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2 }}
              >
                You
              </p>
              <p
                className="mt-1 font-display text-ps-green"
                style={{ fontSize: 28, lineHeight: 1 }}
              >
                +{resultedEvents.reduce((sum, e) => sum + (e.predictions?.[0]?.points_awarded ?? 0), 0)}
                <span
                  className="text-ps-text-sec"
                  style={{ fontSize: 14, letterSpacing: 0.4 }}
                >
                  {" "}/ {resultedEvents.length * 10}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {resultedEvents.length === 0 ? (
              <div className="rounded-[14px] border border-ps-border bg-ps-surface p-8 text-center text-ps-text-sec">
                No results yet — check back once events start resolving.
              </div>
            ) : (
              resultedEvents.map((event) => {
                const prediction = (event.predictions ?? [])[0];
                if (!prediction) return null;
                return (
                  <ResultCard
                    key={event.id}
                    event={event}
                    prediction={prediction}
                    showResultHints={showResultHints}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

interface EventCardProps {
  event: EventWithPredictions;
  sportKey: SportKey;
  isLocked: boolean;
  lockDiff: number;
  isUrgent: boolean;
  predictionTypeConfigs: ReturnType<typeof eptToConfig>[];
  pointsSummary: string | null;
  communityData: Record<string, number>;
  onSubmit: (data: {
    eventId: string;
    predictionType: PredictionType;
    predictionData: Record<string, unknown>;
  }) => Promise<void>;
  showResultHints?: boolean;
}

function EventCard({
  event,
  sportKey,
  isLocked,
  lockDiff,
  isUrgent,
  predictionTypeConfigs,
  pointsSummary,
  communityData,
  onSubmit,
  showResultHints = true,
}: EventCardProps) {
  const [showPickDetail, setShowPickDetail] = useState(false);

  const predictions = event.predictions ?? [];
  const hasPredictions = predictions.length > 0;
  const isResulted = event.status === "resulted";
  const isCramped = predictionTypeConfigs.length > 1;
  const allScored = hasPredictions && predictions.every((p) => p.is_correct !== null);
  const hasAnyCorrectOrPartial = predictions.some((p) => p.is_correct === true || p.is_partial);

  const resultAccentColor =
    showResultHints && isResulted && hasPredictions && allScored
      ? hasAnyCorrectOrPartial
        ? "var(--ps-green)"
        : "var(--ps-red)"
      : null;

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-ps-border bg-ps-surface"
      style={resultAccentColor ? { borderColor: resultAccentColor, borderWidth: '2px' } : undefined}
    >
      {/* Sport colour bar */}
      <SportBar sport={sportKey} height={3} />
      {resultAccentColor && (
        <div
          aria-hidden="true"
          style={{ height: 3, background: resultAccentColor }}
        />
      )}

      <div className="p-3.5">
        {/* Row 1: SportPill + CountdownChip + WA share */}
        <div className="flex items-center justify-between gap-2">
          <SportPill sport={sportKey} size="sm" />
          <div className="flex items-center gap-1.5">
            {event.status === "upcoming" && lockDiff > 0 ? (
              <CountdownChip
                text={formatCountdownText(event.lock_time)}
                urgent={isUrgent}
              />
            ) : event.status !== "upcoming" ? (
              <StatusBadge status={event.status} />
            ) : null}
            <SendToThread
              variant="icon"
              defaultText={psDefaultSheetCopy(event.event_name)}
            />
          </div>
        </div>

        {/* Row 2: Title + CommunityDonut */}
        <div className="mt-2 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h4
              className="font-extrabold leading-snug text-ps-text"
              style={{ fontSize: 17 }}
            >
              <Link href={`/predictions/${event.id}`} className="hover:underline">
                {event.event_name}
              </Link>
            </h4>
            <p
              className="mt-0.5 text-ps-text-sec"
              style={{ fontSize: 12.5, letterSpacing: "0.01em" }}
            >
              {formatSubtitle(event)}
            </p>
          </div>
          {Object.keys(communityData).length > 0 && (
            <CommunityDonut community={communityData} size={48} />
          )}
          {pointsSummary && Object.keys(communityData).length === 0 && (
            <span className="text-sm font-semibold text-ps-amber-deep">
              {pointsSummary}
            </span>
          )}
        </div>

        {/* Points stamp for resulted events */}
        {pointsSummary && event.status === "resulted" && (
          <div className="mt-1.5">
            <span className="text-sm font-bold text-ps-amber-deep">
              {pointsSummary}
            </span>
          </div>
        )}

        {/* Live countdown for upcoming events */}
        {event.status === "upcoming" && (
          <div className="mt-2">
            <Countdown lockTime={event.lock_time} />
          </div>
        )}

        {/* Result display + pick comparison */}
        {isResulted && event.result_data && (
          <div className="mt-2 space-y-1.5">
            <div className="rounded-lg bg-ps-chip px-3 py-2 text-sm">
              <span className="text-xs font-medium uppercase text-ps-text-ter">
                Result:{" "}
              </span>
              <span className="font-medium text-ps-text">
                {formatResult(event.result_data)}
              </span>
            </div>

            {hasPredictions && !isCramped && predictions[0] && (
              <div className="flex items-center gap-1.5 rounded-lg bg-ps-chip px-3 py-1.5 text-xs">
                <span className="text-ps-text-sec">You:</span>
                <span className="font-semibold text-ps-text">
                  {formatPickValue(predictions[0].prediction_data)}
                </span>
                {showResultHints && predictions[0].is_correct !== null && (
                  <span
                    className="font-bold"
                    style={{
                      color:
                        predictions[0].is_correct || predictions[0].is_partial
                          ? "var(--ps-green)"
                          : "var(--ps-red)",
                    }}
                  >
                    {predictions[0].is_correct || predictions[0].is_partial ? "✓" : "✗"}
                  </span>
                )}
              </div>
            )}

            {hasPredictions && isCramped && (
              <div>
                <button
                  onClick={() => setShowPickDetail((d) => !d)}
                  className="flex items-center gap-1 py-0.5 text-xs font-semibold text-ps-text-sec transition-colors hover:text-ps-text"
                >
                  <span>{showPickDetail ? "Hide picks" : "Your picks"}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                    className={`transition-transform ${showPickDetail ? "rotate-180" : ""}`}
                  >
                    <path
                      d="M2 3.5L5 6.5L8 3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                {showPickDetail && (
                  <div className="mt-1 space-y-1 rounded-lg bg-ps-chip px-3 py-2">
                    {predictions.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="capitalize text-ps-text-ter">
                          {p.prediction_type.replace(/_/g, " ")}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-ps-text">
                          {formatPickValue(p.prediction_data)}
                          {showResultHints && p.is_correct !== null && (
                            <span
                              className="font-bold"
                              style={{
                                color:
                                  p.is_correct || p.is_partial
                                    ? "var(--ps-green)"
                                    : "var(--ps-red)",
                              }}
                            >
                              {p.is_correct || p.is_partial ? "✓" : "✗"}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Prediction inputs — inline PickButtons or form */}
        {predictionTypeConfigs.length > 0 && (
          <div className="mt-3 space-y-3 border-t border-ps-border pt-3">
            {(event.event_prediction_types ?? []).map((ept) => {
              // Skip exact_score — rendered as sub-section of winner
              if (ept.prediction_type === "exact_score") return null;

              const cfg = predictionTypeConfigs.find(
                (c) => c.type === ept.prediction_type
              );
              if (!cfg) return null;

              const existingPrediction =
                (event.predictions ?? []).find(
                  (p) => p.prediction_type === ept.prediction_type
                ) ?? null;

              const pickOptions = getPickOptions(ept, event.event_name, event.sport);

              // Check if this winner type has an exact_score companion
              const exactScoreEpt =
                ept.prediction_type === "winner"
                  ? (event.event_prediction_types ?? []).find(
                      (e) => e.prediction_type === "exact_score"
                    )
                  : null;

              const exactScorePrediction = exactScoreEpt
                ? ((event.predictions ?? []).find(
                    (p) => p.prediction_type === "exact_score"
                  ) ?? null)
                : null;

              if (pickOptions) {
                return (
                  <div key={`${event.id}-${ept.prediction_type}`}>
                    <InlinePickSection
                      eventId={event.id}
                      ept={ept}
                      options={pickOptions}
                      existingPrediction={existingPrediction}
                      isLocked={isLocked}
                      onSubmit={onSubmit}
                    />
                    {exactScoreEpt && (
                      <ExactScoreSection
                        eventId={event.id}
                        sport={event.sport}
                        homeTeam={pickOptions[0]?.label ?? "Home"}
                        awayTeam={pickOptions[1]?.label ?? "Away"}
                        ept={exactScoreEpt}
                        winnerOptions={pickOptions.map((o) => o.label)}
                        currentWinnerPick={getPickValue(existingPrediction)}
                        existingScorePrediction={exactScorePrediction}
                        isLocked={isLocked}
                        onSubmitScore={onSubmit}
                        onUpdateWinner={onSubmit}
                      />
                    )}
                  </div>
                );
              }

              // Fall back to the text/complex PredictionForm
              return (
                <PredictionForm
                  key={`${event.id}-${cfg.type}`}
                  eventId={event.id}
                  predictionTypeConfig={cfg}
                  existingPrediction={existingPrediction}
                  isLocked={isLocked}
                  onSubmit={onSubmit}
                />
              );
            })}
          </div>
        )}

        {predictionTypeConfigs.length === 0 && (
          <p className="mt-2 text-xs italic text-ps-text-ter">
            No prediction types configured for this event.
          </p>
        )}

        {/* PersonaCallout — shown when event has a pick already */}
        {!isLocked && event.predictions.length > 0 && (
          <div className="mt-3">
            <PersonaCallout
              calloutLabel="Your pick"
              fact={formatPickSummary(event.predictions)}
              variant="border"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── InlinePickSection ─────────────────────────────────────────────────────────

interface InlinePickSectionProps {
  eventId: string;
  ept: EventPredictionType;
  options: { id: string; label: string; sub?: string }[];
  existingPrediction: Prediction | null;
  isLocked: boolean;
  onSubmit: (data: {
    eventId: string;
    predictionType: PredictionType;
    predictionData: Record<string, unknown>;
  }) => Promise<void>;
}

function InlinePickSection({
  eventId,
  ept,
  options,
  existingPrediction,
  isLocked,
  onSubmit,
}: InlinePickSectionProps) {
  const currentPick = getPickValue(existingPrediction);
  const [optimisticPick, setOptimisticPick] = useState<string | null>(
    currentPick
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePick = optimisticPick ?? currentPick;

  async function handlePick(optionId: string) {
    if (isLocked || isSubmitting) return;

    // If clicking the already-selected pick, deselect (no-op for now — UX choice)
    setOptimisticPick(optionId);
    setError(null);
    setIsSubmitting(true);

    let predictionData: Record<string, unknown>;
    switch (ept.prediction_type) {
      case "winner":
      case "top_n":
        predictionData = { value: optionId };
        break;
      case "yes_no":
      case "head_to_head":
        predictionData = { selection: optionId };
        break;
      case "over_under": {
        const cfg = ept.config ?? {};
        predictionData = {
          selection: optionId,
          threshold: cfg.line ?? cfg.threshold,
        };
        break;
      }
      default:
        predictionData = { selection: optionId };
    }

    try {
      await onSubmit({
        eventId,
        predictionType: ept.prediction_type,
        predictionData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setOptimisticPick(currentPick); // revert
    } finally {
      setIsSubmitting(false);
    }
  }

  const gridCols =
    options.length <= 3
      ? `repeat(${options.length}, minmax(0, 1fr))`
      : "repeat(2, minmax(0, 1fr))";

  return (
    <div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: gridCols }}
      >
        {options.map((opt) => (
          <PickButton
            key={opt.id}
            label={opt.label}
            sub={opt.sub}
            selected={activePick === opt.id}
            disabled={isLocked || isSubmitting}
            onClick={() => handlePick(opt.id)}
          />
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-ps-red">{error}</p>
      )}
      {isLocked && !existingPrediction && (
        <p className="mt-1.5 text-xs italic text-ps-text-ter">
          {getMissedPickLine(eventId)}
        </p>
      )}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EventStatus }) {
  const styles: Record<EventStatus, string> = {
    upcoming: "bg-ps-amber-soft text-ps-amber-deep",
    locked: "bg-ps-chip text-ps-text-sec",
    resulted: "bg-ps-green-soft text-ps-green",
    postponed: "bg-ps-amber-soft text-ps-amber-deep",
    cancelled: "bg-ps-red-soft text-ps-red",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPickSummary(predictions: Prediction[]): string {
  const parts = predictions.map((p) => {
    const d = p.prediction_data ?? {};
    if (d.value !== undefined) return String(d.value);
    if (d.selection !== undefined) return String(d.selection);
    if (d.stage !== undefined) return String(d.stage);
    return "picked";
  });
  return parts.join(" · ");
}
