import { describe, it, expect } from "vitest";
import { scorePrediction } from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Test fixtures — real provider shapes from docs/PROVIDER-SCORE-SHAPES.md
// ---------------------------------------------------------------------------

/** Normal FT result: Belgium 2-1 Senegal */
const FT_RESULT = {
  score: {
    home_team: "Belgium",
    away_team: "Senegal",
    home_score: 2,
    away_score: 1,
    periods: null,
  },
  winner: "Belgium",
  margin: 1,
  is_final: true,
};

/** AET result: Belgium 3-2 Senegal (FT was 2-2, ET winner scored 1 more) */
const AET_RESULT_WITH_FT = {
  score: {
    home_team: "Belgium",
    away_team: "Senegal",
    home_score: 3,
    away_score: 2,
    periods: {
      full_time: { home: 2, away: 2 },
      extra_time: { home: 1, away: 0 },
    },
  },
  winner: "Belgium",
  margin: 1,
  is_final: true,
};

/** AET result without enriched full_time (TheSportsDB raw — only has extra_time flag) */
const AET_RESULT_NO_FT = {
  score: {
    home_team: "Belgium",
    away_team: "Senegal",
    home_score: 3,
    away_score: 2,
    periods: {
      extra_time: { home: 1, away: 0 },
    },
  },
  winner: "Belgium",
  margin: 1,
  is_final: true,
};

/** PEN result: Australia 1-1 Egypt (pens 4-2), enriched with full_time */
const PEN_RESULT = {
  score: {
    home_team: "Australia",
    away_team: "Egypt",
    home_score: 1,
    away_score: 1,
    periods: {
      full_time: { home: 1, away: 1 },
      extra_time: { home: 0, away: 0 },
      penalties: { home: 4, away: 2 },
    },
  },
  winner: "Australia",
  margin: 0,
  is_final: true,
};

/** PEN result straight to pens after 90 min (no ET played) */
const PEN_NO_ET_RESULT = {
  score: {
    home_team: "Netherlands",
    away_team: "Morocco",
    home_score: 1,
    away_score: 1,
    periods: {
      penalties: { home: 5, away: 3 },
    },
  },
  winner: "Netherlands",
  margin: 0,
  is_final: true,
};

// ---------------------------------------------------------------------------
// EPT configs
// ---------------------------------------------------------------------------

const WINNER_EPT = { points: 10, partial_points: 0, config: null };

const WINNER_1X2_CONFIG = {
  points: 10,
  partial_points: 0,
  config: { options: ["Belgium", "Draw", "Senegal"] },
};

const WINNER_1X2_AUS_EGY = {
  points: 10,
  partial_points: 0,
  config: { options: ["Australia", "Draw", "Egypt"] },
};

const WINNER_KO_CONFIG = {
  points: 10,
  partial_points: 0,
  config: { options: ["Belgium", "Senegal"] },
};

const WINNER_KO_AUS_EGY = {
  points: 10,
  partial_points: 0,
  config: { options: ["Australia", "Egypt"] },
};

const EXACT_SCORE_EPT = { points: 15, partial_points: 0, config: null };

const H2H_KO_CONFIG = {
  points: 5,
  partial_points: 0,
  config: { options: ["Australia", "Egypt"] },
};

// ---------------------------------------------------------------------------
// scoreExactScore
// ---------------------------------------------------------------------------

