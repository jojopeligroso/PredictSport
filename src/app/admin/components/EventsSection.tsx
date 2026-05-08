"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./CompetitionStatusBadge";
import { AddEventForm } from "./AddEventForm";
import { ResultPanel } from "./ResultPanel";
import type { Competition, Event, EventPredictionType, Round } from "@/types/database";

interface EventWithPredictionTypes extends Event {
  event_prediction_types: EventPredictionType[];
}

interface EventsSectionProps {
  competition: Competition;
  events: EventWithPredictionTypes[];
  rounds: Round[];
}

export function EventsSection({ competition, events, rounds }: EventsSectionProps) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [rescheduleEventId, setRescheduleEventId] = useState<string | null>(null);

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
        <h3 className="text-lg font-semibold text-ps-text">
          Events
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1208] transition-opacity hover:opacity-90"
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
        <div className="rounded-2xl border border-dashed border-ps-border p-8 text-center">
          <p className="text-ps-text-sec">
            No events added yet
          </p>
          <p className="mt-1 text-sm text-ps-text-ter">
            Add your first event to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-ps-border bg-ps-surface"
            >
              {/* Event header */}
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium text-ps-text truncate">
                      {event.event_name}
                    </h4>
                    <StatusBadge status={event.status} type="event" />
                    {event.result_confirmed && (
                      <span className="inline-flex items-center rounded-full bg-ps-green-soft px-2 py-0.5 text-xs font-medium text-ps-green">
                        Confirmed
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ps-text-ter">
                    <span className="capitalize">{event.sport.replace(/_/g, " ")}</span>
                    <span>
                      Start: {new Date(event.start_time).toLocaleString()}
                    </span>
                    <span>
                      Lock: {new Date(event.lock_time).toLocaleString()}
                    </span>
                    {(event.event_prediction_types ?? []).length > 0 && (
                      <span className="text-ps-text-ter">
                        {(event.event_prediction_types ?? [])
                          .map((ept) => ept.prediction_type.replace(/_/g, " "))
                          .join(", ")}
                      </span>
                    )}
                    {event.external_event_id && (
                      <span className="text-ps-amber-deep">
                        Linked
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Fetch Result button for linked events */}
                  {event.external_event_id &&
                    !event.result_confirmed &&
                    event.status !== "cancelled" && (
                      <button
                        onClick={() => handleFetchResult(event)}
                        className="rounded-xl border border-ps-border-strong px-2.5 py-1 text-xs font-medium text-ps-text transition-colors hover:bg-ps-chip"
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
                        className="rounded-xl border border-ps-amber px-2.5 py-1 text-xs font-medium text-ps-amber-deep transition-colors hover:bg-ps-amber-soft disabled:opacity-50"
                      >
                        Postpone
                      </button>
                      <button
                        onClick={() => handleStatusChange(event.id, "cancelled")}
                        disabled={updatingStatus === event.id}
                        className="rounded-xl border border-ps-red px-2.5 py-1 text-xs font-medium text-ps-red transition-colors hover:bg-ps-red-soft disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Reintroduce postponed events */}
                  {event.status === "postponed" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setRescheduleEventId(
                          rescheduleEventId === event.id ? null : event.id
                        )}
                        disabled={updatingStatus === event.id}
                        className="rounded-xl border border-ps-green px-2.5 py-1 text-xs font-medium text-ps-green transition-colors hover:bg-ps-green-soft disabled:opacity-50"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => handleStatusChange(event.id, "cancelled")}
                        disabled={updatingStatus === event.id}
                        className="rounded-xl border border-ps-red px-2.5 py-1 text-xs font-medium text-ps-red transition-colors hover:bg-ps-red-soft disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Reinstate cancelled events */}
                  {event.status === "cancelled" && !event.result_confirmed && (
                    <button
                      onClick={() => handleStatusChange(event.id, "upcoming")}
                      disabled={updatingStatus === event.id}
                      className="rounded-xl border border-ps-text-ter px-2.5 py-1 text-xs font-medium text-ps-text-sec transition-colors hover:bg-ps-chip disabled:opacity-50"
                    >
                      Reinstate
                    </button>
                  )}

                  {/* Expand to show result panel */}
                  {(event.status === "resulted" || event.status === "locked" || event.result_data) && (
                    <button
                      onClick={() =>
                        setExpandedEventId(
                          expandedEventId === event.id ? null : event.id
                        )
                      }
                      className="rounded-xl border border-ps-border-strong bg-transparent px-2.5 py-1 text-xs font-medium text-ps-text transition-colors hover:bg-ps-chip"
                    >
                      {expandedEventId === event.id ? "Hide" : "Results"}
                    </button>
                  )}
                </div>
              </div>

              {/* Reschedule panel */}
              {rescheduleEventId === event.id && (
                <div className="border-t border-ps-border p-4">
                  <ReschedulePanel
                    event={event}
                    competitionId={competition.id}
                    lockDefaultMinutes={competition.lock_default_minutes}
                    onDone={() => {
                      setRescheduleEventId(null);
                      router.refresh();
                    }}
                    onCancel={() => setRescheduleEventId(null)}
                  />
                </div>
              )}

              {/* Expanded result panel */}
              {expandedEventId === event.id && (
                <div className="border-t border-ps-border p-4">
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

// ---- Reschedule panel for postponed events ----------------------------------

function ReschedulePanel({
  event,
  competitionId,
  lockDefaultMinutes,
  onDone,
  onCancel,
}: {
  event: Event;
  competitionId: string;
  lockDefaultMinutes: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [startTime, setStartTime] = useState("");
  const [lockTime, setLockTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyLockTime = (startIso: string) => {
    const d = new Date(startIso);
    const lock = new Date(d.getTime() - lockDefaultMinutes * 60 * 1000);
    setLockTime(lock.toISOString().slice(0, 16));
  };

  const handleStartChange = (value: string) => {
    setStartTime(value);
    if (value) applyLockTime(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !lockTime) {
      setError("Both times are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          competition_id: competitionId,
          start_time: new Date(startTime).toISOString(),
          lock_time: new Date(lockTime).toISOString(),
          status: "upcoming",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to reschedule");
        return;
      }
      onDone();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-medium text-ps-text">
        Reschedule &ldquo;{event.event_name}&rdquo;
      </p>

      {error && (
        <div className="rounded-xl bg-ps-red-soft px-3 py-2 text-xs text-ps-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-ps-text-ter mb-1">
            New Start Time
          </label>
          <input
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-1.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
          />
        </div>
        <div>
          <label className="block text-xs text-ps-text-ter mb-1">
            New Lock Time
          </label>
          <input
            type="datetime-local"
            required
            value={lockTime}
            onChange={(e) => setLockTime(e.target.value)}
            className="w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-1.5 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
          />
          <p className="mt-0.5 text-[10px] text-ps-text-ter">
            Auto-set {lockDefaultMinutes} min before start
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-ps-green px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Reschedule & Reopen"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-ps-border px-3 py-1.5 text-xs text-ps-text-sec hover:bg-ps-chip"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
