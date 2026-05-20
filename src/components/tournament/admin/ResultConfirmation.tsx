"use client";

import { useState } from "react";

// Usage:
// <ResultConfirmation events={events} roundName="Round 1" />

interface Event {
  id: string;
  event_name: string;
  start_time: string;
  status: string; // 'upcoming' | 'locked' | 'resulted'
  result_data: Record<string, unknown> | null;
  result_confirmed: boolean;
  round_id: string | null;
}

interface ResultConfirmationProps {
  events: Event[];
  roundName: string;
}

type ConfirmingState = Record<string, boolean>;
type ErrorState = Record<string, string>;

function formatStartTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatResultData(data: Record<string, unknown> | null): string {
  if (!data) return "—";
  const { home_score, away_score, winner } = data as Record<string, unknown>;
  if (home_score !== undefined && away_score !== undefined) {
    return `${home_score} – ${away_score}`;
  }
  if (winner !== undefined) {
    return String(winner);
  }
  return JSON.stringify(data);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "resulted") {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        Resulted
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="rounded-full bg-ps-amber/15 px-2 py-0.5 text-xs font-semibold text-ps-amber">
        Locked
      </span>
    );
  }
  if (status === "upcoming") {
    return (
      <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
        Upcoming
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
      {status}
    </span>
  );
}

export function ResultConfirmation({ events, roundName }: ResultConfirmationProps) {
  const [confirming, setConfirming] = useState<ConfirmingState>({});
  const [errors, setErrors] = useState<ErrorState>({});
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(() => {
    return new Set(events.filter((e) => e.result_confirmed).map((e) => e.id));
  });

  const confirmedCount = confirmedIds.size;
  const totalCount = events.length;
  const progressPct = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

  async function handleConfirm(event: Event) {
    if (!event.result_data) return;

    setConfirming((prev) => ({ ...prev, [event.id]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[event.id];
      return next;
    });

    try {
      const res = await fetch("/api/tournament/confirm-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id, result_data: event.result_data }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }

      setConfirmedIds((prev) => new Set([...prev, event.id]));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [event.id]: err instanceof Error ? err.message : "Something went wrong",
      }));
    } finally {
      setConfirming((prev) => ({ ...prev, [event.id]: false }));
    }
  }

  return (
    <div className="w-full max-w-[480px]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ps-text">{roundName}</h2>
          <p className="mt-0.5 text-xs text-ps-text-sec">
            {confirmedCount}/{totalCount} results confirmed
          </p>
        </div>
        <span
          className={`font-mono text-sm font-bold ${
            confirmedCount === totalCount && totalCount > 0
              ? "text-ps-green"
              : "text-ps-amber"
          }`}
        >
          {progressPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-ps-border">
        <div
          className="h-full rounded-full bg-ps-green transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-ps-text-sec">
          No events in this round.
        </p>
      ) : (
        <div className="divide-y divide-ps-border rounded-xl border border-ps-border bg-ps-surface">
          {events.map((event) => {
            const isConfirmed = confirmedIds.has(event.id);
            const isConfirming = confirming[event.id] ?? false;
            const canConfirm =
              event.status === "resulted" &&
              !isConfirmed &&
              event.result_data !== null;
            const errorMsg = errors[event.id];

            return (
              <div key={event.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ps-text">
                      {event.event_name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-ps-text-ter">
                      {formatStartTime(event.start_time)}
                    </p>
                  </div>
                  <StatusBadge status={event.status} />
                </div>

                {/* Result row */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-sm text-ps-text-sec">
                    {event.status === "resulted" || isConfirmed
                      ? formatResultData(event.result_data)
                      : "Awaiting result"}
                  </span>

                  {isConfirmed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-ps-green">
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      Confirmed
                    </span>
                  ) : canConfirm ? (
                    <button
                      onClick={() => handleConfirm(event)}
                      disabled={isConfirming}
                      aria-label={`Confirm result for ${event.event_name}`}
                      className="flex items-center gap-1.5 rounded-lg bg-ps-green px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                    >
                      {isConfirming ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          />
                          Confirming...
                        </>
                      ) : (
                        "Confirm Result"
                      )}
                    </button>
                  ) : null}
                </div>

                {errorMsg && (
                  <p
                    role="alert"
                    className="mt-1.5 rounded-md bg-ps-red/10 px-2 py-1 text-xs text-ps-red"
                  >
                    {errorMsg}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
