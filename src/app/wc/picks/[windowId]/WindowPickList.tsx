"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PickButton } from "@/components/ui";
import { ExactScoreSection } from "@/components/ExactScoreSection";
import type {
  EventPredictionType,
  Prediction,
  PredictionType,
} from "@/types/database";

/**
 * WindowPickList — interactive pick UI for one World Cup matchday window (U2).
 *
 * Renders each group event with a 3-way W/D/L pick (PickButton) and an optional
 * exact-score input (ExactScoreSection). Picks save per-event: each tap / score
 * save fires its own POST /api/predictions. Per-event locking — a match goes
 * read-only once its lock_time passes; the rest of the window stays pickable.
 *
 * The exact score and W/D/L are the single source of truth feeding the Overall
 * and Format classifications (and Bracket group-stage tiebreakers). This
 * component only WRITES per-event `predictions`; it does not touch the bracket
 * blob (carry-over is U3/U4).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface WindowEvent {
  id: string;
  event_name: string;
  sport: string;
  start_time: string;
  lock_time: string;
  status: string;
  result_confirmed: boolean;
  event_prediction_types: EventPredictionType[];
}

interface WindowPickListProps {
  competitionId: string;
  events: WindowEvent[];
  /** All existing predictions for this user across the window's events. */
  predictions: Prediction[];
  /**
   * Whether the whole window is closed (round status 'locked'/'scored').
   * When true every event renders read-only, regardless of its own lock_time
   * — e.g. a superadmin override that locks the window early.
   */
  windowLocked: boolean;
}

/** Per-event save lifecycle, surfaced as a small status line on the card. */
type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Split "Mexico vs South Africa" into [home, away] for the score input labels. */
function splitTeams(eventName: string): { home: string; away: string } {
  for (const sep of [" vs ", " v ", " VS ", " V "]) {
    const idx = eventName.indexOf(sep);
    if (idx !== -1) {
      return {
        home: eventName.slice(0, idx).trim(),
        away: eventName.slice(idx + sep.length).trim(),
      };
    }
  }
  return { home: eventName, away: "" };
}

/** The winner value the user currently has stored, if any. */
function winnerValue(pred: Prediction | undefined): string | null {
  if (!pred) return null;
  const d = pred.prediction_data ?? {};
  return (d.value as string) ?? (d.selection as string) ?? null;
}

// ── Single event card ────────────────────────────────────────────────────────