describe("scoreExactScore", () => {
  it("scores correct FT prediction", () => {
    const result = scorePrediction(
      "exact_score",
      { home: 2, away: 1 },
      FT_RESULT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(15);
  });

  it("scores incorrect FT prediction", () => {
    const result = scorePrediction(
      "exact_score",
      { home: 1, away: 1 },
      FT_RESULT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("AET with enriched full_time: scores against 90-min score, not aggregate", () => {
    // FT was 2-2, aggregate is 3-2. Prediction of 2-2 should be CORRECT.
    const result = scorePrediction(
      "exact_score",
      { home: 2, away: 2 },
      AET_RESULT_WITH_FT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(15);
  });

  it("AET with enriched full_time: aggregate prediction is WRONG", () => {
    // Predicting 3-2 (the aggregate) should be wrong — FT was 2-2.
    const result = scorePrediction(
      "exact_score",
      { home: 3, away: 2 },
      AET_RESULT_WITH_FT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("AET without full_time: derives FT by subtracting ET from aggregate", () => {
    // aggregate 3-2, extra_time 1-0 → FT = 2-2
    const result = scorePrediction(
      "exact_score",
      { home: 2, away: 2 },
      AET_RESULT_NO_FT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(15);
  });

  it("PEN: scores against FT score (1-1), not aggregate", () => {
    const result = scorePrediction(
      "exact_score",
      { home: 1, away: 1 },
      PEN_RESULT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(15);
  });

  it("PEN straight to pens (no ET): home_score/away_score IS the FT score", () => {
    // 1-1 after 90 min, straight to pens (no extra_time period)
    const result = scorePrediction(
      "exact_score",
      { home: 1, away: 1 },
      PEN_NO_ET_RESULT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(15);
  });

  it("PEN straight to pens: wrong prediction", () => {
    const result = scorePrediction(
      "exact_score",
      { home: 2, away: 1 },
      PEN_NO_ET_RESULT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("returns null for missing prediction data", () => {
    const result = scorePrediction(
      "exact_score",
      {},
      FT_RESULT,
      EXACT_SCORE_EPT,
    );
    expect(result.is_correct).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// scoreWinner
// ---------------------------------------------------------------------------

describe("scoreWinner", () => {
  it("scores correct winner (1X2 with options)", () => {
    const result = scorePrediction(
      "winner",
      { value: "Belgium" },
      FT_RESULT,
      WINNER_1X2_CONFIG,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(10);
  });

  it("scores wrong winner", () => {
    const result = scorePrediction(
      "winner",
      { value: "Senegal" },
      FT_RESULT,
      WINNER_1X2_CONFIG,
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("AET (1X2): FT was a draw, so winner prediction = draw is correct", () => {
    // AET means FT was definitionally a draw. For 1X2 (3+ options),
    // the actual is forced to "draw".
    const result = scorePrediction(
      "winner",
      { value: "Draw" },
      AET_RESULT_WITH_FT,
      WINNER_1X2_CONFIG,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(10);
  });

  it("AET (1X2): picking the AET winner is WRONG (FT was draw)", () => {
    const result = scorePrediction(
      "winner",
      { value: "Belgium" },
      AET_RESULT_WITH_FT,
      WINNER_1X2_CONFIG,
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("AET (KO 2-option): AET override does NOT apply, winner is correct", () => {
    // Knockout H2H-style winner with only 2 options — no "Draw" option.
    // AET override only fires for 3+ options. Picking the winner should be correct.
    const result = scorePrediction(
      "winner",
      { value: "Belgium" },
      AET_RESULT_WITH_FT,
      WINNER_KO_CONFIG,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(10);
  });

  it("PEN (1X2): FT was a draw, so draw prediction is correct", () => {
    const result = scorePrediction(
      "winner",
      { value: "Draw" },
      PEN_RESULT,
      WINNER_1X2_AUS_EGY,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(10);
  });

  it("PEN (KO 2-option): penalty winner is correct", () => {
    // Australia won on pens. With 2 options (no Draw), the result uses
    // result.winner to map to the correct option.
    const result = scorePrediction(
      "winner",
      { value: "Australia" },
      PEN_RESULT,
      WINNER_KO_AUS_EGY,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(10);
  });

  it("PEN (KO 2-option): picking the loser is wrong", () => {
    const result = scorePrediction(
      "winner",
      { value: "Egypt" },
      PEN_RESULT,
      WINNER_KO_AUS_EGY,
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("handles { winner: X } shape (legacy)", () => {
    const result = scorePrediction(
      "winner",
      { winner: "Belgium" },
      FT_RESULT,
      WINNER_1X2_CONFIG,
    );
    expect(result.is_correct).toBe(true);
  });

  it("case-insensitive matching", () => {
    const result = scorePrediction(
      "winner",
      { value: "belgium" },
      FT_RESULT,
      WINNER_1X2_CONFIG,
    );
    expect(result.is_correct).toBe(true);
  });

  it("returns null when no result data", () => {
    const result = scorePrediction(
      "winner",
      { value: "Belgium" },
      {},
      WINNER_EPT,
    );
    expect(result.is_correct).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// scoreHeadToHead
// ---------------------------------------------------------------------------

describe("scoreHeadToHead", () => {
  it("scores correct H2H pick based on aggregate score", () => {
    // Belgium 3-2 Senegal (aggregate) — Belgium advances
    const result = scorePrediction(
      "head_to_head",
      { winner: "Belgium" },
      AET_RESULT_WITH_FT,
      { points: 5, partial_points: 0, config: { options: ["Belgium", "Senegal"] } },
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(5);
  });

  it("PEN: uses result.winner when scores level", () => {
    // 1-1 aggregate, Australia wins on pens
    const result = scorePrediction(
      "head_to_head",
      { winner: "Australia" },
      PEN_RESULT,
      H2H_KO_CONFIG,
    );
    expect(result.is_correct).toBe(true);
    expect(result.points_awarded).toBe(5);
  });

  it("PEN: picking the loser is wrong", () => {
    const result = scorePrediction(
      "head_to_head",
      { winner: "Egypt" },
      PEN_RESULT,
      H2H_KO_CONFIG,
    );
    expect(result.is_correct).toBe(false);
    expect(result.points_awarded).toBe(0);
  });

  it("H2H does NOT apply AET draw override (unlike winner 1X2)", () => {
    // Unlike scoreWinner, H2H asks "who goes through" — Belgium wins in AET
    const result = scorePrediction(
      "head_to_head",
      { winner: "Belgium" },
      AET_RESULT_WITH_FT,
      { points: 5, partial_points: 0, config: { options: ["Belgium", "Senegal"] } },
    );
    expect(result.is_correct).toBe(true);
  });
});
