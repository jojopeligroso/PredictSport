"use client";

import { useState, useMemo, useCallback } from "react";
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
  SectionHeader,
  type SportKey,
} from "@/components/ui";

interface EventWithPredictions extends Event {
  predictions: Prediction[];
  event_prediction_types: EventPredictionType[];
}

interface EventListProps {
  events: EventWithPredictions[];
  competitionId: string;
}

type FilterSport = string;
type FilterStatus = EventStatus | "all";

const VALID_SPORT_KEYS: SportKey[] = ["soccer", "f1", "gaa", "nba", "golf"];

function toSportKey(sport: string): SportKey {
  const lower = sport.toLowerCase() as SportKey;
  return VALID_SPORT_KEYS.includes(lower) ? lower : VALID_SPORT_KEYS[0];
}

function getStatusBadge(status: EventStatus) {
  const styles: Record<EventStatus, string> = {
    upcoming: "bg-ps-amber-soft text-ps-amber-deep",
    locked: "bg-ps-chip text-ps-text-sec",
    resulted: "bg-ps-green-soft text-ps-green",
    postponed: "bg-ps-amber-soft text-ps-amber-deep",
    cancelled: "bg-ps-red-soft text-ps-red",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function getPointsSummary(predictions: Prediction[]): string | null {
  if (predictions.length === 0) return null;
  const total = predictions.reduce((sum, p) => sum + p.points_awarded, 0);
  if (total === 0 && predictions.every((p) => p.is_correct === null))
    return null;
  return `${total} pts`;
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

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "locked", label: "Locked" },
  { value: "resulted", label: "Resulted" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
];

export function EventList({ events, competitionId }: EventListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterSport, setFilterSport] = useState<FilterSport>(
    searchParams.get("sport") ?? "all"
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    (searchParams.get("status") as FilterStatus) ?? "all"
  );

  const sports = useMemo(() => {
    const set = new Set(events.map((e) => e.sport));
    return Array.from(set).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterSport !== "all" && e.sport !== filterSport) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      return true;
    });
  }, [events, filterSport, filterStatus]);

  const groupedEvents = useMemo(() => {
    const statusOrder: Record<EventStatus, number> = {
      upcoming: 0,
      locked: 1,
      resulted: 2,
      postponed: 3,
      cancelled: 4,
    };

    const sorted = [...filteredEvents].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return (
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    });

    const groups: Record<string, EventWithPredictions[]> = {};
    for (const event of sorted) {
      const label =
        event.status === "upcoming"
          ? "Upcoming"
          : event.status === "locked"
            ? "Locked - Awaiting Results"
            : event.status === "resulted"
              ? "Resulted"
              : event.status === "postponed"
                ? "Postponed"
                : "Cancelled";
      if (!groups[label]) groups[label] = [];
      groups[label].push(event);
    }

    return groups;
  }, [filteredEvents]);

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

  return (
    <div className="mt-6 space-y-6">
      {/* Sport filter chips */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterSport("all")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filterSport === "all"
                ? "bg-ps-text text-ps-bg"
                : "border border-ps-border bg-ps-surface text-ps-text-sec hover:border-ps-border-strong"
            }`}
          >
            All Sports
          </button>
          {sports.map((sport) => (
            <button
              key={sport}
              onClick={() => setFilterSport(sport)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                filterSport === sport
                  ? "bg-ps-text text-ps-bg"
                  : "border border-ps-border bg-ps-surface text-ps-text-sec hover:border-ps-border-strong"
              }`}
            >
              {sport}
            </button>
          ))}
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filterStatus === value
                  ? "bg-ps-text text-ps-bg"
                  : "border border-ps-border bg-ps-surface text-ps-text-sec hover:border-ps-border-strong"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(filterSport !== "all" || filterStatus !== "all") && (
          <button
            onClick={() => {
              setFilterSport("all");
              setFilterStatus("all");
            }}
            className="self-start text-sm text-ps-text-ter underline hover:text-ps-text-sec"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredEvents.length === 0 && (
        <div className="rounded-lg border border-ps-border bg-ps-surface p-8 text-center text-ps-text-sec">
          No events match the selected filters.
        </div>
      )}

      {/* Grouped event cards */}
      {Object.entries(groupedEvents).map(([groupLabel, groupEvents]) => (
        <div key={groupLabel}>
          <SectionHeader
            label={`${groupLabel} (${groupEvents.length})`}
          />
          <div className="mt-3 space-y-3">
            {groupEvents.map((event) => {
              const isLocked =
                new Date(event.lock_time).getTime() <= Date.now() ||
                event.status !== "upcoming";
              const predictionTypeConfigs = (event.event_prediction_types ?? []).map(eptToConfig);
              const pointsSummary = getPointsSummary(event.predictions);
              const sportKey = toSportKey(event.sport);

              const lockDiff = new Date(event.lock_time).getTime() - Date.now();
              const isUrgent = lockDiff > 0 && lockDiff < 60 * 60 * 1000;

              return (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-2xl border border-ps-border bg-ps-surface"
                >
                  {/* Sport colour bar across the top */}
                  <SportBar sport={sportKey} height={4} />

                  <div className="p-4">
                    {/* Top row: SportPill + countdown chip */}
                    <div className="flex items-center justify-between gap-2">
                      <SportPill sport={sportKey} size="sm" />
                      {event.status === "upcoming" && lockDiff > 0 && (
                        <CountdownChip
                          text={formatCountdownText(event.lock_time)}
                          urgent={isUrgent}
                        />
                      )}
                      {event.status !== "upcoming" && getStatusBadge(event.status)}
                    </div>

                    {/* Event title + subtitle */}
                    <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[17px] font-extrabold text-ps-text leading-snug">
                          {event.event_name}
                        </h4>
                        <p className="mt-0.5 text-[11.5px] text-ps-text-sec">
                          {new Date(event.start_time).toLocaleDateString(
                            "en-IE",
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                      {pointsSummary && (
                        <span className="text-sm font-semibold text-ps-amber-deep">
                          {pointsSummary}
                        </span>
                      )}
                    </div>

                    {/* Live countdown text for upcoming events */}
                    {event.status === "upcoming" && (
                      <div className="mt-2">
                        <Countdown lockTime={event.lock_time} />
                      </div>
                    )}

                    {/* Result display for resulted events */}
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

                    {/* Prediction forms */}
                    {predictionTypeConfigs.length > 0 && (
                      <div className="mt-3 space-y-3 border-t border-ps-border pt-3">
                        {predictionTypeConfigs.map((ptConfig) => {
                          const existingPrediction =
                            (event.predictions ?? []).find(
                              (p) => p.prediction_type === ptConfig.type
                            ) ?? null;

                          return (
                            <PredictionForm
                              key={`${event.id}-${ptConfig.type}`}
                              eventId={event.id}
                              predictionTypeConfig={ptConfig}
                              existingPrediction={existingPrediction}
                              isLocked={isLocked}
                              onSubmit={handleSubmitPrediction}
                            />
                          );
                        })}
                      </div>
                    )}

                    {predictionTypeConfigs.length === 0 && (
                      <p className="mt-2 text-xs text-ps-text-ter italic">
                        No prediction types configured for this event.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
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
  return entries
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}
