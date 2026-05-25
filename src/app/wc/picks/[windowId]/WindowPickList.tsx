"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExactScoreSection } from "@/components/ExactScoreSection";
import { CountryFlag } from "@/components/CountryFlag";
import type {
  EventPredictionType,
  Prediction,
  PredictionType,
} from "@/types/database";

/**
 * WindowPickList — compact interactive pick UI for one World Cup matchday window.
 *
 * Each match renders as a single-row card: [Home] [Draw] [Away] with a small
 * "Exact score…" trigger underneath. The dates/times of the matches matter
 * less than fast outcome picking, so the card intentionally strips the
 * fixture header and metadata — the colour of the selected button is the
 * visual signal.
 *
 * Taps are optimistic. The W/D/L choice updates local state immediately, the
 * POST fires in the background, and only an error reverts the UI. A per-event
 * AbortController guarantees the latest tap wins if the user changes their
 * mind while a previous save is still in flight — the old behaviour of
 * disabling the buttons during save was eating taps and making the UI feel
 * dead.
 *
 * When the user lands their final pick of the window, `onWindowComplete`
 * fires once so the page can run a celebration overlay.
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
   * When true every event renders read-only, regardless of its own lock_time.
   */
  windowLocked: boolean;
  /** Fires the first time the user lands a pick that makes all matches picked. */
  onWindowComplete?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function winnerValue(pred: Prediction | undefined): string | null {
  if (!pred) return null;
  const d = pred.prediction_data ?? {};
  return (d.value as string) ?? (d.selection as string) ?? null;
}

/**
 * Map an option label to a button "slot". The slot drives the colour scheme:
 * home wins (left) glow amber-warm, draws (middle) glow ink-neutral, away
 * wins (right) glow amber-deep. We don't tie colour to the team name because
 * options like "Draw" are language-y rather than positional.
 */
type Slot = "home" | "draw" | "away";
function slotOf(label: string, home: string, away: string): Slot {
  if (label === home) return "home";
  if (label === away) return "away";
  return "draw";
}

// ── Single match row ─────────────────────────────────────────────────────────

