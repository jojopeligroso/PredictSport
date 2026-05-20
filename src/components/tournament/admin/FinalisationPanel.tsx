"use client";

import { useState } from "react";

// Usage:
// <FinalisationPanel windows={windows} stages={stages} />

interface PredictionWindow {
  id: string;
  name: string;
  status: string; // 'open' | 'locked' | 'scored'
  totalEvents: number;
  confirmedEvents: number;
}

interface SportingStage {
  id: string;
  name: string;
  status: string; // 'upcoming' | 'active' | 'finalised'
  totalWindows: number;
  scoredWindows: number;
}

interface FinalisationPanelProps {
  windows: PredictionWindow[];
  stages: SportingStage[];
}

type LoadingState = Record<string, boolean>;

interface FeedbackState {
  id: string;
  type: "success" | "error";
  message: string;
}

function WindowStatusBadge({ status }: { status: string }) {
  if (status === "scored") {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        Finalised
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
  return (
    <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StageStatusBadge({ status }: { status: string }) {
  if (status === "finalised") {
    return (
      <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
        Finalised
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="rounded-full bg-ps-blue/15 px-2 py-0.5 text-xs font-semibold text-ps-blue">
        Active
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ps-chip px-2 py-0.5 text-xs font-semibold text-ps-text-ter">
      Upcoming
    </span>
  );
}

function ProgressBar({
  value,
  total,
  complete,
}: {
  value: number;
  total: number;
  complete: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between">
        <span className="text-xs text-ps-text-ter">
          {value}/{total}
        </span>
        <span
          className={`font-mono text-xs font-semibold ${
            complete ? "text-ps-green" : "text-ps-amber"
          }`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ps-border">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            complete ? "bg-ps-green" : "bg-ps-amber"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function FinalisationPanel({ windows, stages }: FinalisationPanelProps) {
  const [loading, setLoading] = useState<LoadingState>({});
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  async function handleFinalise(type: "window" | "stage", id: string) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    setFeedback(null);

    try {
      const res = await fetch("/api/tournament/finalise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }

      setFeedback({
        id,
        type: "success",
        message:
          type === "window"
            ? "Prediction window finalised."
            : "Sporting stage finalised.",
      });
    } catch (err) {
      setFeedback({
        id,
        type: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  const globalFeedback =
    feedback && !loading[feedback.id] ? feedback : null;

  return (
    <div className="w-full max-w-[480px] space-y-6">
      {globalFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            globalFeedback.type === "success"
              ? "bg-ps-green/10 text-ps-green"
              : "bg-ps-red/10 text-ps-red"
          }`}
        >
          {globalFeedback.message}
        </div>
      )}

      {/* Prediction Windows */}
      <section aria-labelledby="windows-heading">
        <h2
          id="windows-heading"
          className="mb-3 text-xs font-bold uppercase tracking-wider text-ps-text-ter"
        >
          Prediction Windows
        </h2>

        {windows.length === 0 ? (
          <p className="py-4 text-center text-sm text-ps-text-sec">
            No prediction windows.
          </p>
        ) : (
          <div className="divide-y divide-ps-border rounded-xl border border-ps-border bg-ps-surface">
            {windows.map((w) => {
              const allConfirmed = w.confirmedEvents === w.totalEvents && w.totalEvents > 0;
              const canFinalise = allConfirmed && w.status === "locked";
              const isLoading = loading[w.id] ?? false;
              const isFinalised = w.status === "scored";

              return (
                <div key={w.id} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ps-text">{w.name}</p>
                    <WindowStatusBadge status={w.status} />
                  </div>

                  <ProgressBar
                    value={w.confirmedEvents}
                    total={w.totalEvents}
                    complete={allConfirmed}
                  />
                  <p className="mt-1 text-xs text-ps-text-ter">
                    {w.confirmedEvents}/{w.totalEvents} results confirmed
                  </p>

                  {!isFinalised && (
                    <button
                      onClick={() => handleFinalise("window", w.id)}
                      disabled={!canFinalise || isLoading}
                      aria-label={`Finalise prediction window ${w.name}`}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ps-amber px-3 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isLoading ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          />
                          Finalising...
                        </>
                      ) : (
                        "Finalise Window"
                      )}
                    </button>
                  )}

                  {!canFinalise && !isFinalised && (
                    <p className="mt-1.5 text-center text-xs text-ps-text-ter">
                      {w.status !== "locked"
                        ? "Window must be locked before finalising"
                        : "Confirm all results before finalising"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sporting Stages */}
      <section aria-labelledby="stages-heading">
        <h2
          id="stages-heading"
          className="mb-3 text-xs font-bold uppercase tracking-wider text-ps-text-ter"
        >
          Sporting Stages
        </h2>

        {stages.length === 0 ? (
          <p className="py-4 text-center text-sm text-ps-text-sec">
            No sporting stages.
          </p>
        ) : (
          <div className="divide-y divide-ps-border rounded-xl border border-ps-border bg-ps-surface">
            {stages.map((stage) => {
              const allScored =
                stage.scoredWindows === stage.totalWindows &&
                stage.totalWindows > 0;
              const canFinalise = allScored && stage.status === "active";
              const isLoading = loading[stage.id] ?? false;
              const isFinalised = stage.status === "finalised";

              return (
                <div key={stage.id} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ps-text">
                      {stage.name}
                    </p>
                    <StageStatusBadge status={stage.status} />
                  </div>

                  <ProgressBar
                    value={stage.scoredWindows}
                    total={stage.totalWindows}
                    complete={allScored}
                  />
                  <p className="mt-1 text-xs text-ps-text-ter">
                    {stage.scoredWindows}/{stage.totalWindows} windows scored
                  </p>

                  {!isFinalised && (
                    <button
                      onClick={() => handleFinalise("stage", stage.id)}
                      disabled={!canFinalise || isLoading}
                      aria-label={`Finalise sporting stage ${stage.name}`}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ps-amber px-3 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isLoading ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          />
                          Finalising...
                        </>
                      ) : (
                        "Finalise Stage"
                      )}
                    </button>
                  )}

                  {!canFinalise && !isFinalised && (
                    <p className="mt-1.5 text-center text-xs text-ps-text-ter">
                      {stage.status !== "active"
                        ? "Stage must be active before finalising"
                        : "Score all windows before finalising"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
