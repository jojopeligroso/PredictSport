import type { PredictionType } from "@/types/database";

interface ScoringRules {
  preset?: string;
  points?: Record<string, number>;
  partial_credit?: boolean;
  partial_points?: Record<string, number>;
  [key: string]: unknown;
}

interface ScoringResult {
  is_correct: boolean | null;
  is_partial: boolean;
  points_awarded: number;
}

/**
 * Default points per prediction type if not specified in scoring_rules.
 */
const DEFAULT_POINTS: Record<PredictionType, number> = {
  winner: 10,
  top_n: 5,
  head_to_head: 5,
  margin: 10,
  over_under: 5,
  handicap: 5,
};

const DEFAULT_PARTIAL_POINTS: Record<string, number> = {
  margin: 5,
  top_n: 3,
};

function getPointsForType(
  scoringRules: ScoringRules,
  predictionType: PredictionType
): number {
  return (
    (scoringRules.points as Record<string, number> | undefined)?.[
      predictionType
    ] ?? DEFAULT_POINTS[predictionType]
  );
}

function getPartialPointsForType(
  scoringRules: ScoringRules,
  predictionType: PredictionType
): number {
  return (
    (scoringRules.partial_points as Record<string, number> | undefined)?.[
      predictionType
    ] ?? DEFAULT_PARTIAL_POINTS[predictionType] ?? 0
  );
}

/**
 * Score a single prediction against result data.
 *
 * prediction_data and result_data structures vary by prediction_type:
 *
 * winner:      prediction_data: { winner: "Team A" }
 *              result_data:     { winner: "Team A" } or { score: { home_team, away_team, home_score, away_score } }
 *
 * top_n:       prediction_data: { name: "Player X", n: 5 }
 *              result_data:     { positions: [{ position: 1, name: "..." }, ...] }
 *
 * head_to_head: prediction_data: { winner: "Driver A" }
 *               result_data:     { winner: "Driver A" } or { positions: [...] }
 *
 * margin:      prediction_data: { range_low: 1, range_high: 7, team: "Ireland" }
 *              result_data:     { margin: 5, winner: "Ireland" } or { score: {...} }
 *
 * over_under:  prediction_data: { selection: "over", line: 2.5, stat: "total_goals" }
 *              result_data:     { stats: { total_goals: 3 } } or { score: {...} }
 *
 * handicap:    prediction_data: { selection: "Team A", line: -12.5 }
 *              result_data:     { score: { home_team, away_team, home_score, away_score } }
 */
export function scorePrediction(
  predictionType: PredictionType,
  predictionData: Record<string, unknown>,
  resultData: Record<string, unknown>,
  scoringRules: ScoringRules
): ScoringResult {
  const fullPoints = getPointsForType(scoringRules, predictionType);
  const partialPoints = getPartialPointsForType(scoringRules, predictionType);
  const allowPartial = scoringRules.partial_credit !== false;

  switch (predictionType) {
    case "winner":
      return scoreWinner(predictionData, resultData, fullPoints);

    case "top_n":
      return scoreTopN(
        predictionData,
        resultData,
        fullPoints,
        allowPartial ? partialPoints : 0
      );

    case "head_to_head":
      return scoreHeadToHead(predictionData, resultData, fullPoints);

    case "margin":
      return scoreMargin(
        predictionData,
        resultData,
        fullPoints,
        allowPartial ? partialPoints : 0
      );

    case "over_under":
      return scoreOverUnder(predictionData, resultData, fullPoints);

    case "handicap":
      return scoreHandicap(predictionData, resultData, fullPoints);

    default:
      return { is_correct: null, is_partial: false, points_awarded: 0 };
  }
}

