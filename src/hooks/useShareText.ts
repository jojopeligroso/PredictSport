/**
 * WhatsApp share data hooks — generate shareable text for predictions and results.
 *
 * DATA HOOKS ONLY — no UI. The UI for sharing (WhatsApp button, share sheet, etc.)
 * is intentionally deferred.
 *
 * Usage:
 *   const { predictionShareText, resultShareText } = useShareText({ ... });
 *   // Later: window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
 */

import { useMemo } from "react";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import { confidenceLabel } from "@/lib/reckons-copy";
import type { ResultRow } from "@/app/wc/home/fetchDashboardData";
import type { WcFixture } from "@/lib/wc/fixtures";
import type { Prediction } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PredictionShareInput {
  fixture: WcFixture;
  winnerPick: string | null;
  scorePick: { home: number; away: number } | null;
  confidence: number | null;
}

interface ShareTextOptions {
  /** App URL for the share link (defaults to window.location.origin). */
  appUrl?: string;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function teamTri(name: string): string {
  return fifaTrigram(name) ?? name.slice(0, 3).toUpperCase();
}

/**
 * Format a single prediction as a shareable line.
 * Example: "BRA 2-1 SUI (Confident)"
 */
function formatPredictionLine(input: PredictionShareInput): string {
  const { fixture, winnerPick, scorePick, confidence } = input;
  const homeTri = teamTri(fixture.home);
  const awayTri = teamTri(fixture.away);

  let line = `${homeTri} vs ${awayTri}: `;

  if (scorePick) {
    line += `${scorePick.home}-${scorePick.away}`;
  } else if (winnerPick) {
    line += winnerPick === "draw" ? "Draw" : winnerPick;
  } else {
    line += "No pick";
  }

  if (confidence != null) {
    line += ` (${confidenceLabel(confidence)})`;
  }

  return line;
}

/**
 * Format a single result as a shareable line.
 * Example: "BRA 2-1 SUI - You: 2-1 +13pts"
 */
function formatResultLine(result: ResultRow): string {
  const { fixture, homeScore, awayScore, userScorePick, userWinnerPick, winnerPoints, scorePoints, h2hPoints } = result;
  const homeTri = teamTri(fixture.home);
  const awayTri = teamTri(fixture.away);
  const totalPts = winnerPoints + scorePoints + h2hPoints;

  let line = `${homeTri} ${homeScore}-${awayScore} ${awayTri}`;

  if (userScorePick) {
    line += ` | You: ${userScorePick.home}-${userScorePick.away}`;
  } else if (userWinnerPick) {
    line += ` | You: ${userWinnerPick === "draw" ? "Draw" : userWinnerPick}`;
  }

  if (totalPts > 0) {
    line += ` +${totalPts}pts`;
  } else if (userWinnerPick) {
    line += ` +0`;
  }

  return line;
}

// ---------------------------------------------------------------------------
// Hook: generate shareable text for predictions (pre-match)
// ---------------------------------------------------------------------------

export function usePredictionShareText(
  fixtures: WcFixture[],
  predictions: Prediction[],
  fixtureByEventId: Map<string, WcFixture>,
  options?: ShareTextOptions,
): string | null {
  return useMemo(() => {
    if (fixtures.length === 0) return null;

    const lines: string[] = [];

    for (const fixture of fixtures) {
      // Find predictions for this fixture
      const eventId = [...fixtureByEventId.entries()]
        .find(([, f]) => f.externalId === fixture.externalId)?.[0];

      if (!eventId) continue;

      const eventPreds = predictions.filter((p) => p.event_id === eventId);
      const winnerPred = eventPreds.find((p) => p.prediction_type === "winner");
      const scorePred = eventPreds.find((p) => p.prediction_type === "exact_score");

      const winnerPick =
        (winnerPred?.prediction_data?.value as string) ??
        (winnerPred?.prediction_data?.selection as string) ??
        null;

      let scorePick: { home: number; away: number } | null = null;
      if (scorePred?.prediction_data) {
        const sd = scorePred.prediction_data;
        const h = Number(sd.home ?? sd.home_score);
        const a = Number(sd.away ?? sd.away_score);
        if (!isNaN(h) && !isNaN(a)) scorePick = { home: h, away: a };
      }

      lines.push(
        formatPredictionLine({
          fixture,
          winnerPick,
          scorePick,
          confidence: winnerPred?.confidence_level ?? null,
        }),
      );
    }

    if (lines.length === 0) return null;

    const appUrl = options?.appUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
    return `My WC predictions:\n${lines.join("\n")}\n\nsportspredict. ${appUrl}/wc`;
  }, [fixtures, predictions, fixtureByEventId, options?.appUrl]);
}

// ---------------------------------------------------------------------------
// Hook: generate shareable text for results (post-match)
// ---------------------------------------------------------------------------

export function useResultShareText(
  results: ResultRow[],
  options?: ShareTextOptions,
): string | null {
  return useMemo(() => {
    if (results.length === 0) return null;

    const predictedResults = results.filter((r) => r.userWinnerPick !== null);
    if (predictedResults.length === 0) return null;

    const lines = predictedResults.map(formatResultLine);
    const totalPoints = predictedResults.reduce(
      (sum, r) => sum + r.winnerPoints + r.scorePoints + r.h2hPoints,
      0,
    );
    const correct = predictedResults.filter((r) => r.winnerCorrect).length;

    const appUrl = options?.appUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
    return [
      `My results: ${correct}/${predictedResults.length} correct, ${totalPoints} pts`,
      ...lines,
      "",
      `sportspredict. ${appUrl}/wc`,
    ].join("\n");
  }, [results, options?.appUrl]);
}
