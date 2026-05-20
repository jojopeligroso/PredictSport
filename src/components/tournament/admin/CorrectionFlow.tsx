"use client";

import { useState } from "react";

// Usage:
// <CorrectionFlow finalisations={finalisations} events={events} />

interface Finalisation {
  id: string;
  prediction_window_id: string | null;
  sporting_stage_id: string | null;
  finalisation_type: string;
  status: string;
  finalised_at: string | null;
}

interface CorrectionEvent {
  id: string;
  event_name: string;
  result_data: Record<string, unknown> | null;
  result_confirmed: boolean;
}

interface CorrectionFlowProps {
  finalisations: Finalisation[];
  events: CorrectionEvent[];
}

type Step = 1 | 2 | 3 | 4;

const TOTAL_STEPS = 4;
const CONFIRMATION_PHRASE = "CORRECT RESULT";

interface CorrectionPayload {
  finalisationId: string;
  eventId: string;
  correction: {
    home_score?: string;
    away_score?: string;
    winner?: string;
  };
  reason: string;
}

function formatFinalisedAt(iso: string | null): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current} of ${TOTAL_STEPS}`}>
      {([1, 2, 3, 4] as Step[]).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step === current
                ? "bg-ps-amber text-white"
                : step < current
                  ? "bg-ps-green text-white"
                  : "bg-ps-chip text-ps-text-ter"
            }`}
          >
            {step < current ? (
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              step
            )}
          </div>
          {step < TOTAL_STEPS && (
            <div
              className={`h-px w-6 ${
                step < current ? "bg-ps-green" : "bg-ps-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const STEP_LABELS: Record<Step, string> = {
  1: "Select window or stage",
  2: "Select fixture",
  3: "Enter correction",
  4: "Review and confirm",
};

export function CorrectionFlow({ finalisations, events }: CorrectionFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedFinalisationId, setSelectedFinalisationId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [winner, setWinner] = useState("");
  const [reason, setReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const finalisedFinalisations = finalisations.filter(
    (f) => f.status === "finalised" || f.status === "corrected"
  );

  const selectedFinalisation = finalisedFinalisations.find(
    (f) => f.id === selectedFinalisationId
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const confirmedPhraseMatches = confirmPhrase.trim() === CONFIRMATION_PHRASE;
  const reasonIsValid = reason.trim().length >= 10;

  function reset() {
    setStep(1);
    setSelectedFinalisationId("");
    setSelectedEventId("");
    setHomeScore("");
    setAwayScore("");
    setWinner("");
    setReason("");
    setConfirmPhrase("");
    setSubmitError(null);
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!confirmedPhraseMatches || !reasonIsValid) return;

    const payload: CorrectionPayload = {
      finalisationId: selectedFinalisationId,
      eventId: selectedEventId,
      correction: {
        ...(homeScore !== "" && { home_score: homeScore }),
        ...(awayScore !== "" && { away_score: awayScore }),
        ...(winner !== "" && { winner }),
      },
      reason: reason.trim(),
    };

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/tournament/correct-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-[480px]">
        <div className="rounded-xl border border-ps-border bg-ps-surface p-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ps-green/15">
            <svg
              aria-hidden="true"
              className="h-6 w-6 text-ps-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-ps-text">Correction submitted</h2>
          <p className="mt-1 text-sm text-ps-text-sec">
            Re-scoring will run in the background. Standings may take a moment to update.
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-ps-chip px-4 py-2 text-xs font-semibold text-ps-text transition-opacity hover:opacity-80"
          >
            Make another correction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px] space-y-4">
      {/* Warning banner */}
      <div
        role="alert"
        className="flex gap-2.5 rounded-lg border border-ps-red/30 bg-ps-red/8 px-3 py-3"
      >
        <svg
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-ps-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="text-xs text-ps-red">
          <strong>Emergency action.</strong> Corrections re-score all affected predictions and may
          change standings and eliminations.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-ps-border bg-ps-surface">
        {/* Step header */}
        <div className="border-b border-ps-border px-4 py-3">
          <StepIndicator current={step} />
          <p className="mt-2 text-xs text-ps-text-sec">{STEP_LABELS[step]}</p>
        </div>

        <div className="px-4 py-4">
          {/* ── Step 1: Select finalisation ── */}
          {step === 1 && (
            <div className="space-y-3">
              <label
                htmlFor="finalisation-select"
                className="block text-sm font-semibold text-ps-text"
              >
                Finalised window or stage
              </label>

              {finalisedFinalisations.length === 0 ? (
                <p className="rounded-lg bg-ps-chip px-3 py-2 text-sm text-ps-text-sec">
                  No finalised windows or stages found.
                </p>
              ) : (
                <select
                  id="finalisation-select"
                  value={selectedFinalisationId}
                  onChange={(e) => setSelectedFinalisationId(e.target.value)}
                  className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                >
                  <option value="">Select a finalisation...</option>
                  {finalisedFinalisations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.finalisation_type === "window"
                        ? `Window — ${f.prediction_window_id?.slice(0, 8) ?? f.id.slice(0, 8)}`
                        : `Stage — ${f.sporting_stage_id?.slice(0, 8) ?? f.id.slice(0, 8)}`}{" "}
                      (finalised {formatFinalisedAt(f.finalised_at)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Step 2: Select event ── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-lg bg-ps-chip px-3 py-2">
                <p className="text-xs text-ps-text-ter">Selected</p>
                <p className="text-sm font-semibold text-ps-text">
                  {selectedFinalisation?.finalisation_type === "window"
                    ? "Prediction Window"
                    : "Sporting Stage"}{" "}
                  — finalised {formatFinalisedAt(selectedFinalisation?.finalised_at ?? null)}
                </p>
              </div>

              <label
                htmlFor="event-select"
                className="block text-sm font-semibold text-ps-text"
              >
                Affected fixture
              </label>

              {events.length === 0 ? (
                <p className="rounded-lg bg-ps-chip px-3 py-2 text-sm text-ps-text-sec">
                  No confirmed events found.
                </p>
              ) : (
                <select
                  id="event-select"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                >
                  <option value="">Select a fixture...</option>
                  {events
                    .filter((e) => e.result_confirmed)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.event_name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          {/* ── Step 3: Enter correction ── */}
          {step === 3 && selectedEvent && (
            <div className="space-y-4">
              {/* Current result */}
              <div className="rounded-lg bg-ps-chip px-3 py-2">
                <p className="text-xs text-ps-text-ter">Current result</p>
                <p className="text-sm font-semibold text-ps-text">{selectedEvent.event_name}</p>
                {selectedEvent.result_data ? (
                  <p className="mt-0.5 font-mono text-sm text-ps-text-sec">
                    {Object.entries(selectedEvent.result_data)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" | ")}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-ps-text-ter">No result data on record</p>
                )}
              </div>

              {/* Score inputs */}
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ps-text">
                  Corrected scores
                </legend>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="home-score"
                      className="mb-1 block text-xs text-ps-text-sec"
                    >
                      Home score
                    </label>
                    <input
                      id="home-score"
                      type="text"
                      inputMode="numeric"
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      placeholder="e.g. 2"
                      className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 font-mono text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor="away-score"
                      className="mb-1 block text-xs text-ps-text-sec"
                    >
                      Away score
                    </label>
                    <input
                      id="away-score"
                      type="text"
                      inputMode="numeric"
                      value={awayScore}
                      onChange={(e) => setAwayScore(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 font-mono text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                    />
                  </div>
                </div>
              </fieldset>

              <div>
                <label
                  htmlFor="winner-input"
                  className="mb-1 block text-sm font-semibold text-ps-text"
                >
                  Winner (if applicable)
                </label>
                <input
                  id="winner-input"
                  type="text"
                  value={winner}
                  onChange={(e) => setWinner(e.target.value)}
                  placeholder="Team or participant name"
                  className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                />
              </div>

              <div>
                <label
                  htmlFor="reason-input"
                  className="mb-1 block text-sm font-semibold text-ps-text"
                >
                  Reason for correction{" "}
                  <span className="font-normal text-ps-red">*</span>
                </label>
                <textarea
                  id="reason-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why this result needs to be corrected..."
                  className="w-full resize-none rounded-lg border border-ps-border bg-ps-bg px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber"
                />
                {reason.trim().length > 0 && reason.trim().length < 10 && (
                  <p className="mt-1 text-xs text-ps-red">
                    Please provide at least 10 characters.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Review + confirm ── */}
          {step === 4 && selectedEvent && selectedFinalisation && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="space-y-2 rounded-lg border border-ps-border bg-ps-chip p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ps-text-ter">Fixture</span>
                  <span className="font-semibold text-ps-text">{selectedEvent.event_name}</span>
                </div>
                {homeScore && (
                  <div className="flex justify-between">
                    <span className="text-ps-text-ter">Home score</span>
                    <span className="font-mono font-semibold text-ps-text">{homeScore}</span>
                  </div>
                )}
                {awayScore && (
                  <div className="flex justify-between">
                    <span className="text-ps-text-ter">Away score</span>
                    <span className="font-mono font-semibold text-ps-text">{awayScore}</span>
                  </div>
                )}
                {winner && (
                  <div className="flex justify-between">
                    <span className="text-ps-text-ter">Winner</span>
                    <span className="font-semibold text-ps-text">{winner}</span>
                  </div>
                )}
                <div className="border-t border-ps-border pt-2">
                  <span className="text-ps-text-ter">Reason</span>
                  <p className="mt-0.5 text-ps-text-sec">{reason}</p>
                </div>
              </div>

              {/* Typed confirmation */}
              <div>
                <label
                  htmlFor="confirm-input"
                  className="mb-1 block text-sm font-semibold text-ps-text"
                >
                  Type{" "}
                  <code className="rounded bg-ps-red/10 px-1 py-0.5 font-mono text-xs text-ps-red">
                    {CONFIRMATION_PHRASE}
                  </code>{" "}
                  to confirm
                </label>
                <input
                  id="confirm-input"
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder={CONFIRMATION_PHRASE}
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="w-full rounded-lg border border-ps-border bg-ps-bg px-3 py-2 font-mono text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-red focus:outline-none focus:ring-1 focus:ring-ps-red"
                />
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-md bg-ps-red/10 px-2 py-1 text-xs text-ps-red"
                >
                  {submitError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation footer */}
        <div className="flex items-center justify-between border-t border-ps-border px-4 py-3">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            disabled={step === 1}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-ps-text-sec transition-opacity disabled:opacity-30 hover:text-ps-text"
          >
            Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1) as Step)}
              disabled={
                (step === 1 && !selectedFinalisationId) ||
                (step === 2 && !selectedEventId) ||
                (step === 3 && !reasonIsValid)
              }
              className="rounded-lg bg-ps-amber px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!confirmedPhraseMatches || submitting}
              className="flex items-center gap-1.5 rounded-lg bg-ps-red px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                  Submitting...
                </>
              ) : (
                "Submit Correction"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