function scoreWinner(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number
): ScoringResult {
  const predicted = normalizeStr(prediction.winner);

  // Determine winner from result_data
  let actual: string;
  if (result.winner) {
    actual = normalizeStr(result.winner);
  } else if (result.score) {
    const score = result.score as Record<string, unknown>;
    const homeScore = Number(score.home_score ?? 0);
    const awayScore = Number(score.away_score ?? 0);
    if (homeScore > awayScore) {
      actual = normalizeStr(score.home_team);
    } else if (awayScore > homeScore) {
      actual = normalizeStr(score.away_team);
    } else {
      actual = "draw";
    }
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  const correct = predicted === actual;
  return {
    is_correct: correct,
    is_partial: false,
    points_awarded: correct ? fullPoints : 0,
  };
}

function scoreTopN(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number,
  partialPoints: number
): ScoringResult {
  const predictedName = normalizeStr(prediction.name);
  const n = Number(prediction.n ?? 5);
  const positions = (result.positions ?? []) as Array<{
    position: number;
    name: string;
  }>;

  if (positions.length === 0) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  const topN = positions
    .filter((p) => p.position <= n)
    .map((p) => normalizeStr(p.name));

  if (topN.includes(predictedName)) {
    // Check if they predicted the exact winner
    const winner = positions.find((p) => p.position === 1);
    if (winner && normalizeStr(winner.name) === predictedName) {
      return { is_correct: true, is_partial: false, points_awarded: fullPoints };
    }
    // In top N but not winner - partial credit if available
    if (partialPoints > 0) {
      return {
        is_correct: false,
        is_partial: true,
        points_awarded: partialPoints,
      };
    }
    return { is_correct: true, is_partial: false, points_awarded: fullPoints };
  }

  return { is_correct: false, is_partial: false, points_awarded: 0 };
}

function scoreHeadToHead(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number
): ScoringResult {
  const predicted = normalizeStr(prediction.winner);

  let actual: string;
  if (result.winner) {
    actual = normalizeStr(result.winner);
  } else if (result.positions) {
    // For position-based sports (F1, golf etc), compare positions
    const positions = result.positions as Array<{
      position: number;
      name: string;
    }>;
    const participant1 = normalizeStr(prediction.participant1);
    const participant2 = normalizeStr(prediction.participant2);

    const p1Pos = positions.find((p) => normalizeStr(p.name) === participant1);
    const p2Pos = positions.find((p) => normalizeStr(p.name) === participant2);

    if (!p1Pos || !p2Pos) {
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }

    actual =
      p1Pos.position < p2Pos.position ? participant1 : participant2;
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  const correct = predicted === actual;
  return {
    is_correct: correct,
    is_partial: false,
    points_awarded: correct ? fullPoints : 0,
  };
}

function scoreMargin(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number,
  partialPoints: number
): ScoringResult {
  const rangeLow = Number(prediction.range_low ?? 0);
  const rangeHigh = Number(prediction.range_high ?? 0);
  const predictedTeam = normalizeStr(prediction.team);

  let actualMargin: number;
  let actualWinner: string;

  if (result.margin !== undefined && result.margin !== null && result.winner) {
    actualMargin = Math.abs(Number(result.margin));
    actualWinner = normalizeStr(result.winner);
  } else if (result.score) {
    const score = result.score as Record<string, unknown>;
    const homeScore = Number(score.home_score ?? 0);
    const awayScore = Number(score.away_score ?? 0);
    actualMargin = Math.abs(homeScore - awayScore);
    actualWinner =
      homeScore > awayScore
        ? normalizeStr(score.home_team)
        : normalizeStr(score.away_team);
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // Wrong team predicted
  if (predictedTeam !== actualWinner) {
    return { is_correct: false, is_partial: false, points_awarded: 0 };
  }

  // Exact range match
  if (actualMargin >= rangeLow && actualMargin <= rangeHigh) {
    return { is_correct: true, is_partial: false, points_awarded: fullPoints };
  }

  // Adjacent range: margin is within 1 of the predicted range bounds
  if (
    partialPoints > 0 &&
    (actualMargin === rangeLow - 1 || actualMargin === rangeHigh + 1)
  ) {
    return {
      is_correct: false,
      is_partial: true,
      points_awarded: partialPoints,
    };
  }

  return { is_correct: false, is_partial: false, points_awarded: 0 };
}

function scoreOverUnder(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number
): ScoringResult {
  const selection = String(prediction.selection ?? "").toLowerCase();
  const line = Number(prediction.line ?? 0);
  const stat = String(prediction.stat ?? "total_goals");

  let actualValue: number;

  if (result.stats && (result.stats as Record<string, number>)[stat] !== undefined) {
    actualValue = (result.stats as Record<string, number>)[stat];
  } else if (result.score) {
    const score = result.score as Record<string, unknown>;
    // Default: total_goals = home_score + away_score
    actualValue = Number(score.home_score ?? 0) + Number(score.away_score ?? 0);
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  let correct: boolean;
  if (selection === "over") {
    correct = actualValue > line;
  } else if (selection === "under") {
    correct = actualValue < line;
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // Push (exact line) = no points
  return {
    is_correct: correct,
    is_partial: false,
    points_awarded: correct ? fullPoints : 0,
  };
}

function scoreHandicap(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number
): ScoringResult {
  const selectedTeam = normalizeStr(prediction.selection);
  const line = Number(prediction.line ?? 0);

  if (!result.score) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  const score = result.score as Record<string, unknown>;
  const homeTeam = normalizeStr(score.home_team);
  const awayTeam = normalizeStr(score.away_team);
  const homeScore = Number(score.home_score ?? 0);
  const awayScore = Number(score.away_score ?? 0);

  // Handicap is applied to the selected team
  let adjustedDiff: number;
  if (selectedTeam === homeTeam) {
    adjustedDiff = homeScore + line - awayScore;
  } else if (selectedTeam === awayTeam) {
    adjustedDiff = awayScore + line - homeScore;
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // Covers if adjustedDiff > 0 (push at 0 = no points)
  const correct = adjustedDiff > 0;
  return {
    is_correct: correct,
    is_partial: false,
    points_awarded: correct ? fullPoints : 0,
  };
}

function normalizeStr(val: unknown): string {
  return String(val ?? "")
    .trim()
    .toLowerCase();
}
