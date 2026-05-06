import type { PredictionType, EventPredictionType } from "@/types/database";

interface ScoringResult {
  is_correct: boolean | null;
  is_partial: boolean;
  points_awarded: number;
}

/**
 * Score a single prediction against result data.
 *
 * Points and partial_points come from the EventPredictionType row,
 * not from competition-level scoring_rules.
 */
export function scorePrediction(
  predictionType: PredictionType,
  predictionData: Record<string, unknown>,
  resultData: Record<string, unknown>,
  ept: Pick<EventPredictionType, "points" | "partial_points" | "config">
): ScoringResult {
  const fullPoints = ept.points;
  const partialPoints = ept.partial_points;

  switch (predictionType) {
    case "winner":
      return scoreWinner(predictionData, resultData, fullPoints);

    case "yes_no":
      return scoreYesNo(predictionData, resultData, fullPoints, ept.config);

    case "top_n":
      return scoreTopN(predictionData, resultData, fullPoints, partialPoints, ept.config);

    case "head_to_head":
      return scoreHeadToHead(predictionData, resultData, fullPoints);

    case "margin":
      return scoreMargin(predictionData, resultData, fullPoints, partialPoints);

    case "over_under":
      return scoreOverUnder(predictionData, resultData, fullPoints);

    case "handicap":
      return scoreHandicap(predictionData, resultData, fullPoints);

    case "progression":
      return scoreProgression(predictionData, resultData, fullPoints, partialPoints, ept.config);

    default:
      return { is_correct: null, is_partial: false, points_awarded: 0 };
  }
}

// ---------------------------------------------------------------------------
// Legacy adapter: converts old competition-level scoring_rules into the
// shape expected by the new scorer. Used only by callers that haven't been
// migrated yet.
// ---------------------------------------------------------------------------

interface LegacyScoringRules {
  points?: Record<string, number>;
  partial_credit?: boolean;
  partial_points?: Record<string, number>;
  [key: string]: unknown;
}

const DEFAULT_POINTS: Record<PredictionType, number> = {
  winner: 10, top_n: 5, head_to_head: 5, margin: 10,
  over_under: 5, handicap: 5, yes_no: 10, progression: 10,
};

const DEFAULT_PARTIAL_POINTS: Record<string, number> = {
  margin: 5, top_n: 3,
};

export function scorePredictionLegacy(
  predictionType: PredictionType,
  predictionData: Record<string, unknown>,
  resultData: Record<string, unknown>,
  scoringRules: LegacyScoringRules
): ScoringResult {
  const allowPartial = scoringRules.partial_credit !== false;
  const points =
    scoringRules.points?.[predictionType] ?? DEFAULT_POINTS[predictionType];
  const partial = allowPartial
    ? (scoringRules.partial_points?.[predictionType] ?? DEFAULT_PARTIAL_POINTS[predictionType] ?? 0)
    : 0;

  return scorePrediction(predictionType, predictionData, resultData, {
    points,
    partial_points: partial,
    config: null,
  });
}

// ---------------------------------------------------------------------------
// Scorers
// ---------------------------------------------------------------------------

