"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { deriveWinnerFromScore } from "@/lib/score-format";
import type { Prediction, PredictionType } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────

export type ScoreDisplay =
  | { status: "empty" }
  | { status: "committed"; home: number; away: number }
  | { status: "resetting" };

export type CardFeedback =
  | { type: "idle" }
  | {
      type: "conflict";
      serverWinner: string;
      enteredPick: string;
      score: { home: number; away: number };
    }
  | { type: "success" };

interface SubmitResult {
  prediction: Prediction | null;
  corrected?: boolean;
  server_winner?: string | null;
}

// ── Helper ─────────────────────────────────────────────────────────────

function winnerValue(pred: Prediction | undefined | null): string | null {
  if (!pred) return null;
  const d = pred.prediction_data ?? {};
  return (d.value as string) ?? (d.selection as string) ?? null;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function usePredictionState({
  initialPredictions,
  eventId,
  competitionId,
  sport,
  winnerEptId,
  winnerOptions,
  scoreEptId,
  isLocked,
  onWinnerLanded,
}: {
  initialPredictions: Prediction[];
  eventId: string;
  competitionId: string;
  sport: string;
  winnerEptId: string | undefined;
  winnerOptions: string[];
  scoreEptId: string | undefined;
  isLocked: boolean;
  onWinnerLanded: (eventId: string, hasWinner: boolean) => void;
}) {
  const router = useRouter();
  const t = useT();

  // ── Derive initial state from props ────────────────────────────────

  const initialWinner =
    initialPredictions.find((p) => p.prediction_type === "winner") ?? null;
  const initialScore =
    initialPredictions.find((p) => p.prediction_type === "exact_score") ?? null;

  // ── State ──────────────────────────────────────────────────────────

  const [winnerPred, setWinnerPred] = useState<Prediction | null>(
    initialWinner,
  );
  const [scoreDisplay, setScoreDisplay] = useState<ScoreDisplay>(() => {
    if (
      initialScore?.prediction_data?.home != null &&
      initialScore?.prediction_data?.away != null
    ) {
      return {
        status: "committed",
        home: Number(initialScore.prediction_data.home),
        away: Number(initialScore.prediction_data.away),
      };
    }
    return { status: "empty" };
  });
  const [scoreResetKey, setScoreResetKey] = useState(0);
  const [resetInFlight, setResetInFlight] = useState(false);
  const [feedback, setFeedback] = useState<CardFeedback>({ type: "idle" });
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── Derived ────────────────────────────────────────────────────────

  const rawWinner = winnerValue(winnerPred);

  // Score is source of truth: if both predictions exist, derive the
  // display winner from the score to prevent contradictory display.
  // Uses initialScore from props (updates on router.refresh()) combined
  // with rawWinner from state (updates on optimistic taps).
  const currentWinner = useMemo(() => {
    if (initialScore && rawWinner) {
      const implied = deriveWinnerFromScore(
        initialScore.prediction_data as Record<string, unknown>,
        sport,
        winnerOptions,
      );
      if (implied) return implied;
    }
    return rawWinner;
  }, [initialScore, rawWinner, sport, winnerOptions]);

  // ── Abort helper ───────────────────────────────────────────────────

  const abortAndReplace = useCallback((): AbortController => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, []);

  // ── Submit helper ──────────────────────────────────────────────────

  const submitPrediction = useCallback(
    async (
      predictionType: PredictionType,
      predictionData: Record<string, unknown>,
      signal?: AbortSignal,
    ): Promise<SubmitResult> => {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
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
      if ((body as { deleted?: boolean }).deleted)
        return { prediction: null };
      return {
        prediction:
          (body as { prediction?: Prediction }).prediction ?? null,
        corrected: (body as { corrected?: boolean }).corrected,
        server_winner: (body as { server_winner?: string | null })
          .server_winner,
      };
    },
    [eventId, competitionId],
  );

  // ── Pick winner ────────────────────────────────────────────────────

  const pickWinner = useCallback(
    (value: string) => {
      if (isLocked || !winnerEptId) return;
      if (value === currentWinner) return;

      const previousPred = winnerPred;
      const hadWinner = currentWinner !== null;

      const optimistic: Prediction = {
        ...(previousPred ??
          ({
            id: `optimistic-${eventId}`,
            event_prediction_type_id: winnerEptId,
            event_id: eventId,
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
      setError(null);
      if (!hadWinner) onWinnerLanded(eventId, true);

      const controller = abortAndReplace();

      submitPrediction("winner", { value }, controller.signal)
        .then(({ prediction: saved, corrected, server_winner }) => {
          if (controller.signal.aborted) return;
          if (saved) {
            setWinnerPred(saved);
            if (corrected && server_winner && server_winner !== value) {
              setFeedback({
                type: "conflict",
                serverWinner: server_winner,
                enteredPick: value,
                score:
                  scoreDisplay.status === "committed"
                    ? {
                        home: scoreDisplay.home,
                        away: scoreDisplay.away,
                      }
                    : { home: 0, away: 0 },
              });
            }
          }
        })
        .catch((err: unknown) => {
          if (
            err instanceof Error &&
            (err.name === "AbortError" || controller.signal.aborted)
          )
            return;
          setWinnerPred(previousPred);
          if (!hadWinner) onWinnerLanded(eventId, false);
          setError(
            err instanceof Error
              ? err.message
              : t("prediction.error_save"),
          );
        });
    },
    [
      isLocked,
      winnerEptId,
      currentWinner,
      winnerPred,
      eventId,
      scoreDisplay,
      abortAndReplace,
      submitPrediction,
      onWinnerLanded,
      t,
    ],
  );

  // ── Commit score ───────────────────────────────────────────────────

  const commitScore = useCallback(
    async (homeNum: number, awayNum: number) => {
      if (!scoreEptId) return;
      // Dedup: skip if identical to current committed score
      if (
        scoreDisplay.status === "committed" &&
        scoreDisplay.home === homeNum &&
        scoreDisplay.away === awayNum
      )
        return;

      try {
        abortRef.current?.abort();
        await submitPrediction("exact_score", {
          home: homeNum,
          away: awayNum,
        });
        setScoreDisplay({
          status: "committed",
          home: homeNum,
          away: awayNum,
        });
        // Green flash if resolving a conflict
        if (feedback.type === "conflict") {
          setFeedback({ type: "success" });
        }
        router.refresh();
      } catch {
        // CAS conflict or transient — refresh to get latest state
        router.refresh();
      }
    },
    [scoreEptId, scoreDisplay, feedback, submitPrediction, router],
  );

  // ── Reset ──────────────────────────────────────────────────────────

  const resetAll = useCallback(async () => {
    if (isLocked) return;

    abortRef.current?.abort();

    const previousWinner = winnerPred;
    const previousScore = scoreDisplay;
    const hadWinner = currentWinner !== null;

    // Optimistic clear
    setWinnerPred(null);
    setScoreDisplay({ status: "resetting" });
    setScoreResetKey((k) => k + 1);
    setResetInFlight(true);
    setError(null);
    setFeedback({ type: "idle" });
    if (hadWinner) onWinnerLanded(eventId, false);

    try {
      await fetch("/api/predictions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          competition_id: competitionId,
        }),
      });
      router.refresh();
    } catch {
      setWinnerPred(previousWinner);
      setScoreDisplay(previousScore);
      setResetInFlight(false);
      if (hadWinner) onWinnerLanded(eventId, true);
      setError(t("prediction.error_reset"));
    }
  }, [
    isLocked,
    winnerPred,
    scoreDisplay,
    currentWinner,
    eventId,
    competitionId,
    router,
    onWinnerLanded,
    t,
  ]);

  // ── Clear feedback ─────────────────────────────────────────────────

  const clearFeedback = useCallback(() => {
    setFeedback({ type: "idle" });
  }, []);

  return {
    currentWinner,
    scoreDisplay,
    feedback,
    error,
    scoreResetKey,
    resetInFlight,
    initialScore,
    pickWinner,
    commitScore,
    resetAll,
    clearFeedback,
  };
}
