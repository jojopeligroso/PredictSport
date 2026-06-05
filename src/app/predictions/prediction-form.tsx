"use client";

import { useState } from "react";
import type { PredictionType, Prediction } from "@/types/database";
import { ComboboxInput } from "@/components/ui/ComboboxInput";
import { getFormLabel } from "@/lib/prediction-labels";

const COMBOBOX_THRESHOLD = 5;

interface PredictionTypeConfig {
  type: PredictionType;
  label?: string;
  options?: string[];
  line?: number;
  threshold?: number;
  n?: number;
  positions?: number;
  handicap?: number;
  team?: string;
  stages?: string[];
  allow_draw?: boolean;
  draw_points?: number;
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
  // Build a config-shaped object the utility understands
  const cfgObj: Record<string, unknown> = {
    ...(config.label ? { display_label: config.label } : {}),
    ...(config.n != null ? { n: config.n } : {}),
    ...(config.positions != null ? { positions: config.positions } : {}),
    ...(config.threshold != null ? { line: config.threshold } : {}),
    ...(config.handicap != null ? { line: config.handicap } : {}),
  };
  return getFormLabel(config.type, cfgObj);
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
  const numPositions = predictionTypeConfig.positions ?? predictionTypeConfig.n ?? 5;
  const existingRankings = (existingData.rankings as Array<{ position: number; name: string }>) ?? [];
  const [rankings, setRankings] = useState<string[]>(() => {
    const arr = Array.from({ length: numPositions }, () => "");
    for (const r of existingRankings) {
      if (r.position >= 1 && r.position <= numPositions) {
        arr[r.position - 1] = r.name;
      }
    }
    return arr;
  });
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

      case "final_standings": {
        const filledRankings = rankings
          .map((name, i) => ({ position: i + 1, name: name.trim() }))
          .filter((r) => r.name !== "");
        if (filledRankings.length < numPositions) {
          setError(`Fill in all ${numPositions} positions`);
          return;
        }
        predictionData = { rankings: filledRankings };
        break;
      }

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
    "w-full rounded-md border border-ps-border-strong bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber disabled:opacity-50 disabled:cursor-not-allowed";

  const selectionBtnClasses = (opt: string) =>
    `flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-1 ${
      selection === opt
        ? "border-ps-amber bg-ps-amber-soft text-ps-text"
        : "border-ps-border bg-ps-surface text-ps-text-sec hover:border-ps-border-strong"
    }`;

