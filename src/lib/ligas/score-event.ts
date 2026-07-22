/**
 * System B event scoring — the bridge between stored predictions and the pure
 * System B scorer. Shared by both scoring paths (admin confirm-result and the
 * results cron's autoResolveEvent) so winter-league games score identically
 * however the result lands.
 *
 * A winter-league event is recognised by its winner EPT carrying
 * `config.scoring_system === "system_b"`. For those events the three prediction
 * rows (winner / margin / exact_score) must be scored JOINTLY — the winner
 * gates the game and a correct exact score doubles the whole total — so the
 * generic per-row scorer cannot be used. This module groups an event's
 * predictions by entrant and emits the batch-score rows directly.
 */

import {
  scoreSystemBGame,
  windowFromPredictionData,
  SYSTEM_B_MARKER,
  type SystemBResult,
  type MarginWindow,
} from "@/lib/ligas/system-b";

export interface ScoreRow {
  id: string;
  is_correct: boolean | null;
  is_partial: boolean;
  points_awarded: number;
}

interface StoredPrediction {
  id: string;
  user_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
}

/** True when an event's winner EPT config opts into System B scoring. */
export function isSystemBEvent(
  winnerConfig: Record<string, unknown> | null | undefined,
): boolean {
  return winnerConfig?.["scoring_system"] === SYSTEM_B_MARKER;
}

/**
 * Reduce a confirmed result blob to what System B needs. Tolerant of both the
 * `{ score: { home_score, away_score, home_team, away_team } }` shape used by
 * the generic pipeline and the flat `{ home, away }` shape used by winter
 * backfills. The after-9 margin prefers explicit regulation fields
 * (`home_score_reg` / `away_score_reg`) and falls back to the final margin.
 */
export function buildSystemBResult(
  resultData: Record<string, unknown>,
  winnerOpts: string[],
): SystemBResult {
  const score =
    (resultData["score"] as Record<string, unknown> | undefined) ?? resultData;

  const rawHome = score["home_score"] ?? score["home"];
  const rawAway = score["away_score"] ?? score["away"];
  const finalHome = Number(rawHome);
  const finalAway = Number(rawAway);

  const homeTeam = String(score["home_team"] ?? winnerOpts[0] ?? "");
  const awayTeam = String(
    score["away_team"] ?? winnerOpts[winnerOpts.length - 1] ?? "",
  );

  const regHome = Number(score["home_score_reg"] ?? rawHome);
  const regAway = Number(score["away_score_reg"] ?? rawAway);
  const afterNineMargin =
    Number.isFinite(regHome) && Number.isFinite(regAway)
      ? Math.abs(regHome - regAway)
      : 0;

  const status = String(
    resultData["status"] ?? resultData["result_type"] ?? "",
  ).toLowerCase();
  const noResult =
    resultData["is_no_result"] === true ||
    status === "no_result" ||
    status === "abandoned";

  let winner = "";
  if (Number.isFinite(finalHome) && Number.isFinite(finalAway)) {
    if (finalHome > finalAway) winner = homeTeam;
    else if (finalAway > finalHome) winner = awayTeam;
  }

  return {
    winner,
    afterNineMargin,
    finalHome: Number.isFinite(finalHome) ? finalHome : null,
    finalAway: Number.isFinite(finalAway) ? finalAway : null,
    homeTeam,
    awayTeam,
    noResult,
  };
}

/**
 * Score every prediction for a System B event, returning batch-score rows.
 * Predictions are grouped by entrant; each entrant's winner/margin/exact_score
 * rows are scored together via `scoreSystemBGame`, then mapped back to their
 * row ids. Rows the scorer doesn't recognise are settled to zero.
 */
export function scoreSystemBEvent(
  predictions: StoredPrediction[],
  resultData: Record<string, unknown>,
  winnerOpts: string[],
): ScoreRow[] {
  const result = buildSystemBResult(resultData, winnerOpts);

  interface Bucket {
    winnerId?: string;
    marginId?: string;
    exactId?: string;
    winner?: string | null;
    window?: MarginWindow | null;
    exact?: { home: number; away: number } | null;
  }
  const byUser = new Map<string, Bucket>();
  const get = (uid: string): Bucket => {
    let b = byUser.get(uid);
    if (!b) {
      b = {};
      byUser.set(uid, b);
    }
    return b;
  };

  const rows: ScoreRow[] = [];

  for (const p of predictions) {
    const b = get(p.user_id);
    switch (p.prediction_type) {
      case "winner":
        b.winnerId = p.id;
        b.winner =
          typeof p.prediction_data?.["value"] === "string"
            ? (p.prediction_data["value"] as string)
            : null;
        break;
      case "margin":
        b.marginId = p.id;
        b.window = windowFromPredictionData(p.prediction_data);
        break;
      case "exact_score": {
        b.exactId = p.id;
        const h = Number(p.prediction_data?.["home"]);
        const a = Number(p.prediction_data?.["away"]);
        b.exact =
          Number.isFinite(h) && Number.isFinite(a) ? { home: h, away: a } : null;
        break;
      }
      default:
        // Unknown row on a System B event — settle to zero so it isn't left stale.
        rows.push({ id: p.id, is_correct: false, is_partial: false, points_awarded: 0 });
    }
  }

  for (const b of byUser.values()) {
    const breakdown = scoreSystemBGame(
      { winner: b.winner, window: b.window, exact: b.exact },
      result,
    );
    if (b.winnerId) {
      rows.push({
        id: b.winnerId,
        is_correct: breakdown.winnerCorrect,
        is_partial: false,
        points_awarded: breakdown.winnerPoints,
      });
    }
    if (b.marginId) {
      rows.push({
        id: b.marginId,
        is_correct: breakdown.marginCorrect,
        is_partial: false,
        points_awarded: breakdown.marginPoints,
      });
    }
    if (b.exactId) {
      rows.push({
        id: b.exactId,
        is_correct: breakdown.exactCorrect,
        is_partial: false,
        points_awarded: breakdown.exactPoints,
      });
    }
  }

  return rows;
}
