import { describe, it, expect } from "vitest";
import { scorePrediction } from "./scoring";

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
