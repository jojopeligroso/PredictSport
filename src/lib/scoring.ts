import type { PredictionType, EventPredictionType } from "@/types/database";
import { deriveWinnerFromScore } from "@/lib/score-format";

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
      return scoreWinner(predictionData, resultData, fullPoints, ept.config);

    case "yes_no":
      return scoreYesNo(predictionData, resultData, fullPoints, ept.config);

    case "top_n":
      return scoreTopN(predictionData, resultData, fullPoints, partialPoints, ept.config);

    case "final_standings":
      return scoreFinalStandings(predictionData, resultData, ept.config);

    case "head_to_head":
      return scoreHeadToHead(predictionData, resultData, fullPoints, ept.config);

    case "margin":
      return scoreMargin(predictionData, resultData, fullPoints, partialPoints, ept.config);

    case "over_under":
      return scoreOverUnder(predictionData, resultData, fullPoints);

    case "handicap":
      return scoreHandicap(predictionData, resultData, fullPoints);

    case "progression":
      return scoreProgression(predictionData, resultData, fullPoints, partialPoints, ept.config);

    case "exact_score":
      return scoreExactScore(predictionData, resultData, fullPoints);

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
  winner: 10, top_n: 5, final_standings: 10, head_to_head: 5, margin: 10,
  over_under: 5, handicap: 5, yes_no: 10, progression: 10, exact_score: 15,
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
// Score-derived winner overrides
// ---------------------------------------------------------------------------

/**
 * Build a map of user_id → corrected winner prediction data for users who
 * have both a winner and exact_score prediction. The score is the single
 * source of truth for the winner whenever both exist.
 *
 * Knockout guard: does NOT override with "Draw" unless "Draw" is a valid
 * winner option (group-stage matches). In knockout matches where the score
 * is a draw, the user's explicit winner pick (penalties winner) is preserved.
 */