function scoreWinner(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number
): ScoringResult {
  // Accept both { winner: "X" } and { value: "X" } shapes
  const predicted = normalizeStr(prediction.winner ?? prediction.value);

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

function scoreYesNo(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number,
  config: Record<string, unknown> | null
): ScoringResult {
  // prediction_data: { selection: "Yes" } or { value: "Ireland" }
  const predicted = normalizeStr(prediction.selection ?? prediction.value);

  // result_data: { answer: "Yes" } or { winner: "Ireland" }
  const actual = normalizeStr(result.answer ?? result.winner ?? result.value);

  if (!predicted || !actual) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // Also check against config options for fuzzy matching
  const options = (config?.options as string[] | undefined) ?? [];
  const predictedIndex = options.findIndex((o) => normalizeStr(o) === predicted);
  const actualIndex = options.findIndex((o) => normalizeStr(o) === actual);

  const correct =
    predicted === actual || (predictedIndex !== -1 && predictedIndex === actualIndex);

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
  partialPoints: number,
  config: Record<string, unknown> | null
): ScoringResult {
  const predictedName = normalizeStr(prediction.name ?? prediction.value);
  const n = Number(config?.n ?? prediction.n ?? 5);
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

  if (!topN.includes(predictedName)) {
    return { is_correct: false, is_partial: false, points_awarded: 0 };
  }

  // Find the actual finishing position of the predicted name
  const actualPos = positions.find(
    (p) => normalizeStr(p.name) === predictedName
  );

  // Per-position points ladder: look up exact points for this finishing position
  const ladder = config?.points_ladder as
    | Array<{ position: number; points: number }>
    | undefined;

  if (ladder && ladder.length > 0 && actualPos) {
    // Exact position match first
    const exactMatch = ladder.find((t) => t.position === actualPos.position);
    if (exactMatch) {
      return {
        is_correct: actualPos.position === 1,
        is_partial: actualPos.position !== 1,
        points_awarded: exactMatch.points,
      };
    }
    // Fallback: nearest tier at or above the position
    const tier = [...ladder]
      .sort((a, b) => a.position - b.position)
      .find((t) => actualPos.position <= t.position);
    if (tier) {
      return {
        is_correct: actualPos.position === 1,
        is_partial: actualPos.position !== 1,
        points_awarded: tier.points,
      };
    }
  }

  // No ladder — simple full/partial scoring
  const isWinner = actualPos?.position === 1;
  if (isWinner) {
    return { is_correct: true, is_partial: false, points_awarded: fullPoints };
  }

  if (partialPoints > 0) {
    return {
      is_correct: false,
      is_partial: true,
      points_awarded: partialPoints,
    };
  }

  // In top N, no partial configured — full points
  return { is_correct: true, is_partial: false, points_awarded: fullPoints };
}

function scoreHeadToHead(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number
): ScoringResult {
  const predicted = normalizeStr(prediction.winner ?? prediction.selection);

  let actual: string;
  if (result.winner) {
    actual = normalizeStr(result.winner);
  } else if (result.positions) {
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

  if (predictedTeam !== actualWinner) {
    return { is_correct: false, is_partial: false, points_awarded: 0 };
  }

  if (actualMargin >= rangeLow && actualMargin <= rangeHigh) {
    return { is_correct: true, is_partial: false, points_awarded: fullPoints };
  }

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
  const line = Number(prediction.line ?? prediction.threshold ?? 0);
  const stat = String(prediction.stat ?? "total_goals");

  let actualValue: number;

  if (result.stats && (result.stats as Record<string, number>)[stat] !== undefined) {
    actualValue = (result.stats as Record<string, number>)[stat];
  } else if (result.score) {
    const score = result.score as Record<string, unknown>;
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

  let adjustedDiff: number;
  if (selectedTeam === homeTeam) {
    adjustedDiff = homeScore + line - awayScore;
  } else if (selectedTeam === awayTeam) {
    adjustedDiff = awayScore + line - homeScore;
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  const correct = adjustedDiff > 0;
  return {
    is_correct: correct,
    is_partial: false,
    points_awarded: correct ? fullPoints : 0,
  };
}

function scoreProgression(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number,
  partialPoints: number,
  config: Record<string, unknown> | null
): ScoringResult {
  const predictedStage = normalizeStr(prediction.stage ?? prediction.value);
  const actualStage = normalizeStr(result.stage ?? result.value);
  const stages = ((config?.stages ?? []) as string[]).map(normalizeStr);

  if (!predictedStage || !actualStage || stages.length === 0) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  const predictedIndex = stages.indexOf(predictedStage);
  const actualIndex = stages.indexOf(actualStage);

  if (predictedIndex === -1 || actualIndex === -1) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // Exact match = full points
  if (predictedIndex === actualIndex) {
    return { is_correct: true, is_partial: false, points_awarded: fullPoints };
  }

  // Off by one stage = partial credit (if configured)
  if (partialPoints > 0 && Math.abs(predictedIndex - actualIndex) === 1) {
    return {
      is_correct: false,
      is_partial: true,
      points_awarded: partialPoints,
    };
  }

  return { is_correct: false, is_partial: false, points_awarded: 0 };
}

function normalizeStr(val: unknown): string {
  return String(val ?? "")
    .trim()
    .toLowerCase();
}
