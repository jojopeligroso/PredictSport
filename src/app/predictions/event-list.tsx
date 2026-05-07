"use client";

import { useState, useMemo, useCallback } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  Event,
  Prediction,
  PredictionType,
  EventStatus,
  EventPredictionType,
} from "@/types/database";
import { Countdown } from "./countdown";
import { PredictionForm } from "./prediction-form";
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
} from "@/components/ui";
import { psDefaultSheetCopy } from "@/lib/whatsapp";
import { ResultCard } from "./ResultCard";

interface EventWithPredictions extends Event {
  predictions: Prediction[];
  event_prediction_types: EventPredictionType[];
}

interface EventListProps {
  events: EventWithPredictions[];
  competitionId: string;
  competitionName?: string;
  roundNumber?: number;
  roundName?: string;
}

type FilterChip = "all" | "open" | "locked" | SportKey;

const VALID_SPORT_KEYS: SportKey[] = ["soccer", "f1", "gaa", "nba", "golf"];

function toSportKey(sport: string): SportKey {
  const lower = sport.toLowerCase() as SportKey;
  return VALID_SPORT_KEYS.includes(lower) ? lower : VALID_SPORT_KEYS[0];
}

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
  ept: EventPredictionType
): { id: string; label: string; sub?: string }[] | null {
  const cfg = ept.config ?? {};
  switch (ept.prediction_type) {
    case "winner": {
      const opts = cfg.options as string[] | undefined;
      if (!opts || opts.length === 0) return null;
      return opts.map((o) => ({ id: o, label: o }));
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
}: EventListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterChip, setFilterChip] = useState<FilterChip>(
    (searchParams.get("chip") as FilterChip) ?? "all"
  );

  const [viewMode, setViewMode] = useState<"sheet" | "damage">("sheet");

  // Derive sports present in the events list
  const sportsInEvents = useMemo(() => {
    const set = new Set<SportKey>();
    for (const e of events) {
      const key = toSportKey(e.sport);
      set.add(key);
    }
    return Array.from(set);
  }, [events]);

  // Compute hero stats
  const upcomingEvents = useMemo(
    () => events.filter((e) => e.status === "upcoming"),
    [events]
  );

  const resultedEvents = useMemo(
    () => events.filter((e) => e.status === "resulted"),
    [events]
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

  // Hero display text
  const heroTitle = roundName ?? competitionName ?? "YOUR PICKS";
  const roundLabel = roundNumber != null ? `Round ${roundNumber}` : null;
  const sheetLabel = competitionName ?? "THE SHEET";

  // Filter events
  const filteredEvents = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return events.filter((e) => {
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
  }, [events, filterChip]);

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
      <div className="mt-8 rounded-lg border border-ps-border bg-ps-surface p-12 text-center text-ps-text-sec">
        No events in this competition yet. Check back later.
      </div>
    );
  }

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
      {/* ── Hero Header ───────────────────────────────────────────────── */}
      <div
        className="px-4 pb-4 pt-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 100%)",
        }}
      >
        {/* PS logo row */}
        <div className="mb-4 flex items-center gap-2.5">
          <div
            className="flex shrink-0 items-center justify-center rounded-[9px] font-display text-[17px] leading-none tracking-wide"
            style={{
              width: 32,
              height: 32,
              background:
                "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#1a1208",
              letterSpacing: "0.5px",
            }}
          >
            PS
          </div>
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
          style={{ fontSize: 11.5 }}
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
            background: "rgba(40,30,20,0.10)",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pickProgress}%`,
              background: "linear-gradient(90deg, #f59e0b, #d97706)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* ── View Toggle: The Sheet / The Damage ──────────────────────── */}
      <div className="px-4 pt-2">
        <div
          className="grid grid-cols-2 gap-0.5 rounded-[10px] p-[3px]"
          style={{ background: "rgba(40,30,20,0.06)" }}
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
              {mode === "sheet" ? "The Sheet" : "The Damage"}
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
          <div className="space-y-2.5 px-4 pb-4 pt-3">
            {filteredEvents.length === 0 && (
              <div className="rounded-lg border border-ps-border bg-ps-surface p-8 text-center text-ps-text-sec">
                No events match the selected filter.
              </div>
            )}

            {Object.entries(groupedEvents).map(([groupLabel, groupEvents]) => (
              <div key={groupLabel} className="space-y-2.5">
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
                    const opts = getPickOptions(ept);
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
        /* ── The Damage: Result Cards ─────────────────────────────────── */
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
                THE DAMAGE
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
}: EventCardProps) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-ps-border bg-ps-surface">
      {/* Sport colour bar */}
      <SportBar sport={sportKey} height={3} />

      <div className="p-3">
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
              style={{ fontSize: 16 }}
            >
              <Link href={`/predictions/${event.id}`} className="hover:underline">
                {event.event_name}
              </Link>
            </h4>
            <p
              className="mt-0.5 text-ps-text-sec"
              style={{ fontSize: 12 }}
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

        {/* Result display */}
        {event.status === "resulted" && event.result_data && (
          <div className="mt-2 rounded-lg bg-ps-chip px-3 py-2 text-sm">
            <span className="text-xs font-medium uppercase text-ps-text-ter">
              Result:{" "}
            </span>
            <span className="font-medium text-ps-text">
              {formatResult(event.result_data)}
            </span>
          </div>
        )}

        {/* Prediction inputs — inline PickButtons or form */}
        {predictionTypeConfigs.length > 0 && (
          <div className="mt-3 space-y-3 border-t border-ps-border pt-3">
            {(event.event_prediction_types ?? []).map((ept) => {
              const cfg = predictionTypeConfigs.find(
                (c) => c.type === ept.prediction_type
              );
              if (!cfg) return null;

              const existingPrediction =
                (event.predictions ?? []).find(
                  (p) => p.prediction_type === ept.prediction_type
                ) ?? null;

              const pickOptions = getPickOptions(ept);

              if (pickOptions) {
                return (
                  <InlinePickSection
                    key={`${event.id}-${ept.prediction_type}`}
                    eventId={event.id}
                    ept={ept}
                    options={pickOptions}
                    existingPrediction={existingPrediction}
                    isLocked={isLocked}
                    onSubmit={onSubmit}
                  />
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
          No prediction submitted
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
