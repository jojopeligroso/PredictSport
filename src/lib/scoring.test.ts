import { describe, it, expect } from "vitest";
import { scorePrediction, buildScoreDerivedWinnerOverrides } from "./scoring";

/**
 * Regression tests for the positional derivation fix.
 *
 * Root cause: ESPN returned "United States" as result.winner but prediction
 * options used "USA". String comparison failed silently, scoring all correct
 * winner predictions as wrong. Positional derivation uses score numbers +
 * options array order instead of matching provider team names.
 */
describe("scoreWinner — positional derivation", () => {
  const ept = { points: 2, partial_points: 0, config: { options: ["USA", "Draw", "Australia"] } };

  it("scores correctly via score position even when result.winner name mismatches", () => {
    // ESPN says "United States" but options say "USA" — positional derivation should resolve
    const result = scorePrediction(
      "winner",
      { value: "USA" },
      { winner: "United States", score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0 } },
      ept
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(2);
  });

  it("scores wrong prediction as wrong even with name mismatch", () => {
    const result = scorePrediction(
      "winner",
      { value: "Australia" },
      { winner: "United States", score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0 } },
      ept
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("handles draw result correctly with positional derivation", () => {
    const result = scorePrediction(
      "winner",
      { value: "Draw" },
      { winner: "draw", score: { home_team: "United States", away_team: "Australia", home_score: 1, away_score: 1 } },
      ept
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(2);
  });

  it("away team wins — positional derivation picks last option", () => {
    const result = scorePrediction(
      "winner",
      { value: "Australia" },
      { winner: "Australia", score: { home_team: "United States", away_team: "Australia", home_score: 0, away_score: 3 } },
      ept
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(2);
  });

  it("falls back to result.winner when no score is available", () => {
    const noScoreEpt = { points: 10, partial_points: 0, config: { options: ["TeamA", "Draw", "TeamB"] } };
    const result = scorePrediction(
      "winner",
      { value: "TeamA" },
      { winner: "TeamA" },
      noScoreEpt
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(10);
  });

  it("knockout tie: uses result.winner mapped through team names", () => {
    const koEpt = { points: 5, partial_points: 0, config: { options: ["Brazil", "Argentina"] } };
    // Score is tied (penalties), result.winner = "Argentina"
    const result = scorePrediction(
      "winner",
      { value: "Argentina" },
      { winner: "Argentina", score: { home_team: "Brazil", away_team: "Argentina", home_score: 1, away_score: 1 } },
      koEpt
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(5);
  });
});

describe("scoreExactScore", () => {
  const ept = { points: 3, partial_points: 0, config: null };

  it("exact match scores correctly (numbers, not names)", () => {
    const result = scorePrediction(
      "exact_score",
      { home: 2, away: 0 },
      { score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0 } },
      ept
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(3);
  });

  it("wrong score scores as wrong", () => {
    const result = scorePrediction(
      "exact_score",
      { home: 2, away: 1 },
      { score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0 } },
      ept
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });
});

describe("scoreHeadToHead — positional derivation", () => {
  const ept = { points: 5, partial_points: 0, config: { options: ["USA", "Draw", "Australia"] } };

  it("uses score position instead of provider team name", () => {
    const result = scorePrediction(
      "head_to_head",
      { winner: "USA" },
      { score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0 } },
      ept
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(5);
  });
});

describe("scoreMargin — positional derivation", () => {
  const ept = { points: 10, partial_points: 5, config: { options: ["USA", "Draw", "Australia"] } };

  it("uses score position for team matching", () => {
    const result = scorePrediction(
      "margin",
      { team: "USA", range_low: 1, range_high: 2 },
      { score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0 } },
      ept
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(10);
  });

  it("wrong team prediction scores wrong even with positional derivation", () => {
    const result = scorePrediction(
      "margin",
      { team: "Australia", range_low: 1, range_high: 2 },
      { score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0 } },
      ept
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Knockout H2H — auto-derive scenarios (2026-06-29 fix)
// ══════════════════════════════════════════════════════════════════════════

describe("scoreHeadToHead — knockout H2H auto-derive scenarios", () => {
  const h2hEpt = { points: 1, partial_points: 0, config: { options: ["South Africa", "Canada"], allow_draw: false } };

  const koResult = (home: number, away: number, winner?: string) => ({
    score: { home_score: home, away_score: away, home_team: "South Africa", away_team: "Canada" },
    winner: winner ?? (home > away ? "South Africa" : away > home ? "Canada" : "draw"),
  });

  it("H2H matches winner when winner != Draw — correct advancing team", () => {
    // User picked Canada to win → H2H auto-derived to Canada
    const r = scorePrediction("head_to_head", { selection: "Canada" }, koResult(0, 1), h2hEpt);
    expect(r).toEqual({ is_correct: true, is_partial: false, points_awarded: 1 });
  });

  it("H2H matches winner when winner != Draw — wrong advancing team", () => {
    // User picked SA to win → H2H auto-derived to SA, but Canada actually won
    const r = scorePrediction("head_to_head", { selection: "South Africa" }, koResult(0, 1), h2hEpt);
    expect(r).toEqual({ is_correct: false, is_partial: false, points_awarded: 0 });
  });

  it("90-min draw + correct H2H = 1 point", () => {
    // Score 1-1, Canada wins on pens. User picked Draw as winner, Canada to advance.
    const r = scorePrediction("head_to_head", { selection: "Canada" }, koResult(1, 1, "Canada"), h2hEpt);
    expect(r).toEqual({ is_correct: true, is_partial: false, points_awarded: 1 });
  });

  it("90-min draw + wrong H2H = 0 points", () => {
    const r = scorePrediction("head_to_head", { selection: "South Africa" }, koResult(1, 1, "Canada"), h2hEpt);
    expect(r).toEqual({ is_correct: false, is_partial: false, points_awarded: 0 });
  });

  it("draw result with allow_draw=false → void", () => {
    const r = scorePrediction("head_to_head", { selection: "Canada" }, koResult(1, 1, "draw"), h2hEpt);
    expect(r).toEqual({ is_correct: null, is_partial: false, points_awarded: 0 });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Full knockout match: winner + exact_score + H2H combined
// ══════════════════════════════════════════════════════════════════════════

describe("knockout match — full 3-prediction scoring", () => {
  const winEpt = { points: 2, partial_points: 0, config: { options: ["South Africa", "Draw", "Canada"] } };
  const scoreEpt = { points: 3, partial_points: 0, config: null };
  const h2hEpt = { points: 1, partial_points: 0, config: { options: ["South Africa", "Canada"], allow_draw: false } };
  const result = {
    score: { home_score: 0, away_score: 1, home_team: "South Africa", away_team: "Canada" },
    winner: "Canada",
  };

  it("max 6 pts: correct winner + exact score + correct H2H", () => {
    const w = scorePrediction("winner", { value: "Canada" }, result, winEpt);
    const s = scorePrediction("exact_score", { home: 0, away: 1 }, result, scoreEpt);
    const h = scorePrediction("head_to_head", { selection: "Canada" }, result, h2hEpt);
    expect(w.points_awarded + s.points_awarded + h.points_awarded).toBe(6);
  });

  it("3 pts: correct winner + wrong score + auto-H2H", () => {
    const w = scorePrediction("winner", { value: "Canada" }, result, winEpt);
    const s = scorePrediction("exact_score", { home: 1, away: 2 }, result, scoreEpt);
    const h = scorePrediction("head_to_head", { selection: "Canada" }, result, h2hEpt);
    expect(w.points_awarded + s.points_awarded + h.points_awarded).toBe(3);
  });

  it("Draw scenario: max 6 pts with correct draw + score + H2H", () => {
    const drawResult = {
      score: { home_score: 1, away_score: 1, home_team: "South Africa", away_team: "Canada" },
      winner: "Canada",
    };
    const w = scorePrediction("winner", { value: "Draw" }, drawResult, winEpt);
    const s = scorePrediction("exact_score", { home: 1, away: 1 }, drawResult, scoreEpt);
    const h = scorePrediction("head_to_head", { selection: "Canada" }, drawResult, h2hEpt);
    expect(w.points_awarded).toBe(2);  // Draw correct (90-min score level)
    expect(s.points_awarded).toBe(3);  // Exact score correct
    expect(h.points_awarded).toBe(1);  // Canada advances correct
    expect(w.points_awarded + s.points_awarded + h.points_awarded).toBe(6);
  });

  it("0 pts: wrong winner + wrong score + wrong H2H", () => {
    const w = scorePrediction("winner", { value: "South Africa" }, result, winEpt);
    const s = scorePrediction("exact_score", { home: 2, away: 0 }, result, scoreEpt);
    const h = scorePrediction("head_to_head", { selection: "South Africa" }, result, h2hEpt);
    expect(w.points_awarded + s.points_awarded + h.points_awarded).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Group match: winner + exact_score (no H2H)
// ══════════════════════════════════════════════════════════════════════════

describe("group match — 2-prediction scoring", () => {
  const winEpt = { points: 2, partial_points: 0, config: { options: ["Mexico", "Draw", "South Africa"] } };
  const scoreEpt = { points: 3, partial_points: 0, config: null };
  const result = {
    score: { home_score: 2, away_score: 0, home_team: "Mexico", away_team: "South Africa" },
    winner: "Mexico",
  };

  it("max 5 pts: correct winner + exact score", () => {
    const w = scorePrediction("winner", { value: "Mexico" }, result, winEpt);
    const s = scorePrediction("exact_score", { home: 2, away: 0 }, result, scoreEpt);
    expect(w.points_awarded + s.points_awarded).toBe(5);
  });

  it("2 pts: correct winner + wrong score", () => {
    const w = scorePrediction("winner", { value: "Mexico" }, result, winEpt);
    const s = scorePrediction("exact_score", { home: 1, away: 0 }, result, scoreEpt);
    expect(w.points_awarded + s.points_awarded).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// buildScoreDerivedWinnerOverrides
// ══════════════════════════════════════════════════════════════════════════

describe("buildScoreDerivedWinnerOverrides", () => {
  const groupOptions = ["Mexico", "Draw", "South Africa"];
  const koOptions = ["South Africa", "Canada"];

  it("derives winner from score when both predictions exist", () => {
    const predictions = [
      { user_id: "u1", prediction_type: "winner", prediction_data: { value: "South Africa" } },
      { user_id: "u1", prediction_type: "exact_score", prediction_data: { home: 2, away: 0 } },
    ];
    const overrides = buildScoreDerivedWinnerOverrides(predictions, groupOptions, "soccer");
    expect(overrides.get("u1")).toEqual({ value: "Mexico" });
  });

  it("no score prediction → no override", () => {
    const predictions = [
      { user_id: "u1", prediction_type: "winner", prediction_data: { value: "Mexico" } },
    ];
    const overrides = buildScoreDerivedWinnerOverrides(predictions, groupOptions, "soccer");
    expect(overrides.size).toBe(0);
  });

  it("overrides with Draw when Draw is in options (group stage)", () => {
    const predictions = [
      { user_id: "u1", prediction_type: "exact_score", prediction_data: { home: 1, away: 1 } },
    ];
    const overrides = buildScoreDerivedWinnerOverrides(predictions, groupOptions, "soccer");
    expect(overrides.get("u1")).toEqual({ value: "Draw" });
  });

  it("does NOT override with Draw when Draw is NOT in options (knockout)", () => {
    const predictions = [
      { user_id: "u1", prediction_type: "exact_score", prediction_data: { home: 1, away: 1 } },
    ];
    const overrides = buildScoreDerivedWinnerOverrides(predictions, koOptions, "soccer");
    expect(overrides.size).toBe(0);
  });

  it("handles multiple users independently", () => {
    const predictions = [
      { user_id: "u1", prediction_type: "exact_score", prediction_data: { home: 0, away: 2 } },
      { user_id: "u2", prediction_type: "exact_score", prediction_data: { home: 3, away: 0 } },
    ];
    const overrides = buildScoreDerivedWinnerOverrides(predictions, groupOptions, "soccer");
    expect(overrides.get("u1")).toEqual({ value: "South Africa" });
    expect(overrides.get("u2")).toEqual({ value: "Mexico" });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// scoreOverUnder
// ══════════════════════════════════════════════════════════════════════════

describe("scoreOverUnder", () => {
  const ept = { points: 5, partial_points: 0, config: null };
  const result = { score: { home_score: 2, away_score: 1 } };

  it("over correct", () => {
    const r = scorePrediction("over_under", { selection: "over", line: 2.5 }, result, ept);
    expect(r).toEqual({ is_correct: true, is_partial: false, points_awarded: 5 });
  });

  it("under correct", () => {
    const r = scorePrediction("over_under", { selection: "under", line: 3.5 }, result, ept);
    expect(r).toEqual({ is_correct: true, is_partial: false, points_awarded: 5 });
  });

  it("exact line = push (void)", () => {
    const r = scorePrediction("over_under", { selection: "over", line: 3, stat: "total_goals" }, { stats: { total_goals: 3 } }, ept);
    expect(r).toEqual({ is_correct: null, is_partial: false, points_awarded: 0 });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// scoreProgression
// ══════════════════════════════════════════════════════════════════════════

describe("scoreProgression", () => {
  const ept = { points: 10, partial_points: 5, config: { stages: ["Group", "R16", "QF", "SF", "Final"] } };

  it("exact match → full points", () => {
    const r = scorePrediction("progression", { value: "QF" }, { value: "QF" }, ept);
    expect(r).toEqual({ is_correct: true, is_partial: false, points_awarded: 10 });
  });

  it("off by one → partial points", () => {
    const r = scorePrediction("progression", { value: "QF" }, { value: "SF" }, ept);
    expect(r).toEqual({ is_correct: false, is_partial: true, points_awarded: 5 });
  });

  it("off by two → 0 points", () => {
    const r = scorePrediction("progression", { value: "Group" }, { value: "QF" }, ept);
    expect(r).toEqual({ is_correct: false, is_partial: false, points_awarded: 0 });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Edge cases
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// AET exact_score — score against FT when periods.full_time is available
// ══════════════════════════════════════════════════════════════════════════

describe("scoreExactScore — AET matches", () => {
  const ept = { points: 3, partial_points: 0, config: null };

  // Belgium 3-2 Senegal AET (FT was 2-2, Belgium scored in ET)
  const aetResultWithFT = {
    score: {
      home_team: "Belgium", away_team: "Senegal",
      home_score: 3, away_score: 2,
      periods: {
        full_time: { home: 2, away: 2 },
        extra_time: { home: 3, away: 2 },
      },
    },
    winner: "Belgium",
  };

  // Same match but without FT breakdown (TheSportsDB only)
  const aetResultNoFT = {
    score: {
      home_team: "Belgium", away_team: "Senegal",
      home_score: 3, away_score: 2,
      periods: {
        extra_time: { home: 3, away: 2 },
      },
    },
    winner: "Belgium",
  };

  // Penalty match (FT was 1-1)
  const penResultWithFT = {
    score: {
      home_team: "Brazil", away_team: "Argentina",
      home_score: 1, away_score: 1,
      periods: {
        full_time: { home: 1, away: 1 },
        penalties: { home: 3, away: 4 },
      },
    },
    winner: "Argentina",
  };

  it("AET with FT breakdown: correct FT prediction scores 3 pts", () => {
    const r = scorePrediction("exact_score", { home: 2, away: 2 }, aetResultWithFT, ept);
    expect(r.is_correct).toBe(true);
    expect(r.points_awarded).toBe(3);
  });

  it("AET with FT breakdown: wrong FT prediction scores 0", () => {
    const r = scorePrediction("exact_score", { home: 1, away: 1 }, aetResultWithFT, ept);
    expect(r.is_correct).toBe(false);
    expect(r.points_awarded).toBe(0);
  });

  it("AET with FT breakdown: non-draw prediction scores 0", () => {
    const r = scorePrediction("exact_score", { home: 3, away: 2 }, aetResultWithFT, ept);
    // 3-2 is the AET aggregate, not FT — should be wrong
    expect(r.is_correct).toBe(false);
    expect(r.points_awarded).toBe(0);
  });

  it("AET without FT breakdown: draw prediction is voided (null)", () => {
    const r = scorePrediction("exact_score", { home: 2, away: 2 }, aetResultNoFT, ept);
    expect(r.is_correct).toBeNull();
    expect(r.points_awarded).toBe(0);
  });

  it("AET without FT breakdown: non-draw prediction is wrong", () => {
    const r = scorePrediction("exact_score", { home: 3, away: 1 }, aetResultNoFT, ept);
    expect(r.is_correct).toBe(false);
    expect(r.points_awarded).toBe(0);
  });

  it("Penalties with FT: correct FT prediction scores 3 pts", () => {
    const r = scorePrediction("exact_score", { home: 1, away: 1 }, penResultWithFT, ept);
    expect(r.is_correct).toBe(true);
    expect(r.points_awarded).toBe(3);
  });

  it("Penalties with FT: wrong prediction scores 0", () => {
    const r = scorePrediction("exact_score", { home: 0, away: 0 }, penResultWithFT, ept);
    expect(r.is_correct).toBe(false);
    expect(r.points_awarded).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// AET winner scoring — Draw is correct for 1X2 when match went to ET
// ══════════════════════════════════════════════════════════════════════════

describe("scoreWinner — AET matches", () => {
  const ept = { points: 2, partial_points: 0, config: { options: ["Belgium", "Draw", "Senegal"] } };

  const aetResult = {
    score: {
      home_team: "Belgium", away_team: "Senegal",
      home_score: 3, away_score: 2,
      periods: { extra_time: { home: 3, away: 2 } },
    },
    winner: "Belgium",
  };

  it("Draw prediction is correct (FT was a draw)", () => {
    const r = scorePrediction("winner", { value: "Draw" }, aetResult, ept);
    expect(r.is_correct).toBe(true);
    expect(r.points_awarded).toBe(2);
  });

  it("Belgium prediction is wrong (FT was a draw, not a Belgium win)", () => {
    const r = scorePrediction("winner", { value: "Belgium" }, aetResult, ept);
    expect(r.is_correct).toBe(false);
    expect(r.points_awarded).toBe(0);
  });
});

describe("edge cases", () => {
  it("unknown prediction type → void", () => {
    const r = scorePrediction("unknown_type" as never, {}, {}, { points: 10, partial_points: 0, config: null });
    expect(r).toEqual({ is_correct: null, is_partial: false, points_awarded: 0 });
  });
});
