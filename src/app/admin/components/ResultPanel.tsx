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
        <h5 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
          Result Confirmed
        </h5>
        {hasResult && (
          <pre className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 overflow-x-auto">
            {JSON.stringify(resultData, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {successMessage}
        </div>
      )}

      {/* Show fetched result data */}
      {hasResult && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Provisional Result (from API)
          </h5>
          <pre className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 overflow-x-auto max-h-48">
            {JSON.stringify(resultData, null, 2)}
          </pre>

          <button
            onClick={() => handleConfirm()}
            disabled={isConfirming}
            className="mt-3 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
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
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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
            className="mt-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              Enter either a winner name (for individual sports) or a score (for team sports).
            </p>

            {/* Winner (for individual sports) */}
            <div className="mb-3">
              <label
                htmlFor="manual-winner"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Winner
              </label>
              <input
                id="manual-winner"
                type="text"
                value={manualWinner}
                onChange={(e) => setManualWinner(e.target.value)}
                placeholder="e.g. Rory McIlroy"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                  OR enter score
                </span>
              </div>
            </div>

            {/* Score (for team sports) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Home Team
                </label>
                <input
                  type="text"
                  value={manualHomeTeam}
                  onChange={(e) => setManualHomeTeam(e.target.value)}
                  placeholder="Home team name"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Away Team
                </label>
                <input
                  type="text"
                  value={manualAwayTeam}
                  onChange={(e) => setManualAwayTeam(e.target.value)}
                  placeholder="Away team name"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Home Score
                </label>
                <input
                  type="number"
                  min={0}
                  value={manualHomeScore}
                  onChange={(e) => setManualHomeScore(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Away Score
                </label>
                <input
                  type="number"
                  min={0}
                  value={manualAwayScore}
                  onChange={(e) => setManualAwayScore(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isConfirming ||
                (!manualWinner.trim() && (!manualHomeTeam.trim() || !manualAwayTeam.trim()))
              }
              className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {isConfirming ? "Confirming..." : "Confirm Manual Result"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
