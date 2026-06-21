"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ExactScoreInput,
  emptyScore,
  isScoreComplete,
  scoreToData,
  dataToScore,
  type ScoreValue,
} from "./ExactScoreInput";
import { ScoreInput } from "./ScoreInput";
import { deriveWinnerFromScore, getScoreFormat } from "@/lib/score-format";
import { useT } from "@/lib/i18n";
import type { Prediction, PredictionType, EventPredictionType } from "@/types/database";

interface ExactScoreSectionProps {
  eventId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  ept: EventPredictionType;
  winnerOptions: string[];
  currentWinnerPick: string | null;
  existingScorePrediction: Prediction | null;
  isLocked: boolean;
  onSubmitScore: (data: {
    eventId: string;
    predictionType: PredictionType;
    predictionData: Record<string, unknown>;
  }) => Promise<void>;
  onUpdateWinner: (data: {
    eventId: string;
    predictionType: PredictionType;
    predictionData: Record<string, unknown>;
  }) => Promise<void>;
}

export function ExactScoreSection({
  eventId,
  sport,
  homeTeam,
  awayTeam,
  ept,
  winnerOptions,
  currentWinnerPick,
  existingScorePrediction,
  isLocked,
  onSubmitScore,
  onUpdateWinner,
}: ExactScoreSectionProps) {
  const t = useT();
  const isGAA = getScoreFormat(sport) === "gaa";

  const [isExpanded, setIsExpanded] = useState(
    existingScorePrediction !== null
  );
  // Score state is only used for GAA (ExactScoreInput is controlled).
  // For standard sports, ScoreInput manages its own state internally.
  const [score, setScore] = useState<ScoreValue>(() =>
    dataToScore(
      existingScorePrediction?.prediction_data ?? null,
      sport
    )
  );
  // Reset key — incrementing remounts ScoreInput with fresh state (used by clear).
  const [resetKey, setResetKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the "original" winner pick before derivation
  const originalWinnerRef = useRef<string | null>(currentWinnerPick);

  // Update original ref when winner changes externally (not from derivation)
  useEffect(() => {
    if (!isExpanded) {
      originalWinnerRef.current = currentWinnerPick;
    }
  }, [currentWinnerPick, isExpanded]);

  // Derivation message — only needed for GAA (which still uses manual Save).
  const derivationMsg = useMemo(() => {
    if (!isGAA) return null;
    if (!isExpanded || !isScoreComplete(score, sport)) return null;
    const scoreData = scoreToData(score, sport);
    if (!scoreData) return null;
    const implied = deriveWinnerFromScore(scoreData, sport, winnerOptions);
    if (!implied) return null;
    if (implied !== currentWinnerPick) {
      return `Score implies ${implied} — winner updated`;
    }
    return null;
  }, [isGAA, score, sport, winnerOptions, currentWinnerPick, isExpanded]);

  // GAA manual save — standard sports auto-commit via ScoreInput.
  const handleSave = useCallback(async () => {
    if (!isScoreComplete(score, sport)) {
      setError("Fill in all score fields");
      return;
    }

    const scoreData = scoreToData(score, sport);
    if (!scoreData) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const implied = deriveWinnerFromScore(scoreData, sport, winnerOptions);

      await onSubmitScore({
        eventId,
        predictionType: "exact_score",
        predictionData: scoreData,
      });

      if (implied && implied !== currentWinnerPick) {
        await onUpdateWinner({
          eventId,
          predictionType: "winner",
          predictionData: { value: implied },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }, [score, sport, winnerOptions, currentWinnerPick, eventId, onSubmitScore, onUpdateWinner]);

  // Standard-sport auto-commit handler — receives parsed numbers from ScoreInput.
  const handleScoreCommit = useCallback(async (homeNum: number, awayNum: number) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const scoreData = { home: homeNum, away: awayNum };
      const implied = deriveWinnerFromScore(scoreData, sport, winnerOptions);

      await onSubmitScore({
        eventId,
        predictionType: "exact_score",
        predictionData: scoreData,
      });

      if (implied && implied !== currentWinnerPick) {
        await onUpdateWinner({
          eventId,
          predictionType: "winner",
          predictionData: { value: implied },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }, [sport, winnerOptions, currentWinnerPick, eventId, onSubmitScore, onUpdateWinner]);

  const handleClear = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmitScore({
        eventId,
        predictionType: "exact_score",
        predictionData: { _clear: true },
      });

      // Revert winner to original pick
      if (originalWinnerRef.current && originalWinnerRef.current !== currentWinnerPick) {
        await onUpdateWinner({
          eventId,
          predictionType: "winner",
          predictionData: { value: originalWinnerRef.current },
        });
      }

      setScore(emptyScore(sport));
      setResetKey((k) => k + 1);
      setIsExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setIsSubmitting(false);
    }
  }, [sport, eventId, currentWinnerPick, onSubmitScore, onUpdateWinner]);

  if (isLocked) {
    if (!existingScorePrediction) return null;
    const data = existingScorePrediction.prediction_data;
    return (
      <div className="mt-2 rounded-lg bg-ps-chip px-3 py-2">
        <span className="text-caption font-medium uppercase text-ps-text-ter">
          Exact Score:{" "}
        </span>
        <span className="font-mono text-sm font-medium text-ps-text">
          {formatScoreDisplay(data, sport)}
        </span>
        {existingScorePrediction.is_correct !== null && (
          <span
            className="ml-1.5 font-bold"
            style={{
              color: existingScorePrediction.is_correct
                ? "var(--ps-green)"
                : "var(--ps-red)",
            }}
          >
            {existingScorePrediction.is_correct ? "✓" : "✗"}
          </span>
        )}
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ps-amber-deep transition-colors hover:text-ps-amber"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 2v8M2 6h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Predict exact score (+{ept.points}pts)
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-ps-border bg-ps-chip/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-caption font-bold uppercase tracking-wide text-ps-text-sec">
          Exact Score
        </span>
        <span className="text-caption font-mono text-ps-text-ter">
          +{ept.points}pts
        </span>
      </div>

      {isGAA ? (
        /* GAA uses 4-input ExactScoreInput with manual Save */
        <>
          <ExactScoreInput
            sport={sport}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            value={score}
            onChange={setScore}
            disabled={isSubmitting}
          />

          {derivationMsg && (
            <p className="mt-2 text-caption font-medium text-ps-amber-deep animate-pulse">
              {derivationMsg}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || !isScoreComplete(score, sport)}
              className="rounded-lg bg-ps-text px-3 py-1.5 text-xs font-semibold text-ps-bg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('prediction.saving') : existingScorePrediction ? t('prediction.update') : t('prediction.save_score')}
            </button>
            {existingScorePrediction && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isSubmitting}
                className="rounded-lg border border-ps-border px-3 py-1.5 text-xs font-medium text-ps-text-sec transition-colors hover:border-ps-red hover:text-ps-red disabled:opacity-50"
              >
                {t('prediction.reset')}
              </button>
            )}
            {!existingScorePrediction && (
              <button
                type="button"
                onClick={() => {
                  setScore(emptyScore(sport));
                  setIsExpanded(false);
                }}
                disabled={isSubmitting}
                className="text-xs font-medium text-ps-text-ter hover:text-ps-text-sec"
              >
                {t('prediction.cancel')}
              </button>
            )}
          </div>
        </>
      ) : (
        /* Standard sports use unified ScoreInput with auto-commit */
        <>
          <ScoreInput
            key={resetKey}
            homeLabel={homeTeam}
            awayLabel={awayTeam}
            initialHome={existingScorePrediction?.prediction_data?.home != null ? String(existingScorePrediction.prediction_data.home) : undefined}
            initialAway={existingScorePrediction?.prediction_data?.away != null ? String(existingScorePrediction.prediction_data.away) : undefined}
            onCommit={handleScoreCommit}
            disabled={isSubmitting}
            variant="standard"
          />

          <div className="mt-3 flex items-center gap-2">
            {existingScorePrediction && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isSubmitting}
                className="text-micro font-medium text-ps-text-ter hover:text-ps-red transition-colors"
              >
                {t('prediction.reset')}
              </button>
            )}
            {!existingScorePrediction && (
              <button
                type="button"
                onClick={() => {
                  setResetKey((k) => k + 1);
                  setIsExpanded(false);
                }}
                disabled={isSubmitting}
                className="text-xs font-medium text-ps-text-ter hover:text-ps-text-sec"
              >
                {t('prediction.cancel')}
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-1.5 text-xs font-medium text-ps-red">{error}</p>
      )}
    </div>
  );
}

function formatScoreDisplay(
  data: Record<string, unknown>,
  sport: string
): string {
  if (sport === "gaa" || sport === "gaelic_football" || sport === "hurling") {
    const home = data.home as Record<string, number> | undefined;
    const away = data.away as Record<string, number> | undefined;
    if (home && away) {
      return `${home.goals}-${home.points} v ${away.goals}-${away.points}`;
    }
  }
  if (data.home !== undefined && data.away !== undefined) {
    return `${data.home} - ${data.away}`;
  }
  return JSON.stringify(data);
}