function EventPickCard({
  competitionId,
  event,
  initialPredictions,
  windowLocked,
}: {
  competitionId: string;
  event: WindowEvent;
  initialPredictions: Prediction[];
  windowLocked: boolean;
}) {
  const router = useRouter();

  const winnerEpt = event.event_prediction_types.find(
    (e) => e.prediction_type === "winner",
  );
  const scoreEpt = event.event_prediction_types.find(
    (e) => e.prediction_type === "exact_score",
  );

  // Locked when: the whole window is closed, OR this event's kickoff lock_time
  // has passed, OR the event has left "upcoming". POST /api/predictions
  // enforces lock_time server-side regardless — the UI gate only avoids
  // showing controls that would fail.
  const isLocked =
    windowLocked ||
    new Date(event.lock_time) <= new Date() ||
    event.status !== "upcoming";

  const { home, away } = useMemo(
    () => splitTeams(event.event_name),
    [event.event_name],
  );

  // Existing predictions for this event, kept in local state so the UI updates
  // optimistically after a save without a full round-trip refresh.
  const initialWinner =
    initialPredictions.find((p) => p.prediction_type === "winner") ?? null;
  const initialScore =
    initialPredictions.find((p) => p.prediction_type === "exact_score") ?? null;

  const [winnerPred, setWinnerPred] = useState<Prediction | null>(
    initialWinner,
  );
  const [scorePred, setScorePred] = useState<Prediction | null>(initialScore);
  const [winnerSave, setWinnerSave] = useState<SaveState>({ kind: "idle" });

  const currentWinner = winnerValue(winnerPred ?? undefined);

  // W/D/L options come straight from config.options — the U2 migration
  // rewrote these to [home, "Draw", away]. Fall back to a derived 3-way if a
  // row somehow lacks options.
  const winnerOptions = useMemo<string[]>(() => {
    const opts = winnerEpt?.config?.options as string[] | undefined;
    if (opts && opts.length > 0) return opts;
    return away ? [home, "Draw", away] : [home];
  }, [winnerEpt, home, away]);

  /** POST a prediction; returns the saved row. Throws with the API message. */
  const submitPrediction = useCallback(
    async (
      predictionType: PredictionType,
      predictionData: Record<string, unknown>,
    ): Promise<Prediction | null> => {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          competition_id: competitionId,
          prediction_type: predictionType,
          prediction_data: predictionData,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ??
            "Failed to save pick. Try again.",
        );
      }
      if ((body as { deleted?: boolean }).deleted) return null;
      return (body as { prediction?: Prediction }).prediction ?? null;
    },
    [event.id, competitionId],
  );

  /** W/D/L tap: save immediately, optimistic local update. */
  const handlePickWinner = useCallback(
    async (value: string) => {
      if (isLocked || !winnerEpt) return;
      if (value === currentWinner) return; // no-op re-tap
      setWinnerSave({ kind: "saving" });
      try {
        const saved = await submitPrediction("winner", { value });
        setWinnerPred(saved);
        setWinnerSave({ kind: "saved" });
      } catch (err) {
        setWinnerSave({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to save",
        });
      }
    },
    [isLocked, winnerEpt, currentWinner, submitPrediction],
  );

  // ExactScoreSection callbacks. It owns its own submit/clear/derivation state;
  // we just persist and mirror the result into local state.
  const handleSubmitScore = useCallback(
    async (data: {
      eventId: string;
      predictionType: PredictionType;
      predictionData: Record<string, unknown>;
    }) => {
      const saved = await submitPrediction(
        data.predictionType,
        data.predictionData,
      );
      setScorePred(saved);
      router.refresh();
    },
    [submitPrediction, router],
  );

  const handleUpdateWinner = useCallback(
    async (data: {
      eventId: string;
      predictionType: PredictionType;
      predictionData: Record<string, unknown>;
    }) => {
      // ExactScoreSection derives a winner from a complete score and syncs it.
      const saved = await submitPrediction(
        data.predictionType,
        data.predictionData,
      );
      setWinnerPred(saved);
    },
    [submitPrediction],
  );

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-ps-text">
            {event.event_name}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-ps-text-ter">
            {new Date(event.start_time).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {isLocked && (
          <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-sec">
            {event.result_confirmed ? "Resulted" : "Locked"}
          </span>
        )}
      </div>

      {/* W/D/L pick */}
      {winnerEpt && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ps-text-sec">
              Match Outcome
            </span>
            <span className="font-mono text-[11px] text-ps-text-ter">
              +{winnerEpt.points}pts
            </span>
          </div>

          {isLocked ? (
            <p className="text-sm font-semibold text-ps-text">
              {currentWinner ?? (
                <span className="font-normal text-ps-text-ter">No pick</span>
              )}
            </p>
          ) : (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${winnerOptions.length}, minmax(0, 1fr))`,
              }}
            >
              {winnerOptions.map((opt) => (
                <PickButton
                  key={opt}
                  label={opt}
                  selected={currentWinner === opt}
                  disabled={winnerSave.kind === "saving"}
                  onClick={() => handlePickWinner(opt)}
                />
              ))}
            </div>
          )}

          {winnerSave.kind === "saving" && (
            <p className="mt-1.5 text-[11px] font-medium text-ps-text-ter">
              Saving…
            </p>
          )}
          {winnerSave.kind === "saved" && (
            <p className="mt-1.5 text-[11px] font-medium text-ps-green">
              Saved ✓
            </p>
          )}
          {winnerSave.kind === "error" && (
            <p className="mt-1.5 text-[11px] font-medium text-ps-red">
              {winnerSave.message}
            </p>
          )}
        </div>
      )}

      {/* Exact score — required for Overall/Format scoring and group tiebreakers */}
      {scoreEpt && (
        <ExactScoreSection
          eventId={event.id}
          sport={event.sport}
          homeTeam={home}
          awayTeam={away}
          ept={scoreEpt}
          winnerOptions={winnerOptions}
          currentWinnerPick={currentWinner}
          existingScorePrediction={scorePred}
          isLocked={isLocked}
          onSubmitScore={handleSubmitScore}
          onUpdateWinner={handleUpdateWinner}
        />
      )}
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

export function WindowPickList({
  competitionId,
  events,
  predictions,
  windowLocked,
}: WindowPickListProps) {
  // Group existing predictions by event for O(1) lookup per card.
  const predsByEvent = useMemo(() => {
    const map = new Map<string, Prediction[]>();
    for (const p of predictions) {
      const list = map.get(p.event_id) ?? [];
      list.push(p);
      map.set(p.event_id, list);
    }
    return map;
  }, [predictions]);

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ps-text-sec">
        No fixtures scheduled for this window yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventPickCard
          key={event.id}
          competitionId={competitionId}
          event={event}
          initialPredictions={predsByEvent.get(event.id) ?? []}
          windowLocked={windowLocked}
        />
      ))}
    </div>
  );
}