export function buildScoreDerivedWinnerOverrides(
  predictions: Array<{
    user_id: string;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
  }>,
  winnerOptions: string[],
  sport: string,
): Map<string, Record<string, unknown>> {
  const scoreByUser = new Map<string, Record<string, unknown>>();
  for (const p of predictions) {
    if (p.prediction_type === "exact_score") {
      scoreByUser.set(p.user_id, p.prediction_data);
    }
  }

  const overrides = new Map<string, Record<string, unknown>>();
  for (const [userId, scoreData] of scoreByUser) {
    const implied = deriveWinnerFromScore(scoreData, sport, winnerOptions);
    const shouldOverride =
      implied !== null &&
      (implied !== "Draw" || winnerOptions.includes("Draw"));
    if (shouldOverride) {
      overrides.set(userId, { value: implied });
    }
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// Scorers
// ---------------------------------------------------------------------------

function scoreWinner(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number,
  config: Record<string, unknown> | null
): ScoringResult {
  // Accept both { winner: "X" } and { value: "X" } shapes
  const predicted = normalizeStr(prediction.winner ?? prediction.value);
  // Draws are valid whenever the EPT either explicitly opts in via allow_draw
  // OR offers "Draw" as a selectable option. The admin path sets options but
  // doesn't always set allow_draw; without this fallback, draw results void.
  const options = Array.isArray(config?.options) ? (config.options as unknown[]) : [];
  const optionsHaveDraw = options.some((o) => normalizeStr(o) === "draw");
  const allowDraw = config?.allow_draw === true || optionsHaveDraw;

  let actual: string;

  // When score + config options are available, use positional derivation.
  // This avoids provider name mismatches (e.g., ESPN "United States" vs
  // option "USA"). Options are seeded as [home, "Draw", away], matching
  // the score's home/away order — so index 0 = home win, last = away win.
  const score = result.score as Record<string, unknown> | undefined;
  if (score && options.length >= 2) {
    const homeScore = Number(score.home_score ?? 0);
    const awayScore = Number(score.away_score ?? 0);

    // AET override: when periods.extra_time exists, the stored score is the
    // AET aggregate (includes ET goals). FT was definitionally a draw — score
    // the winner (1X2) prediction against that. H2H (2 options) is unaffected
    // because it asks "who goes through", not "who wins in 90 minutes".
    const scorePeriods = score.periods as Record<string, Record<string, number>> | undefined;
    if (scorePeriods?.extra_time && options.length >= 3) {
      actual = "draw";
    } else if (homeScore > awayScore) {
      actual = normalizeStr(options[0]);
    } else if (awayScore > homeScore) {
      actual = normalizeStr(options[options.length - 1]);
    } else if (options.length >= 3) {
      actual = "draw";
    } else if (result.winner) {
      // Knockout tie (penalties): winner can't be derived from score.
      // Map result.winner to the correct option via home/away team name.
      const winnerNorm = normalizeStr(result.winner);
      if (winnerNorm === normalizeStr(score.home_team)) {
        actual = normalizeStr(options[0]);
      } else if (winnerNorm === normalizeStr(score.away_team)) {
        actual = normalizeStr(options[options.length - 1]);
      } else {
        actual = winnerNorm;
      }
    } else {
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }
  } else if (result.winner) {
    actual = normalizeStr(result.winner);
  } else if (score) {
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

  // Cross-check: when positional derivation was used AND result.winner exists,
  // verify they agree. A mismatch suggests a home/away swap or data error.
  if (score && options.length >= 2 && result.winner && actual !== "draw") {
    const providerWinner = normalizeStr(result.winner);
    // Map provider's winner through team names to an option
    let providerMapped: string | null = null;
    if (providerWinner === normalizeStr(score.home_team)) {
      providerMapped = normalizeStr(options[0]);
    } else if (providerWinner === normalizeStr(score.away_team)) {
      providerMapped = normalizeStr(options[options.length - 1]);
    }
    if (providerMapped && providerMapped !== actual) {
      console.warn(
        `[scoring] CROSS-CHECK MISMATCH: positional="${actual}" vs provider="${providerMapped}" ` +
        `(result.winner="${result.winner}", home_team="${score.home_team}", away_team="${score.away_team}", ` +
        `score=${score.home_score}-${score.away_score}, options=${JSON.stringify(options)})`
      );
    }
  }

  // Draw result handling
  if (actual === "draw") {
    if (!allowDraw) {
      // Draws not enabled on this event — void the prediction
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }
    if (predicted === "draw") {
      return { is_correct: true, is_partial: false, points_awarded: fullPoints };
    }
    // Draw enabled but user picked a side
    return { is_correct: false, is_partial: false, points_awarded: 0 };
  }

  // User picked draw but result was not a draw
  if (predicted === "draw") {
    return { is_correct: false, is_partial: false, points_awarded: 0 };
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

  // In top N but not winner, no partial credit configured — no points
  return { is_correct: false, is_partial: false, points_awarded: 0 };
}

function scoreFinalStandings(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  config: Record<string, unknown> | null
): ScoringResult {
  const rankings = (prediction.rankings ?? []) as Array<{
    position: number;
    name: string;
  }>;
  const positions = (result.positions ?? []) as Array<{
    position: number;
    name: string;
  }>;

  if (rankings.length === 0 || positions.length === 0) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  const n = Number(config?.positions ?? rankings.length);
  const pointsPerCorrect = Number(config?.points_per_correct ?? 10);
  const pointsPerIncluded = Number(config?.points_per_included ?? 3);

  const topPositions = positions.filter((p) => p.position <= n);
  const topNames = topPositions.map((p) => normalizeStr(p.name));

  let totalPoints = 0;
  let correctCount = 0;

  for (const rank of rankings) {
    if (rank.position > n) continue;

    const predictedName = normalizeStr(rank.name);
    const actualAtPosition = topPositions.find((p) => p.position === rank.position);

    if (actualAtPosition && normalizeStr(actualAtPosition.name) === predictedName) {
      // Right person, right position
      totalPoints += pointsPerCorrect;
      correctCount++;
    } else if (topNames.includes(predictedName)) {
      // Right person, wrong position
      totalPoints += pointsPerIncluded;
    }
  }

  const allCorrect = correctCount === Math.min(n, rankings.length) && correctCount > 0;

  return {
    is_correct: allCorrect,
    is_partial: !allCorrect && totalPoints > 0,
    points_awarded: totalPoints,
  };
}

function scoreHeadToHead(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number,
  config: Record<string, unknown> | null
): ScoringResult {
  const predicted = normalizeStr(prediction.winner ?? prediction.selection);
  // Mirror scoreWinner: if "Draw" is in options, treat draws as scoreable
  // even when allow_draw isn't explicitly set on the EPT config.
  const options = Array.isArray(config?.options) ? (config.options as unknown[]) : [];
  const optionsHaveDraw = options.some((o) => normalizeStr(o) === "draw");
  const allowDraw = config?.allow_draw === true || optionsHaveDraw;
  const drawPoints = Number(config?.draw_points ?? fullPoints);

  let actual: string;

  // Positional derivation from score when config options are available.
  // Same principle as scoreWinner: options[0] = home, last = away.
  // H2H is "who advances" — when the 90-min score is a draw, fall through
  // to result.winner to determine who actually advanced (via ET/penalties).
  const h2hScore = result.score as Record<string, unknown> | undefined;
  if (h2hScore && options.length >= 2) {
    const homeScore = Number(h2hScore.home_score ?? 0);
    const awayScore = Number(h2hScore.away_score ?? 0);
    if (homeScore > awayScore) {
      actual = normalizeStr(options[0]);
    } else if (awayScore > homeScore) {
      actual = normalizeStr(options[options.length - 1]);
    } else if (result.winner && normalizeStr(result.winner) !== "draw") {
      // 90-min score is level — use result.winner for the advancing team
      const winnerNorm = normalizeStr(result.winner);
      if (winnerNorm === normalizeStr(h2hScore.home_team)) {
        actual = normalizeStr(options[0]);
      } else if (winnerNorm === normalizeStr(h2hScore.away_team)) {
        actual = normalizeStr(options[options.length - 1]);
      } else {
        actual = winnerNorm;
      }
    } else {
      actual = "draw";
    }
  } else if (result.winner) {
    actual = normalizeStr(result.winner);
  } else if (result.positions) {
    const positions = result.positions as Array<{
      position: number;
      name: string;
      dnf?: boolean;
    }>;
    const posOptions = (config?.options ?? []) as string[];
    const participant1 = normalizeStr(posOptions[0] ?? prediction.participant1);
    const participant2 = normalizeStr(posOptions[1] ?? prediction.participant2);

    const p1 = positions.find((p) => normalizeStr(p.name) === participant1);
    const p2 = positions.find((p) => normalizeStr(p.name) === participant2);

    // Both DNF = void
    if (p1?.dnf && p2?.dnf) {
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }

    if (!p1 || !p2) {
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }

    if (p1.position === p2.position) {
      actual = "draw";
    } else {
      actual = p1.position < p2.position ? participant1 : participant2;
    }
  } else if (h2hScore) {
    const homeScore = Number(h2hScore.home_score ?? 0);
    const awayScore = Number(h2hScore.away_score ?? 0);
    if (homeScore === awayScore) {
      actual = "draw";
    } else {
      actual = homeScore > awayScore
        ? normalizeStr(h2hScore.home_team)
        : normalizeStr(h2hScore.away_team);
    }
  } else {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // Handle draw result
  if (actual === "draw") {
    if (predicted === "draw" && allowDraw) {
      return { is_correct: true, is_partial: false, points_awarded: drawPoints };
    }
    // Draw not enabled: void the prediction (no one gains or loses)
    if (!allowDraw) {
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }
    // Draw enabled but user picked a side: wrong
    return { is_correct: false, is_partial: false, points_awarded: 0 };
  }

  // User picked draw but result wasn't a draw
  if (predicted === "draw") {
    return { is_correct: false, is_partial: false, points_awarded: 0 };
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
  partialPoints: number,
  config: Record<string, unknown> | null = null
): ScoringResult {
  const rangeLow = Number(prediction.range_low ?? 0);
  const rangeHigh = Number(prediction.range_high ?? 0);
  const predictedTeam = normalizeStr(prediction.team);
  const options = Array.isArray(config?.options) ? (config.options as unknown[]) : [];

  let actualMargin: number;
  let actualWinner: string;

  // Positional derivation from score when options are available
  if (result.score && options.length >= 2) {
    const score = result.score as Record<string, unknown>;
    const homeScore = Number(score.home_score ?? 0);
    const awayScore = Number(score.away_score ?? 0);
    actualMargin = Math.abs(homeScore - awayScore);
    actualWinner =
      homeScore > awayScore
        ? normalizeStr(options[0])
        : normalizeStr(options[options.length - 1]);
  } else if (result.margin !== undefined && result.margin !== null && result.winner) {
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

  // Exact line hit = push (void, no points)
  if (actualValue === line) {
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

function scoreExactScore(
  prediction: Record<string, unknown>,
  result: Record<string, unknown>,
  fullPoints: number
): ScoringResult {
  const predHome = prediction.home;
  const predAway = prediction.away;

  if (predHome === undefined || predAway === undefined) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // GAA: prediction = { home: { goals, points }, away: { goals, points } }
  // Result has stats with home_goals, home_points, away_goals, away_points
  if (typeof predHome === "object" && predHome !== null) {
    const ph = predHome as Record<string, unknown>;
    const pa = predAway as Record<string, unknown>;
    const stats = result.stats as Record<string, number> | undefined;

    let rHomeGoals: number, rHomePoints: number, rAwayGoals: number, rAwayPoints: number;

    if (stats && stats.home_goals !== undefined) {
      // Foireann / provider-sourced GAA result
      rHomeGoals = stats.home_goals;
      rHomePoints = stats.home_points;
      rAwayGoals = stats.away_goals;
      rAwayPoints = stats.away_points;
    } else if (result.score && typeof (result.score as Record<string, unknown>).home === "object") {
      // Manual entry with GAA shape in score.home/score.away
      const scoreObj = result.score as Record<string, unknown>;
      const rh = scoreObj.home as Record<string, number>;
      const ra = scoreObj.away as Record<string, number>;
      rHomeGoals = rh.goals;
      rHomePoints = rh.points;
      rAwayGoals = ra.goals;
      rAwayPoints = ra.points;
    } else {
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }

    const correct =
      Number(ph.goals) === rHomeGoals &&
      Number(ph.points) === rHomePoints &&
      Number(pa.goals) === rAwayGoals &&
      Number(pa.points) === rAwayPoints;

    return {
      is_correct: correct,
      is_partial: false,
      points_awarded: correct ? fullPoints : 0,
    };
  }

  // Standard sports: prediction = { home: number, away: number }
  // Result has score = { home_score, away_score, ... }
  const score = result.score as Record<string, unknown> | undefined;
  if (!score) {
    return { is_correct: null, is_partial: false, points_awarded: 0 };
  }

  // AET: stored score is the aggregate (includes ET goals), not the 90-min score.
  // FT was definitionally a draw. Non-draw predictions are wrong; draw predictions
  // are voided (we don't know the exact FT score from TheSportsDB).
  const scorePeriods = score.periods as Record<string, Record<string, number>> | undefined;
  if (scorePeriods?.extra_time) {
    const predIsDrawScore = Number(predHome) === Number(predAway);
    if (predIsDrawScore) {
      return { is_correct: null, is_partial: false, points_awarded: 0 };
    }
    return { is_correct: false, is_partial: false, points_awarded: 0 };
  }

  const resultHomeScore = Number(score.home_score ?? score.home ?? 0);
  const resultAwayScore = Number(score.away_score ?? score.away ?? 0);

  const correct =
    Number(predHome) === resultHomeScore &&
    Number(predAway) === resultAwayScore;

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