  function renderInput() {
    switch (config.type) {
      case "winner": {
        const baseOpts = config.options ?? [];
        const winnerOpts = config.allow_draw ? [...baseOpts, "Draw"] : baseOpts;
        if (winnerOpts.length > 0) {
          if (winnerOpts.length > COMBOBOX_THRESHOLD) {
            return (
              <ComboboxInput
                options={winnerOpts}
                value={value}
                onChange={setValue}
                disabled={isLocked}
              />
            );
          }
          return (
            <div className="flex flex-wrap gap-2">
              {winnerOpts.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => !isLocked && setValue(opt)}
                  disabled={isLocked}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-1 ${
                    value === opt
                      ? "border-ps-amber bg-ps-amber-soft text-ps-text"
                      : "border-ps-border bg-ps-surface text-ps-text-sec hover:border-ps-border-strong"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          );
        }
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
      }

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

      case "top_n": {
        const topNOpts = config.options;
        if (topNOpts && topNOpts.length > 0) {
          if (topNOpts.length > COMBOBOX_THRESHOLD) {
            return (
              <ComboboxInput
                options={topNOpts}
                value={value}
                onChange={setValue}
                disabled={isLocked}
                placeholder={`Who finishes in the top ${config.n ?? "N"}?`}
              />
            );
          }
          return (
            <div className="flex flex-wrap gap-2">
              {topNOpts.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => !isLocked && setValue(opt)}
                  disabled={isLocked}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-1 ${
                    value === opt
                      ? "border-ps-amber bg-ps-amber-soft text-ps-text"
                      : "border-ps-border bg-ps-surface text-ps-text-sec hover:border-ps-border-strong"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          );
        }
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
      }

      case "final_standings": {
        const standingsOpts = config.options;
        if (standingsOpts && standingsOpts.length > 0) {
          // Tap-to-rank UI: tap competitors in order
          const isComplete = rankings.filter((n) => n !== "").length >= numPositions;
          return (
            <div>
              <p className="text-[11px] text-ps-text-ter mb-2">
                Tap in order: 1st, 2nd, 3rd...{" "}
                {!isLocked && rankings.some((n) => n !== "") && (
                  <button
                    type="button"
                    className="text-ps-amber-deep font-semibold underline"
                    onClick={() => setRankings(Array.from({ length: numPositions }, () => ""))}
                  >
                    Reset
                  </button>
                )}
              </p>
              <div className="flex flex-col gap-1.5">
                {standingsOpts.map((opt) => {
                  const assignedIdx = rankings.indexOf(opt);
                  const isAssigned = assignedIdx !== -1;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isLocked || (isComplete && !isAssigned)}
                      className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: isAssigned ? "var(--ps-amber)" : "var(--ps-border)",
                        background: isAssigned ? "var(--ps-amber-soft)" : "var(--ps-surface)",
                      }}
                      onClick={() => {
                        if (isLocked) return;
                        const updated = [...rankings];
                        if (isAssigned) {
                          // Remove and collapse
                          updated[assignedIdx] = "";
                          const filled = updated.filter((n) => n !== "");
                          const collapsed = Array.from({ length: numPositions }, (_, i) => filled[i] ?? "");
                          setRankings(collapsed);
                        } else if (!isComplete) {
                          // Add to next empty slot
                          const nextSlot = updated.indexOf("");
                          if (nextSlot !== -1) {
                            updated[nextSlot] = opt;
                            setRankings(updated);
                          }
                        }
                      }}
                    >
                      <span
                        className="flex items-center justify-center rounded-full font-bold text-[12px]"
                        style={{
                          width: 26,
                          height: 26,
                          background: isAssigned ? "var(--ps-amber)" : "var(--ps-chip)",
                          color: isAssigned ? "var(--ps-surface)" : "var(--ps-text-sec)",
                        }}
                      >
                        {isAssigned ? assignedIdx + 1 : ""}
                      </span>
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: isAssigned ? "var(--ps-text)" : "var(--ps-text-sec)" }}
                      >
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        // Fallback: text inputs per position
        return (
          <div className="space-y-1.5">
            {rankings.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-medium text-ps-text-ter w-8 text-right tabular-nums">
                  {i + 1}{i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"}
                </span>
                <input
                  type="text"
                  placeholder={`Position ${i + 1}`}
                  value={name}
                  onChange={(e) => {
                    const updated = [...rankings];
                    updated[i] = e.target.value;
                    setRankings(updated);
                  }}
                  disabled={isLocked}
                  className={inputClasses}
                />
              </div>
            ))}
          </div>
        );
      }

      case "head_to_head": {
        const h2hOptions = [...(config.options ?? [])];
        if (config.allow_draw) h2hOptions.push("Draw");
        return (
          <div className="flex gap-2">
            {h2hOptions.map((opt) => (
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
      }

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
      <label className="block text-xs font-medium text-ps-text-sec">
        {getLabel(config)}
      </label>
      {renderInput()}
      {!isLocked && (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting || isLocked}
            className="rounded-xl bg-ps-text px-4 py-2 text-sm font-semibold text-ps-bg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-1"
          >
            {isSubmitting
              ? "Saving..."
              : existingPrediction
                ? "Update"
                : "Submit"}
          </button>
          {success && (
            <span className="text-xs font-medium text-ps-green">
              Saved
            </span>
          )}
          {error && (
            <span className="text-xs font-medium text-ps-red">
              {error}
            </span>
          )}
        </div>
      )}
      {isLocked && existingPrediction && (
        <p className="text-xs text-ps-text-sec">
          Your prediction:{" "}
          <span className="font-medium text-ps-text">
            {formatPredictionDisplay(existingPrediction.prediction_data)}
          </span>
        </p>
      )}
      {isLocked && !existingPrediction && (
        <p className="text-xs text-ps-text-ter italic">
          You didn&apos;t call this one
        </p>
      )}
    </form>
  );
}

function formatPredictionDisplay(data: Record<string, unknown>): string {
  if (data.rankings) {
    const rankings = data.rankings as Array<{ position: number; name: string }>;
    return rankings
      .sort((a, b) => a.position - b.position)
      .map((r) => `${r.position}. ${r.name}`)
      .join(", ");
  }
  if (data.stage !== undefined) return String(data.stage);
  if (data.value !== undefined) return String(data.value);
  if (data.selection !== undefined) return String(data.selection);
  return JSON.stringify(data);
}
