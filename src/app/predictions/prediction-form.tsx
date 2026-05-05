"use client";

import { useState } from "react";
import type { PredictionType, Prediction } from "@/types/database";

interface PredictionTypeConfig {
  type: PredictionType;
  label?: string;
  options?: string[];
  line?: number;
  threshold?: number;
  n?: number;
  handicap?: number;
  team?: string;
  stages?: string[];
}

interface PredictionFormProps {
  eventId: string;
  predictionTypeConfig: PredictionTypeConfig;
  existingPrediction: Prediction | null;
  isLocked: boolean;
  onSubmit: (data: {
    eventId: string;
    predictionType: PredictionType;
    predictionData: Record<string, unknown>;
  }) => Promise<void>;
}

function getLabel(config: PredictionTypeConfig): string {
  if (config.label) return config.label;
  const labels: Record<PredictionType, string> = {
    winner: "Pick the Winner",
    yes_no: "Yes or No",
    top_n: `Top ${config.n ?? "N"} Finish`,
    head_to_head: "Head to Head",
    margin: "Margin of Victory",
    over_under: `Over/Under ${config.threshold ?? ""}`,
    handicap: `Handicap ${config.handicap ?? ""}`,
    progression: "How Far Will They Go?",
  };
  return labels[config.type];
}

export function PredictionForm({
  eventId,
  predictionTypeConfig,
  existingPrediction,
  isLocked,
  onSubmit,
}: PredictionFormProps) {
  const existingData = existingPrediction?.prediction_data ?? {};

  const [value, setValue] = useState<string>(
    (existingData.value as string) ?? ""
  );
  const [selection, setSelection] = useState<string>(
    (existingData.selection as string) ??
    (existingData.stage as string) ?? ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const config = predictionTypeConfig;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    let predictionData: Record<string, unknown> = {};

    switch (config.type) {
      case "winner":
        if (!value.trim()) {
          setError("Enter your prediction");
          return;
        }
        predictionData = { value: value.trim() };
        break;

      case "yes_no":
        if (!selection) {
          setError("Make a selection");
          return;
        }
        predictionData = { selection };
        break;

      case "top_n":
        if (!value.trim()) {
          setError("Enter your prediction");
          return;
        }
        predictionData = { value: value.trim(), n: config.n };
        break;

      case "head_to_head":
        if (!selection) {
          setError("Make a selection");
          return;
        }
        predictionData = { selection };
        break;

      case "margin": {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
          setError("Enter a valid number");
          return;
        }
        predictionData = { value: numVal };
        break;
      }

      case "over_under":
        if (!selection) {
          setError("Select over or under");
          return;
        }
        predictionData = {
          selection,
          threshold: config.threshold,
        };
        break;

      case "handicap":
        if (!selection) {
          setError("Make a selection");
          return;
        }
        predictionData = {
          selection,
          handicap: config.handicap,
          team: config.team,
        };
        break;

      case "progression":
        if (!selection) {
          setError("Select a stage");
          return;
        }
        predictionData = { stage: selection };
        break;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        eventId,
        predictionType: config.type,
        predictionData,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClasses =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed";

  const buttonClasses =
    "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed";

  const selectionBtnClasses = (opt: string) =>
    `flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
      selection === opt
        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    }`;

  function renderInput() {
    switch (config.type) {
      case "winner":
        return (
          <input
            type="text"
            placeholder="e.g. Scheffler, Liverpool, Hamilton"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isLocked}
            className={inputClasses}
          />
        );

      case "yes_no":
        return (
          <div className="flex gap-2">
            {(config.options ?? ["Yes", "No"]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => !isLocked && setSelection(opt)}
                disabled={isLocked}
                className={selectionBtnClasses(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case "top_n":
        return (
          <input
            type="text"
            placeholder={`Who finishes in the top ${config.n ?? "N"}?`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isLocked}
            className={inputClasses}
          />
        );

      case "head_to_head":
        return (
          <div className="flex gap-2">
            {(config.options ?? []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => !isLocked && setSelection(opt)}
                disabled={isLocked}
                className={selectionBtnClasses(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case "margin":
        return (
          <input
            type="number"
            step="any"
            placeholder="Winning margin (e.g. 7)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isLocked}
            className={inputClasses}
          />
        );

      case "over_under":
        return (
          <div className="flex gap-2">
            {["over", "under"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => !isLocked && setSelection(opt)}
                disabled={isLocked}
                className={selectionBtnClasses(opt)}
              >
                <span className="capitalize">{opt}</span> {config.threshold}
              </button>
            ))}
          </div>
        );

      case "handicap":
        return (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => !isLocked && setSelection("covers")}
              disabled={isLocked}
              className={selectionBtnClasses("covers")}
            >
              {config.team ?? "Team"} covers {config.handicap}
            </button>
            <button
              type="button"
              onClick={() => !isLocked && setSelection("fails")}
              disabled={isLocked}
              className={selectionBtnClasses("fails")}
            >
              Does not cover
            </button>
          </div>
        );

      case "progression":
        return (
          <div className="flex flex-wrap gap-2">
            {(config.stages ?? []).map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => !isLocked && setSelection(stage)}
                disabled={isLocked}
                className={selectionBtnClasses(stage)}
              >
                {stage}
              </button>
            ))}
          </div>
        );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2">
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {getLabel(config)}
      </label>
      {renderInput()}
      {!isLocked && (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting || isLocked}
            className={buttonClasses}
          >
            {isSubmitting
              ? "Saving..."
              : existingPrediction
                ? "Update"
                : "Submit"}
          </button>
          {success && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Saved
            </span>
          )}
          {error && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
        </div>
      )}
      {isLocked && existingPrediction && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Your prediction:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {formatPredictionDisplay(existingPrediction.prediction_data)}
          </span>
        </p>
      )}
      {isLocked && !existingPrediction && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
          No prediction submitted
        </p>
      )}
    </form>
  );
}

function formatPredictionDisplay(data: Record<string, unknown>): string {
  if (data.stage !== undefined) return String(data.stage);
  if (data.value !== undefined) return String(data.value);
  if (data.selection !== undefined) return String(data.selection);
  return JSON.stringify(data);
}
