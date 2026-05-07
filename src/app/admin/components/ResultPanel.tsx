"use client";

import { useState } from "react";
import type { Event } from "@/types/database";

interface ResultPanelProps {
  event: Event;
  competitionId: string;
  onConfirmed: () => void;
}

/**
 * Shows the result for an event and allows:
 * - Confirming a provisional (API-fetched) result
 * - Entering a manual result
 */
export function ResultPanel({ event, onConfirmed }: ResultPanelProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manual result entry state
  const [manualWinner, setManualWinner] = useState("");
  const [manualHomeTeam, setManualHomeTeam] = useState("");
  const [manualAwayTeam, setManualAwayTeam] = useState("");
  const [manualHomeScore, setManualHomeScore] = useState("");
  const [manualAwayScore, setManualAwayScore] = useState("");

  const resultData = event.result_data as Record<string, unknown> | null;
  const hasResult = resultData && Object.keys(resultData).length > 0;

  const handleConfirm = async (resultOverride?: Record<string, unknown>) => {
    setIsConfirming(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const body: Record<string, unknown> = { event_id: event.id };
      if (resultOverride) {
        body.result_data = resultOverride;
      }

      const res = await fetch("/api/admin/confirm-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to confirm result");
        return;
      }

      setSuccessMessage(
        `Result confirmed. ${data.predictions_scored} predictions scored.${
          data.scoring_errors > 0 ? ` (${data.scoring_errors} errors)` : ""
        }`
      );

      setTimeout(() => {
        onConfirmed();
      }, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const manualResult: Record<string, unknown> = {
      provider: "manual",
      fetched_at: new Date().toISOString(),
      sport: event.sport,
      external_event_id: event.external_event_id || null,
      event_name: event.event_name,
      is_final: true,
    };

    // Determine result shape based on what the admin entered
    if (manualHomeTeam && manualAwayTeam) {
      const homeScore = parseInt(manualHomeScore) || 0;
      const awayScore = parseInt(manualAwayScore) || 0;
      manualResult.score = {
        home_team: manualHomeTeam.trim(),
        away_team: manualAwayTeam.trim(),
        home_score: homeScore,
        away_score: awayScore,
        periods: null,
      };
      manualResult.winner =
        homeScore > awayScore
          ? manualHomeTeam.trim()
          : awayScore > homeScore
            ? manualAwayTeam.trim()
            : "draw";
      manualResult.margin = Math.abs(homeScore - awayScore);
      manualResult.stats = {
        total_goals: homeScore + awayScore,
        total_points: homeScore + awayScore,
      };
    } else if (manualWinner.trim()) {
      manualResult.winner = manualWinner.trim();
    }

    handleConfirm(manualResult);
  };

  if (event.result_confirmed) {
    return (
      <div>
        <h5 className="text-sm font-medium text-ps-green mb-2">
          Result Confirmed
        </h5>
        {hasResult && (
          <pre className="rounded-xl bg-ps-bg p-3 text-xs text-ps-text overflow-x-auto">
            {JSON.stringify(resultData, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-xl bg-ps-red-soft p-3 text-sm text-ps-red">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-3 rounded-xl bg-ps-green-soft p-3 text-sm text-ps-green">
          {successMessage}
        </div>
      )}

      {/* Show fetched result data */}
      {hasResult && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-ps-text-sec mb-2">
            Provisional Result (from API)
          </h5>
          <pre className="rounded-xl bg-ps-bg p-3 text-xs text-ps-text overflow-x-auto max-h-48">
            {JSON.stringify(resultData, null, 2)}
          </pre>

          <button
            onClick={() => handleConfirm()}
            disabled={isConfirming}
            className="mt-3 rounded-xl bg-ps-green px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isConfirming ? "Confirming..." : "Confirm Result"}
          </button>
        </div>
      )}

      {/* Manual entry */}
      <div>
        <button
          type="button"
          onClick={() => setShowManualEntry(!showManualEntry)}
          className="text-sm text-ps-amber-deep hover:text-ps-text underline hover:no-underline"
        >
          {showManualEntry
            ? "Hide manual entry"
            : hasResult
              ? "Override with manual result"
              : "Enter result manually"}
        </button>

        {showManualEntry && (
          <form
            onSubmit={handleManualSubmit}
            className="mt-3 rounded-xl border border-ps-border p-4"
          >
            <p className="text-xs text-ps-text-ter mb-3">
              Enter either a winner name (for individual sports) or a score (for team sports).
            </p>

            {/* Winner (for individual sports) */}
            <div className="mb-3">
              <label
                htmlFor="manual-winner"
                className="block text-sm font-medium text-ps-text-sec"
              >
                Winner
              </label>
              <input
                id="manual-winner"
                type="text"
                value={manualWinner}
                onChange={(e) => setManualWinner(e.target.value)}
                placeholder="e.g. Rory McIlroy"
                className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-3 py-1.5 text-sm text-ps-text"
              />
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ps-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-ps-surface px-2 text-ps-text-ter">
                  OR enter score
                </span>
              </div>
            </div>

            {/* Score (for team sports) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ps-text-sec">
                  Home Team
                </label>
                <input
                  type="text"
                  value={manualHomeTeam}
                  onChange={(e) => setManualHomeTeam(e.target.value)}
                  placeholder="Home team name"
                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ps-text-sec">
                  Away Team
                </label>
                <input
                  type="text"
                  value={manualAwayTeam}
                  onChange={(e) => setManualAwayTeam(e.target.value)}
                  placeholder="Away team name"
                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ps-text-sec">
                  Home Score
                </label>
                <input
                  type="number"
                  min={0}
                  value={manualHomeScore}
                  onChange={(e) => setManualHomeScore(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ps-text-sec">
                  Away Score
                </label>
                <input
                  type="number"
                  min={0}
                  value={manualAwayScore}
                  onChange={(e) => setManualAwayScore(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isConfirming ||
                (!manualWinner.trim() && (!manualHomeTeam.trim() || !manualAwayTeam.trim()))
              }
              className="mt-4 rounded-xl bg-ps-green px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isConfirming ? "Confirming..." : "Confirm Manual Result"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
