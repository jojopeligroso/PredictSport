"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./CompetitionStatusBadge";
import { ResultPanel } from "./ResultPanel";
import { RoundBuilder } from "./RoundBuilder";
import { EventsAwaitingResults } from "./EventsAwaitingResults";
import { ManualEventWizard } from "./ManualEventWizard";
import { BulkEventCreator } from "./BulkEventCreator";
import type { Competition, Event, EventPredictionType, Round } from "@/types/database";

interface EventWithPredictionTypes extends Event {
  event_prediction_types: EventPredictionType[];
}

interface EventsSectionProps {
  competition: Competition;
  events: EventWithPredictionTypes[];
  rounds: Round[];
}

// ── Chevron icon ──────────────────────────────────────────────────────────────
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-ps-text-ter transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────
interface EventCardProps {
  event: EventWithPredictionTypes;
  competitionId: string;
  expandedEventId: string | null;
  updatingStatus: string | null;
  onStatusChange: (eventId: string, newStatus: string) => Promise<void>;
  onDelete: (event: EventWithPredictionTypes) => Promise<void>;
  onFetchResult: (event: Event) => Promise<void>;
  onToggleExpand: (eventId: string) => void;
  onConfirmed: () => void;
}

function EventCard({
  event,
  competitionId,
  expandedEventId,
  updatingStatus,
  onStatusChange,
  onDelete,
  onFetchResult,
  onToggleExpand,
  onConfirmed,
}: EventCardProps) {
  return (
    <div className="rounded-2xl border border-ps-border bg-ps-surface">
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
            <span>Start: {new Date(event.start_time).toLocaleString()}</span>
            <span>Lock: {new Date(event.lock_time).toLocaleString()}</span>
            {(event.event_prediction_types ?? []).length > 0 && (
              <span className="text-ps-text-ter">
                {(event.event_prediction_types ?? [])
                  .map((ept) => ept.prediction_type.replace(/_/g, " "))
                  .join(", ")}
              </span>
            )}
            {event.external_event_id && (
              <span className="text-ps-amber-deep">Linked</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Fetch Result button for linked events */}
          {event.external_event_id &&
            !event.result_confirmed &&
            event.status !== "cancelled" && (
              <button
                onClick={() => onFetchResult(event)}
                className="rounded-xl border border-ps-border-strong px-2.5 py-1 text-xs font-medium text-ps-text transition-colors hover:bg-ps-chip"
              >
                Fetch Result
              </button>
            )}

          {/* Status change actions */}
          {event.status === "upcoming" && (
            <div className="flex gap-1">
              <button
                onClick={() => onStatusChange(event.id, "postponed")}
                disabled={updatingStatus === event.id}
                className="rounded-xl border border-ps-amber px-2.5 py-1 text-xs font-medium text-ps-amber-deep transition-colors hover:bg-ps-amber-soft disabled:opacity-50"
              >
                Postpone
              </button>
              <button
                onClick={() => onStatusChange(event.id, "cancelled")}
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
                onClick={() => onStatusChange(event.id, "upcoming")}
                disabled={updatingStatus === event.id}
                className="rounded-xl border border-ps-green px-2.5 py-1 text-xs font-medium text-ps-green transition-colors hover:bg-ps-green-soft disabled:opacity-50"
              >
                Reinstate
              </button>
              <button
                onClick={() => onStatusChange(event.id, "cancelled")}
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
              onClick={() => onStatusChange(event.id, "upcoming")}
              disabled={updatingStatus === event.id}
              className="rounded-xl border border-ps-text-ter px-2.5 py-1 text-xs font-medium text-ps-text-sec transition-colors hover:bg-ps-chip disabled:opacity-50"
            >
              Reinstate
            </button>
          )}

          {/* Expand to show result panel */}
          {(event.status === "resulted" ||
            event.status === "locked" ||
            event.result_data) && (
            <button
              onClick={() => onToggleExpand(event.id)}
              className="rounded-xl border border-ps-border-strong bg-transparent px-2.5 py-1 text-xs font-medium text-ps-text transition-colors hover:bg-ps-chip"
            >
              {expandedEventId === event.id ? "Hide" : "Results"}
            </button>
          )}

          {/* Delete event */}
          {!event.result_confirmed && (
            <button
              onClick={() => onDelete(event)}
              disabled={updatingStatus === event.id}
              className="rounded-xl border border-ps-red/30 px-2.5 py-1 text-xs font-medium text-ps-red/70 transition-colors hover:border-ps-red hover:bg-ps-red-soft hover:text-ps-red disabled:opacity-50"
              title="Delete event"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Expanded result panel */}
      {expandedEventId === event.id && (
        <div className="border-t border-ps-border p-4">
          <ResultPanel
            event={event}
            competitionId={competitionId}
            onConfirmed={onConfirmed}
          />
        </div>
      )}
    </div>
  );
}

// ── RoundSection ──────────────────────────────────────────────────────────────
interface RoundSectionProps {
  round: Round | null; // null = ungrouped
  events: EventWithPredictionTypes[];
  isOpen: boolean;
  competition: Competition;
  expandedEventId: string | null;
  updatingStatus: string | null;
  updatingRound: string | null;
  onToggleRound: (roundId: string) => void;
  onStatusChange: (eventId: string, newStatus: string) => Promise<void>;
  onDeleteEvent: (event: EventWithPredictionTypes) => Promise<void>;
  onFetchResult: (event: Event) => Promise<void>;
  onToggleEvent: (eventId: string) => void;
  onEventConfirmed: () => void;
  onRoundStatusChange: (round: Round, newStatus: string) => Promise<void>;
  onDeleteRound: (round: Round) => Promise<void>;
}

function RoundSection({
  round,
  events,
  isOpen,
  competition,
  expandedEventId,
  updatingStatus,
  updatingRound,
  onToggleRound,
  onStatusChange,
  onDeleteEvent,
  onFetchResult,
  onToggleEvent,
  onEventConfirmed,
  onRoundStatusChange,
  onDeleteRound,
}: RoundSectionProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [showBulkCreator, setShowBulkCreator] = useState(false);
  const router = useRouter();

  const isUngrouped = round === null;
  const sectionId = isUngrouped ? "ungrouped" : round.id;
  const isUpdating = !isUngrouped && updatingRound === round.id;

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return (
    <div
      className={`rounded-2xl border ${
        isUngrouped
          ? "border-dashed border-ps-border"
          : "border-ps-border"
      } bg-ps-surface`}
    >
      {/* Round header — clickable */}
      <button
        type="button"
        onClick={() => onToggleRound(sectionId)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {isUngrouped ? (
            <span className="font-medium text-ps-text-sec">Ungrouped</span>
          ) : (
            <>
              <span className="font-semibold text-ps-text">
                Round {round.round_number}
                {round.name ? ` — ${round.name}` : ""}
              </span>
              <StatusBadge status={round.status} type="round" />
            </>
          )}
          <span className="text-xs text-ps-text-ter">
            {sortedEvents.length} {sortedEvents.length === 1 ? "event" : "events"}
          </span>
        </div>
        <ChevronIcon open={isOpen} />
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-ps-border px-4 pb-4 pt-3">
          {/* Round admin actions */}
          {!isUngrouped && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {round.status === "draft" && (
                <button
                  onClick={() => onRoundStatusChange(round, "open")}
                  disabled={isUpdating}
                  className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3 py-1.5 text-xs font-medium text-[#1a1208] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Open Round
                </button>
              )}
              {round.status === "open" && (
                <button
                  onClick={() => onRoundStatusChange(round, "locked")}
                  disabled={isUpdating}
                  className="rounded-xl border border-ps-amber px-3 py-1.5 text-xs font-medium text-ps-amber-deep transition-colors hover:bg-ps-amber-soft disabled:opacity-50"
                >
                  Lock Round
                </button>
              )}
              {round.status === "draft" && (
                <button
                  onClick={() => onDeleteRound(round)}
                  disabled={isUpdating}
                  className="rounded-xl border border-ps-red/30 px-3 py-1.5 text-xs font-medium text-ps-red/70 transition-colors hover:border-ps-red hover:bg-ps-red-soft hover:text-ps-red disabled:opacity-50"
                >
                  Delete Round
                </button>
              )}
            </div>
          )}

          {/* Event list */}
          {sortedEvents.length === 0 ? (
            <p className="py-2 text-sm text-ps-text-ter">No events in this round yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  competitionId={competition.id}
                  expandedEventId={expandedEventId}
                  updatingStatus={updatingStatus}
                  onStatusChange={onStatusChange}
                  onDelete={onDeleteEvent}
                  onFetchResult={onFetchResult}
                  onToggleExpand={onToggleEvent}
                  onConfirmed={onEventConfirmed}
                />
              ))}
            </div>
          )}

          {/* Add event within round */}
          {!isUngrouped && (
            <div className="mt-3">
              {showWizard ? (
                <ManualEventWizard
                  competitionId={competition.id}
                  lockDefaultMinutes={competition.lock_default_minutes}
                  onSuccess={() => {
                    setShowWizard(false);
                    router.refresh();
                  }}
                  onCancel={() => setShowWizard(false)}
                />
              ) : showBulkCreator ? (
                <BulkEventCreator
                  competitionId={competition.id}
                  roundId={round?.id}
                  lockDefaultMinutes={competition.lock_default_minutes}
                  onSuccess={() => {
                    setShowBulkCreator(false);
                    router.refresh();
                  }}
                  onCancel={() => setShowBulkCreator(false)}
                />
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowWizard(true)}
                    className="rounded-xl border border-dashed border-ps-border px-3 py-1.5 text-xs font-medium text-ps-text-sec transition-colors hover:border-ps-border-strong hover:text-ps-text"
                  >
                    + Event
                  </button>
                  <button
                    onClick={() => setShowBulkCreator(true)}
                    className="rounded-xl border border-dashed border-ps-border px-3 py-1.5 text-xs font-medium text-ps-text-sec transition-colors hover:border-ps-border-strong hover:text-ps-text"
                  >
                    Bulk Add
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── EventsSection (root) ──────────────────────────────────────────────────────
export function EventsSection({ competition, events, rounds }: EventsSectionProps) {
  const router = useRouter();
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [updatingRound, setUpdatingRound] = useState<string | null>(null);
  const [showRoundBuilder, setShowRoundBuilder] = useState(false);

  // Determine default open round: first open or draft round by round_number
  const sortedRounds = [...(rounds ?? [])].sort(
    (a, b) => a.round_number - b.round_number
  );
  const defaultOpenRound =
    sortedRounds.find((r) => r.status === "open" || r.status === "draft") ?? null;

  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(
    () => new Set(defaultOpenRound ? [defaultOpenRound.id] : [])
  );

  const toggleRound = (roundId: string) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
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
      if (res.ok) router.refresh();
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteEvent = async (event: EventWithPredictionTypes) => {
    if (!confirm(`Delete "${event.event_name}"? This cannot be undone.`)) return;
    setUpdatingStatus(event.id);
    try {
      const res = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          competition_id: competition.id,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to delete event");
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
      if (res.ok) router.refresh();
    } catch {
      // Refresh will show current state
    }
  };

  const handleRoundStatusChange = async (round: Round, newStatus: string) => {
    setUpdatingRound(round.id);
    try {
      const res = await fetch("/api/admin/rounds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round_id: round.id,
          competition_id: competition.id,
          status: newStatus,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setUpdatingRound(null);
    }
  };

  const handleDeleteRound = async (round: Round) => {
    if (
      !confirm(
        `Delete Round ${round.round_number}${round.name ? ` — ${round.name}` : ""}? All events in this round will also be deleted.`
      )
    )
      return;
    setUpdatingRound(round.id);
    try {
      const res = await fetch(
        `/api/admin/rounds?round_id=${round.id}&competition_id=${competition.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to delete round");
      }
    } finally {
      setUpdatingRound(null);
    }
  };

  const nextRoundNumber =
    sortedRounds.length > 0
      ? Math.max(...sortedRounds.map((r) => r.round_number)) + 1
      : 1;

  // Keep legacy quick-create for reference but primary flow is RoundBuilder
  const handleCreateRound = async () => {
    setShowRoundBuilder(true);
  };

  // Legacy quick-create (unused but kept for the "New Round" in empty state)
  const handleQuickCreateRound = async () => {
    try {
      const res = await fetch("/api/admin/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition_id: competition.id,
          round_number: nextRoundNumber,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to create round");
      }
    } finally {
      // quick-create cleanup
    }
  };

  // Group events by round_id
  const eventsByRound = new Map<string | null, EventWithPredictionTypes[]>();
  for (const event of events ?? []) {
    const key = event.round_id ?? null;
    const bucket = eventsByRound.get(key) ?? [];
    bucket.push(event);
    eventsByRound.set(key, bucket);
  }

  const ungroupedEvents = eventsByRound.get(null) ?? [];
  const hasAnyContent = sortedRounds.length > 0 || ungroupedEvents.length > 0;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-ps-text">Events</h3>
        <button
          onClick={handleCreateRound}
          className="rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1208] transition-opacity hover:opacity-90"
        >
          New Round
        </button>
      </div>

      {/* Events awaiting results */}
      <EventsAwaitingResults
        events={events ?? []}
        onSelectEvent={(eventId) => {
          const owningRound = sortedRounds.find((r) =>
            (eventsByRound.get(r.id) ?? []).some((e) => e.id === eventId)
          );
          const roundKey = owningRound ? owningRound.id : "ungrouped";
          setExpandedRounds((prev) => {
            const next = new Set(prev);
            next.add(roundKey);
            return next;
          });
          setExpandedEventId(eventId);
        }}
      />

      {/* Round Builder wizard */}
      {showRoundBuilder && (
        <div className="mb-6">
          <RoundBuilder
            competitionId={competition.id}
            nextRoundNumber={nextRoundNumber}
            scoringRules={competition.scoring_rules as Record<string, unknown>}
            onSuccess={() => {
              setShowRoundBuilder(false);
              router.refresh();
            }}
            onCancel={() => setShowRoundBuilder(false)}
          />
        </div>
      )}

      {!showRoundBuilder && !hasAnyContent ? (
        <div className="rounded-2xl border border-dashed border-ps-border p-8 text-center">
          <p className="text-ps-text-sec">No rounds added yet</p>
          <p className="mt-1 text-sm text-ps-text-ter">
            Create your first round to start adding events.
          </p>
        </div>
      ) : !showRoundBuilder ? (
        <div className="space-y-3">
          {/* Round sections ordered by round_number */}
          {sortedRounds.map((round) => (
            <RoundSection
              key={round.id}
              round={round}
              events={eventsByRound.get(round.id) ?? []}
              isOpen={expandedRounds.has(round.id)}
              competition={competition}
              expandedEventId={expandedEventId}
              updatingStatus={updatingStatus}
              updatingRound={updatingRound}
              onToggleRound={toggleRound}
              onStatusChange={handleStatusChange}
              onDeleteEvent={handleDeleteEvent}
              onFetchResult={handleFetchResult}
              onToggleEvent={(id) =>
                setExpandedEventId(expandedEventId === id ? null : id)
              }
              onEventConfirmed={() => {
                setExpandedEventId(null);
                router.refresh();
              }}
              onRoundStatusChange={handleRoundStatusChange}
              onDeleteRound={handleDeleteRound}
            />
          ))}

          {/* Ungrouped section */}
          {ungroupedEvents.length > 0 && (
            <RoundSection
              round={null}
              events={ungroupedEvents}
              isOpen={expandedRounds.has("ungrouped")}
              competition={competition}
              expandedEventId={expandedEventId}
              updatingStatus={updatingStatus}
              updatingRound={updatingRound}
              onToggleRound={toggleRound}
              onStatusChange={handleStatusChange}
              onDeleteEvent={handleDeleteEvent}
              onFetchResult={handleFetchResult}
              onToggleEvent={(id) =>
                setExpandedEventId(expandedEventId === id ? null : id)
              }
              onEventConfirmed={() => {
                setExpandedEventId(null);
                router.refresh();
              }}
              onRoundStatusChange={handleRoundStatusChange}
              onDeleteRound={handleDeleteRound}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
