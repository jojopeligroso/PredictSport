"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  Event,
  Prediction,
  PredictionType,
  EventStatus,
} from "@/types/database";
import { Countdown } from "./countdown";
import { PredictionForm } from "./prediction-form";

interface EventWithPredictions extends Event {
  predictions: Prediction[];
}

interface EventListProps {
  events: EventWithPredictions[];
  competitionId: string;
}

type FilterSport = string;
type FilterStatus = EventStatus | "all";

function getEventOutcomeClass(
  event: Event,
  predictions: Prediction[]
): string {
  if (event.status === "upcoming") {
    return "border-l-zinc-300 dark:border-l-zinc-600";
  }
  if (
    event.status === "locked" ||
    event.status === "postponed" ||
    event.status === "cancelled"
  ) {
    return "border-l-zinc-400 dark:border-l-zinc-500";
  }
  // resulted
  if (predictions.length === 0) {
    return "border-l-zinc-400 dark:border-l-zinc-500";
  }
  const hasCorrect = predictions.some((p) => p.is_correct === true);
  const hasPartial = predictions.some((p) => p.is_partial);
  const allWrong = predictions.every((p) => p.is_correct === false);

  if (hasCorrect) return "border-l-emerald-500 dark:border-l-emerald-400";
  if (hasPartial) return "border-l-amber-500 dark:border-l-amber-400";
  if (allWrong) return "border-l-red-500 dark:border-l-red-400";
  // pending result evaluation
  return "border-l-zinc-400 dark:border-l-zinc-500";
}

function getStatusBadge(status: EventStatus) {
  const styles: Record<EventStatus, string> = {
    upcoming:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    locked:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    resulted:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    postponed:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    cancelled:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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

function parsePredictionTypes(
  predictionTypes: Record<string, unknown>
): Array<{
  type: PredictionType;
  label?: string;
  options?: string[];
  line?: number;
  threshold?: number;
  n?: number;
  handicap?: number;
  team?: string;
}> {
  // prediction_types is stored as jsonb - could be an array of configs
  if (Array.isArray(predictionTypes)) {
    return predictionTypes.map((pt: Record<string, unknown>) => ({
      type: (pt.type as PredictionType) ?? "winner",
      label: pt.label as string | undefined,
      options: pt.options as string[] | undefined,
      line: pt.line as number | undefined,
      threshold: pt.threshold as number | undefined,
      n: pt.n as number | undefined,
      handicap: pt.handicap as number | undefined,
      team: pt.team as string | undefined,
    }));
  }
  // fallback: single object with type
  if (
    predictionTypes &&
    typeof predictionTypes === "object" &&
    "type" in predictionTypes
  ) {
    return [
      {
        type: (predictionTypes.type as PredictionType) ?? "winner",
        label: predictionTypes.label as string | undefined,
        options: predictionTypes.options as string[] | undefined,
        line: predictionTypes.line as number | undefined,
        threshold: predictionTypes.threshold as number | undefined,
        n: predictionTypes.n as number | undefined,
        handicap: predictionTypes.handicap as number | undefined,
        team: predictionTypes.team as string | undefined,
      },
    ];
  }
  return [];
}

export function EventList({ events, competitionId }: EventListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterSport, setFilterSport] = useState<FilterSport>(
    searchParams.get("sport") ?? "all"
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    (searchParams.get("status") as FilterStatus) ?? "all"
  );

  // Extract unique sports for filter
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

  // Group events by status priority: upcoming first, then locked, then resulted
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
      // Within same status, sort by start_time
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

      // Refresh server data
      router.refresh();
    },
    [competitionId, router]
  );

  const selectClasses =
    "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400";

  if (events.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        No events in this competition yet. Check back later.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          className={selectClasses}
        >
          <option value="all">All Sports</option>
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className={selectClasses}
        >
          <option value="all">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="locked">Locked</option>
          <option value="resulted">Resulted</option>
          <option value="postponed">Postponed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {(filterSport !== "all" || filterStatus !== "all") && (
          <button
            onClick={() => {
              setFilterSport("all");
              setFilterStatus("all");
            }}
            className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredEvents.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          No events match the selected filters.
        </div>
      )}

      {/* Grouped event cards */}
      {Object.entries(groupedEvents).map(([groupLabel, groupEvents]) => (
        <div key={groupLabel}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {groupLabel}{" "}
            <span className="font-normal">({groupEvents.length})</span>
          </h3>
          <div className="space-y-3">
            {groupEvents.map((event) => {
              const isLocked =
                new Date(event.lock_time).getTime() <= Date.now() ||
                event.status !== "upcoming";
              const predictionTypes = parsePredictionTypes(
                event.prediction_types
              );
              const pointsSummary = getPointsSummary(event.predictions);

              return (
                <div
                  key={event.id}
                  className={`rounded-lg border border-zinc-200 border-l-4 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${getEventOutcomeClass(event, event.predictions)}`}
                >
                  {/* Event header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {event.event_name}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium dark:bg-zinc-800">
                          {event.sport}
                        </span>
                        <span>
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
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pointsSummary && (
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                          {pointsSummary}
                        </span>
                      )}
                      {getStatusBadge(event.status)}
                    </div>
                  </div>

                  {/* Lock countdown for upcoming */}
                  {event.status === "upcoming" && (
                    <div className="mt-2">
                      <Countdown lockTime={event.lock_time} />
                    </div>
                  )}

                  {/* Result display for resulted events */}
                  {event.status === "resulted" && event.result_data && (
                    <div className="mt-2 rounded bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800">
                      <span className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                        Result:{" "}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {formatResult(event.result_data)}
                      </span>
                    </div>
                  )}

                  {/* Prediction forms */}
                  {predictionTypes.length > 0 && (
                    <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      {predictionTypes.map((ptConfig) => {
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

                  {predictionTypes.length === 0 && (
                    <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 italic">
                      No prediction types configured for this event.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatResult(resultData: Record<string, unknown>): string {
  if (resultData.winner) return String(resultData.winner);
  if (resultData.score) return String(resultData.score);
  if (resultData.value !== undefined) return String(resultData.value);
  // Fallback: show key-value pairs
  const entries = Object.entries(resultData);
  if (entries.length === 0) return "Result recorded";
  return entries
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}