function MatchPickRow({
  competitionId,
  event,
  initialPredictions,
  windowLocked,
  onWinnerLanded,
}: {
  competitionId: string;
  event: WindowEvent;
  initialPredictions: Prediction[];
  windowLocked: boolean;
  /** Fired AFTER the optimistic state has a non-null winner. */
  onWinnerLanded: (eventId: string, hasWinner: boolean) => void;
}) {
  const router = useRouter();

  const winnerEpt = event.event_prediction_types.find(
    (e) => e.prediction_type === "winner",
  );
  const scoreEpt = event.event_prediction_types.find(
    (e) => e.prediction_type === "exact_score",
  );

  const isLocked =
    windowLocked ||
    new Date(event.lock_time) <= new Date() ||
    event.status !== "upcoming";

  const { home, away } = useMemo(
    () => splitTeams(event.event_name),
    [event.event_name],
  );

  const initialWinner =
    initialPredictions.find((p) => p.prediction_type === "winner") ?? null;
  const initialScore =
    initialPredictions.find((p) => p.prediction_type === "exact_score") ?? null;

  const [winnerPred, setWinnerPred] = useState<Prediction | null>(
    initialWinner,
  );
  const [scorePred, setScorePred] = useState<Prediction | null>(initialScore);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Abort the previous in-flight winner POST when a new tap arrives so the
  // latest tap is what gets persisted even if the earlier one was slow.
  const winnerAbortRef = useRef<AbortController | null>(null);

  const currentWinner = winnerValue(winnerPred ?? undefined);

  const winnerOptions = useMemo<string[]>(() => {
    const opts = winnerEpt?.config?.options as string[] | undefined;
    if (opts && opts.length > 0) return opts;
    return away ? [home, "Draw", away] : [home];
  }, [winnerEpt, home, away]);

  const submitPrediction = useCallback(
    async (
      predictionType: PredictionType,
      predictionData: Record<string, unknown>,
      signal?: AbortSignal,
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
        signal,
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

  /**
   * Optimistic W/D/L tap.
   *
   * 1. Immediately reflect the new pick in local state.
   * 2. Abort any in-flight POST so a fresh, slow request can't overwrite the
   *    latest tap.
   * 3. Fire the new POST. On success, sync the canonical row back. On error,
   *    revert the optimistic state and show a small inline error.
   *
   * We deliberately do NOT disable the buttons during the request. Disabling
   * eats taps when the user changes their mind quickly and is the main reason
   * the old UI felt unresponsive.
   */
  const handlePickWinner = useCallback(
    (value: string) => {
      if (isLocked || !winnerEpt) return;
      if (value === currentWinner) return;

      const previousPred = winnerPred;
      const hadWinner = currentWinner !== null;

      // Optimistic local prediction so the UI updates instantly.
      const optimistic: Prediction = {
        ...(previousPred ??
          ({
            id: `optimistic-${event.id}`,
            event_prediction_type_id: winnerEpt.id,
            event_id: event.id,
            user_id: "",
            prediction_type: "winner",
            is_correct: null,
            is_partial: null,
            points_awarded: null,
            note_text: null,
            note_visibility: "private",
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as unknown as Prediction)),
        prediction_data: { value },
      };
      setWinnerPred(optimistic);
      setErrorMsg(null);

      if (!hadWinner) onWinnerLanded(event.id, true);

      winnerAbortRef.current?.abort();
      const controller = new AbortController();
      winnerAbortRef.current = controller;

      submitPrediction("winner", { value }, controller.signal)
        .then((saved) => {
          // A stale tap finished after a newer tap aborted it.
          if (controller.signal.aborted) return;
          if (saved) setWinnerPred(saved);
        })
        .catch((err: unknown) => {
          if (
            err instanceof Error &&
            (err.name === "AbortError" || controller.signal.aborted)
          ) {
            return;
          }
          // Revert.
          setWinnerPred(previousPred);
          if (!hadWinner) onWinnerLanded(event.id, false);
          setErrorMsg(
            err instanceof Error ? err.message : "Couldn’t save that pick",
          );
        });
    },
    [
      isLocked,
      winnerEpt,
      currentWinner,
      winnerPred,
      event.id,
      submitPrediction,
      onWinnerLanded,
    ],
  );

  // ExactScoreSection callbacks. It owns its own submit/clear/derivation state;
  // we persist and mirror the result into local state.
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
      const saved = await submitPrediction(
        data.predictionType,
        data.predictionData,
      );
      setWinnerPred(saved);
      const hasWinner = winnerValue(saved ?? undefined) !== null;
      onWinnerLanded(event.id, hasWinner);
    },
    [submitPrediction, onWinnerLanded, event.id],
  );

  if (isLocked) {
    // Read-only compact row. No buttons, just the locked pick.
    return (
      <div className="rounded-lg border border-ps-border bg-ps-surface px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ps-text">
            <CountryFlag shape="pill" name={home} size={18} />
            {home}
            <span className="mx-1 text-ps-text-ter">v</span>
            <CountryFlag shape="pill" name={away} size={18} />
            {away}
          </span>
          <span className="rounded-full bg-ps-chip px-2 py-0.5 text-[10px] font-semibold uppercase text-ps-text-sec">
            {event.result_confirmed ? "Resulted" : "Locked"}
          </span>
        </div>
        {currentWinner ? (
          <p className="mt-1 text-xs text-ps-text-sec">
            Picked:{" "}
            <span className="font-semibold text-ps-text">{currentWinner}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-ps-text-ter">No pick</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ps-border bg-ps-surface px-2 py-2">
      <div className="grid grid-cols-3 gap-1.5">
        {winnerOptions.map((opt) => {
          const isSelected = currentWinner === opt;
          const slot = slotOf(opt, home, away);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handlePickWinner(opt)}
              aria-pressed={isSelected}
              className={[
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center text-[13px] font-bold leading-tight transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber/50",
                "motion-reduce:transition-none active:scale-[0.97]",
                isSelected
                  ? slot === "draw"
                    ? "bg-ps-text text-ps-bg"
                    : "bg-ps-amber text-ps-text"
                  : "bg-ps-chip text-ps-text hover:bg-ps-chip/70",
              ].join(" ")}
            >
              {slot !== "draw" && <CountryFlag shape="pill" name={opt} size={18} />}
              <span className="truncate">{opt}</span>
            </button>
          );
        })}
      </div>

      {scoreEpt && (
        <div className="mt-1.5">
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
        </div>
      )}

      {errorMsg && (
        <p className="mt-1 text-[11px] font-medium text-ps-red">{errorMsg}</p>
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
  onWindowComplete,
}: WindowPickListProps) {
  const predsByEvent = useMemo(() => {
    const map = new Map<string, Prediction[]>();
    for (const p of predictions) {
      const list = map.get(p.event_id) ?? [];
      list.push(p);
      map.set(p.event_id, list);
    }
    return map;
  }, [predictions]);

  // Track which events have a (live or just-landed) winner pick. Used to
  // detect the "all matches picked" moment so the page can fire the
  // matchday-complete celebration.
  const initialPickedSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of predictions) {
      if (p.prediction_type === "winner" && winnerValue(p)) {
        set.add(p.event_id);
      }
    }
    return set;
  }, [predictions]);

  const [, setPickedEventIds] = useState<Set<string>>(initialPickedSet);
  const completedFiredRef = useRef(false);

  // Pickable events: live, unlocked matches in the window. The celebration
  // should fire when those are all picked — already-locked matches without a
  // pick can't be picked, so they shouldn't block completion.
  //
  // We snapshot `Date.now()` once at first render via a useState initializer
  // (the only render-safe place to call an impure function). A page reload
  // refreshes it, which is fine — windows lock on minute boundaries, not
  // tap-by-tap.
  const [nowAtMount] = useState<number>(() => Date.now());

  const pickableEventIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of events) {
      const eventLocked =
        windowLocked ||
        new Date(e.lock_time).getTime() <= nowAtMount ||
        e.status !== "upcoming";
      if (!eventLocked) ids.push(e.id);
    }
    return ids;
  }, [events, windowLocked, nowAtMount]);

  // If the user already finished the window before this mount (every pickable
  // match has a saved winner), don't fire the celebration — they're revisiting.
  useEffect(() => {
    if (pickableEventIds.length === 0) return;
    const alreadyComplete = pickableEventIds.every((id) =>
      initialPickedSet.has(id),
    );
    if (alreadyComplete) completedFiredRef.current = true;
  }, [pickableEventIds, initialPickedSet]);

  const handleWinnerLanded = useCallback(
    (eventId: string, hasWinner: boolean) => {
      setPickedEventIds((prev) => {
        const next = new Set(prev);
        if (hasWinner) next.add(eventId);
        else next.delete(eventId);

        if (
          !completedFiredRef.current &&
          pickableEventIds.length > 0 &&
          pickableEventIds.every((id) => next.has(id))
        ) {
          completedFiredRef.current = true;
          // Defer so React commits this set update before the overlay mounts.
          queueMicrotask(() => onWindowComplete?.());
        }

        return next;
      });
    },
    [pickableEventIds, onWindowComplete],
  );

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ps-text-sec">
        No fixtures scheduled for this window yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <MatchPickRow
          key={event.id}
          competitionId={competitionId}
          event={event}
          initialPredictions={predsByEvent.get(event.id) ?? []}
          windowLocked={windowLocked}
          onWinnerLanded={handleWinnerLanded}
        />
      ))}
    </div>
  );
}
