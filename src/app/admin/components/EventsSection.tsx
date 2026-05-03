"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./CompetitionStatusBadge";
import { AddEventForm } from "./AddEventForm";
import { ResultPanel } from "./ResultPanel";
import type { Competition, Event } from "@/types/database";

interface EventsSectionProps {
  competition: Competition;
  events: Event[];
}

export function EventsSection({ competition, events }: EventsSectionProps) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const sortedEvents = [...(events ?? [])].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const handleStatusChange = async (
    eventId: string,
    newStatus: string
  ) => {
    setUpdatingStatus(eventId);
    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          competition_id: competition.id,
          status: newStatus,
        }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleFetchResult = async (event: Event) => {
    if (!event.external_event_id) return;

    try {
      const res = await fetch("/api/sports/fetch-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: event.sport,
          externalEventId: event.external_event_id,
          eventId: event.id,
        }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Error handled silently -- refresh will show current state
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Events
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {showAddForm ? "Cancel" : "Add Event"}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6">
          <AddEventForm
            competitionId={competition.id}
            lockDefaultMinutes={competition.lock_default_minutes}
            onSuccess={() => {
              setShowAddForm(false);
              router.refresh();
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {sortedEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No events added yet
          </p>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            Add your first event to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Event header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                        {event.event_name}
                      </h4>
                      <StatusBadge status={event.status} type="event" />
                      {event.result_confirmed && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Confirmed
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="capitalize">{event.sport.replace(/_/g, " ")}</span>
                      <span>
                        Start: {new Date(event.start_time).toLocaleString()}
                      </span>
                      <span>
                        Lock: {new Date(event.lock_time).toLocaleString()}
                      </span>
                      {event.external_event_id && (
                        <span className="text-blue-600 dark:text-blue-400">
                          Linked
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Fetch Result button for linked events */}
                  {event.external_event_id &&
                    !event.result_confirmed &&
                    event.status !== "cancelled" && (
                      <button
                        onClick={() => handleFetchResult(event)}
                        className="rounded-md border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      >
                        Fetch Result
                      </button>
                    )}

                  {/* Status change actions */}
                  {event.status === "upcoming" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStatusChange(event.id, "postponed")}
                        disabled={updatingStatus === event.id}
                        className="rounded-md border border-orange-300 px-2.5 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                      >
                        Postpone
                      </button>
                      <button
                        onClick={() => handleStatusChange(event.id, "cancelled")}
                        disabled={updatingStatus === event.id}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Expand to show result panel */}
                  {(event.status === "resulted" || event.status === "locked" || event.result_data) && (
                    <button
                      onClick={() =>
                        setExpandedEventId(
                          expandedEventId === event.id ? null : event.id
                        )
                      }
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {expandedEventId === event.id ? "Hide" : "Results"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded result panel */}
              {expandedEventId === event.id && (
                <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                  <ResultPanel
                    event={event}
                    competitionId={competition.id}
                    onConfirmed={() => {
                      setExpandedEventId(null);
                      router.refresh();
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
