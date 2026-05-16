"use client";

import { useState } from "react";
import type { Event } from "@/types/database";
import { getScoreFormat, gaaAggregate } from "@/lib/score-format";

interface ResultPanelProps {
  event: Event;
  competitionId: string;
  onConfirmed: () => void;
}

function parseTeamsFromEventName(name: string) {
  const match = name.match(/^(.+?)\s+v\.?s?\.?\s+(.+)$/i);
  return match ? { home: match[1].trim(), away: match[2].trim() } : { home: "", away: "" };
}

/**
 * Shows the result for an event and allows:
 * - Confirming a provisional (API-fetched) result
 * - Entering a manual result (pre-populated from event name)
 * - Undoing a confirmed result (resets all prediction scores)
 */
export function ResultPanel({ event, onConfirmed }: ResultPanelProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUnconfirming, setIsUnconfirming] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manual result entry state — pre-populated from event name
  const parsedTeams = parseTeamsFromEventName(event.event_name);
  const [manualWinner, setManualWinner] = useState("");
  const [manualHomeTeam, setManualHomeTeam] = useState(parsedTeams.home);
  const [manualAwayTeam, setManualAwayTeam] = useState(parsedTeams.away);
  const [manualHomeScore, setManualHomeScore] = useState("");
  const [manualAwayScore, setManualAwayScore] = useState("");

  // GAA-specific score fields
  const scoreFormat = getScoreFormat(event.sport);
  const [gaaHomeGoals, setGaaHomeGoals] = useState("");
  const [gaaHomePoints, setGaaHomePoints] = useState("");
  const [gaaAwayGoals, setGaaAwayGoals] = useState("");
  const [gaaAwayPoints, setGaaAwayPoints] = useState("");

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

  const handleUnconfirm = async () => {
    if (!confirm("Undo result? This will reset all prediction scores for this event.")) return;
    setIsUnconfirming(true);
    try {
      const res = await fetch("/api/admin/unconfirm-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to undo result");
        return;
      }
      onConfirmed();
    } catch {
      alert("Network error");
    } finally {
      setIsUnconfirming(false);
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

    // GAA: goals & points entry
    if (scoreFormat === "gaa" && manualHomeTeam && manualAwayTeam) {
      const hg = parseInt(gaaHomeGoals) || 0;
      const hp = parseInt(gaaHomePoints) || 0;
      const ag = parseInt(gaaAwayGoals) || 0;
      const ap = parseInt(gaaAwayPoints) || 0;
      const homeTotal = gaaAggregate(hg, hp);
      const awayTotal = gaaAggregate(ag, ap);

      manualResult.score = {
        home_team: manualHomeTeam.trim(),
        away_team: manualAwayTeam.trim(),
        home_score: homeTotal,
        away_score: awayTotal,
        home: { goals: hg, points: hp },
        away: { goals: ag, points: ap },
        periods: null,
      };
      manualResult.winner =
        homeTotal > awayTotal
          ? manualHomeTeam.trim()
          : awayTotal > homeTotal
            ? manualAwayTeam.trim()
            : "draw";
      manualResult.margin = Math.abs(homeTotal - awayTotal);
      manualResult.stats = {
        home_goals: hg,
        home_points: hp,
        away_goals: ag,
        away_points: ap,
        total_goals: hg + ag,
        total_points: homeTotal + awayTotal,
      };
    } else if (manualHomeTeam && manualAwayTeam) {
      // Standard team sport
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
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-medium text-ps-green">Result Confirmed</h5>
          <button
            onClick={handleUnconfirm}
            disabled={isUnconfirming}
            className="rounded-xl border border-ps-border-strong px-2.5 py-1 text-xs font-medium text-ps-text-sec transition-colors hover:border-ps-red hover:text-ps-red disabled:opacity-50"
          >
            {isUnconfirming ? "Undoing..." : "Undo Result"}
          </button>
        </div>
        {hasResult && (
          <pre className="rounded-xl bg-ps-bg p-3 text-xs text-ps-text overflow-x-auto">
            {JSON.stringify(resultData, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // Score preview
  const homeScoreNum = parseInt(manualHomeScore);
  const awayScoreNum = parseInt(manualAwayScore);
  const showPreview =
    manualHomeTeam &&
    manualAwayTeam &&
    (manualHomeScore !== "" || manualAwayScore !== "");
  const previewWinner =
    !isNaN(homeScoreNum) && !isNaN(awayScoreNum)
      ? homeScoreNum > awayScoreNum
        ? manualHomeTeam
        : awayScoreNum > homeScoreNum
          ? manualAwayTeam
          : "Draw"
      : null;

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
      {hasResult && (() => {
        const provider = (resultData?.provider ?? resultData?.source ?? "manual") as string;
        const isAuto = provider !== "manual";
        const resultDisplay = resultData?.winner
          ? String(resultData.winner)
          : resultData?.score
            ? `${(resultData.score as Record<string, unknown>)?.home_team ?? ""} ${(resultData.score as Record<string, unknown>)?.home_score ?? ""}-${(resultData.score as Record<string, unknown>)?.away_score ?? ""} ${(resultData.score as Record<string, unknown>)?.away_team ?? ""}`
            : JSON.stringify(resultData).slice(0, 60);

        return (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {isAuto && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-ps-green-soft px-2 py-0.5 text-ps-green"
                  style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" as const }}
                >
                  <span className="inline-block h-[5px] w-[5px] rounded-full bg-ps-green" />
                  Auto &middot; {provider}
                </span>
              )}
            </div>
            <div
              className="rounded-[8px] px-2.5 py-2 text-[12.5px] font-bold"
              style={{ background: "rgba(40,30,20,0.04)" }}
            >
              Result &middot; <span className="text-ps-amber-deep">{resultDisplay}</span>
            </div>

            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => handleConfirm()}
                disabled={isConfirming}
                className="flex-1 rounded-[10px] px-4 py-2.5 text-[12.5px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, var(--ps-green), #059669)" }}
              >
                {isConfirming ? "Confirming..." : "\u2713 Confirm & score"}
              </button>
              <button
                type="button"
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="rounded-[10px] border border-ps-border-strong bg-transparent px-3.5 py-2.5 text-xs font-bold text-ps-text"
              >
                Edit
              </button>
            </div>
          </div>
        );
      })()}

      {/* Manual entry */}
      <div>
        {!hasResult && (
          <button
            type="button"
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="text-sm text-ps-amber-deep hover:text-ps-text underline hover:no-underline"
          >
            {showManualEntry ? "Hide manual entry" : "Enter result manually"}
          </button>
        )}

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

              {scoreFormat === "gaa" ? (
                <>
                  <div className="col-span-2 grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-ps-text-sec">
                        Home G
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={gaaHomeGoals}
                        onChange={(e) => setGaaHomeGoals(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ps-text-sec">
                        Home P
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={gaaHomePoints}
                        onChange={(e) => setGaaHomePoints(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ps-text-sec">
                        Away G
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={gaaAwayGoals}
                        onChange={(e) => setGaaAwayGoals(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ps-text-sec">
                        Away P
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={gaaAwayPoints}
                        onChange={(e) => setGaaAwayPoints(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-ps-border bg-ps-bg px-2 py-1 text-sm text-ps-text"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* Score preview */}
            {scoreFormat === "gaa" && manualHomeTeam && manualAwayTeam && (gaaHomeGoals || gaaHomePoints || gaaAwayGoals || gaaAwayPoints) && (() => {
              const hg = parseInt(gaaHomeGoals) || 0;
              const hp = parseInt(gaaHomePoints) || 0;
              const ag = parseInt(gaaAwayGoals) || 0;
              const ap = parseInt(gaaAwayPoints) || 0;
              const ht = gaaAggregate(hg, hp);
              const at = gaaAggregate(ag, ap);
              const winner = ht > at ? manualHomeTeam : at > ht ? manualAwayTeam : "Draw";
              return (
                <div className="mt-3 rounded-xl bg-ps-bg px-3 py-2 text-xs text-ps-text-sec">
                  <span className="font-bold font-mono text-ps-text">
                    {manualHomeTeam} {hg}-{hp} ({ht}) &mdash; {ag}-{ap} ({at}) {manualAwayTeam}
                  </span>
                  {" "}&rarr; <span className="font-semibold text-ps-amber-deep">{winner}</span>
                </div>
              );
            })()}
            {scoreFormat !== "gaa" && showPreview && previewWinner && (
              <div className="mt-3 rounded-xl bg-ps-bg px-3 py-2 text-xs text-ps-text-sec">
                <span className="font-bold text-ps-text">
                  {manualHomeTeam} {manualHomeScore || 0} &mdash; {manualAwayScore || 0} {manualAwayTeam}
                </span>
                {" "}&rarr; <span className="font-semibold text-ps-amber-deep">{previewWinner}</span>
              </div>
            )}

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
