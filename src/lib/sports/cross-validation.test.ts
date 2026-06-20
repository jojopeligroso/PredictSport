import { describe, it, expect } from "vitest";
import { compareResults, type CompareVerdict } from "./fetch-result";

describe("compareResults — team sports (score-based)", () => {
  it("returns match when home_score and away_score are identical", () => {
    const primary = { score: { home_team: "USA", away_team: "Australia", home_score: 2, away_score: 0, periods: null } };
    const verifier = { score: { home_team: "United States", away_team: "Australia", home_score: 2, away_score: 0, periods: null } };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });

  it("returns mismatch when home_score differs", () => {
    const primary = { score: { home_team: "France", away_team: "Mexico", home_score: 2, away_score: 1, periods: null } };
    const verifier = { score: { home_team: "France", away_team: "Mexico", home_score: 3, away_score: 1, periods: null } };
    expect(compareResults(primary, verifier)).toBe("mismatch" satisfies CompareVerdict);
  });

  it("returns mismatch when away_score differs", () => {
    const primary = { score: { home_team: "France", away_team: "Mexico", home_score: 2, away_score: 1, periods: null } };
    const verifier = { score: { home_team: "France", away_team: "Mexico", home_score: 2, away_score: 0, periods: null } };
    expect(compareResults(primary, verifier)).toBe("mismatch" satisfies CompareVerdict);
  });

  it("matches even when team name strings differ (never compares names)", () => {
    const primary = { score: { home_team: "USA", away_team: "AUS", home_score: 1, away_score: 1, periods: null } };
    const verifier = { score: { home_team: "United States", away_team: "Australia", home_score: 1, away_score: 1, periods: null } };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });

  it("returns match for 0-0 draws", () => {
    const primary = { score: { home_team: "A", away_team: "B", home_score: 0, away_score: 0, periods: null } };
    const verifier = { score: { home_team: "A", away_team: "B", home_score: 0, away_score: 0, periods: null } };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });

  it("ignores periods — only compares final scores", () => {
    const primary = {
      score: {
        home_team: "A", away_team: "B", home_score: 3, away_score: 2,
        periods: { "1h": { home: 1, away: 1 }, "2h": { home: 2, away: 1 } },
      },
    };
    const verifier = {
      score: {
        home_team: "A", away_team: "B", home_score: 3, away_score: 2,
        periods: null,
      },
    };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });
});

describe("compareResults — position-based sports", () => {
  it("returns match when top 3 positions match", () => {
    const primary = {
      positions: [
        { position: 1, name: "Max Verstappen", team: "Red Bull" },
        { position: 2, name: "Lewis Hamilton", team: "Mercedes" },
        { position: 3, name: "Lando Norris", team: "McLaren" },
        { position: 4, name: "Oscar Piastri", team: "McLaren" },
      ],
    };
    const verifier = {
      positions: [
        { position: 1, name: "Max Verstappen", team: "Red Bull" },
        { position: 2, name: "Lewis Hamilton", team: "Mercedes" },
        { position: 3, name: "Lando Norris", team: "McLaren" },
      ],
    };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });

  it("returns mismatch when position 1 differs", () => {
    const primary = {
      positions: [
        { position: 1, name: "Max Verstappen", team: "Red Bull" },
        { position: 2, name: "Lewis Hamilton", team: "Mercedes" },
        { position: 3, name: "Lando Norris", team: "McLaren" },
      ],
    };
    const verifier = {
      positions: [
        { position: 1, name: "Lewis Hamilton", team: "Mercedes" },
        { position: 2, name: "Max Verstappen", team: "Red Bull" },
        { position: 3, name: "Lando Norris", team: "McLaren" },
      ],
    };
    expect(compareResults(primary, verifier)).toBe("mismatch" satisfies CompareVerdict);
  });

  it("returns mismatch when position 3 differs", () => {
    const primary = {
      positions: [
        { position: 1, name: "Max Verstappen", team: null },
        { position: 2, name: "Lewis Hamilton", team: null },
        { position: 3, name: "Lando Norris", team: null },
      ],
    };
    const verifier = {
      positions: [
        { position: 1, name: "Max Verstappen", team: null },
        { position: 2, name: "Lewis Hamilton", team: null },
        { position: 3, name: "Charles Leclerc", team: null },
      ],
    };
    expect(compareResults(primary, verifier)).toBe("mismatch" satisfies CompareVerdict);
  });

  it("is case-insensitive for name comparison", () => {
    const primary = {
      positions: [{ position: 1, name: "Max VERSTAPPEN", team: null }],
    };
    const verifier = {
      positions: [{ position: 1, name: "max verstappen", team: null }],
    };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });

  it("trims whitespace in names", () => {
    const primary = {
      positions: [{ position: 1, name: " Tiger Woods ", team: null }],
    };
    const verifier = {
      positions: [{ position: 1, name: "Tiger Woods", team: null }],
    };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });

  it("compares the shorter list when lengths differ (2 vs 3)", () => {
    const primary = {
      positions: [
        { position: 1, name: "A", team: null },
        { position: 2, name: "B", team: null },
      ],
    };
    const verifier = {
      positions: [
        { position: 1, name: "A", team: null },
        { position: 2, name: "B", team: null },
        { position: 3, name: "C", team: null },
      ],
    };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });

  it("ignores positions beyond top 3", () => {
    const primary = {
      positions: [
        { position: 1, name: "A", team: null },
        { position: 2, name: "B", team: null },
        { position: 3, name: "C", team: null },
        { position: 4, name: "D", team: null },
      ],
    };
    const verifier = {
      positions: [
        { position: 1, name: "A", team: null },
        { position: 2, name: "B", team: null },
        { position: 3, name: "C", team: null },
        { position: 4, name: "DIFFERENT", team: null },
      ],
    };
    expect(compareResults(primary, verifier)).toBe("match" satisfies CompareVerdict);
  });
});

describe("compareResults — inconclusive cases", () => {
  it("returns inconclusive when primary has score but verifier has positions", () => {
    const primary = { score: { home_team: "A", away_team: "B", home_score: 1, away_score: 0, periods: null } };
    const verifier = { positions: [{ position: 1, name: "A", team: null }] };
    expect(compareResults(primary, verifier)).toBe("inconclusive" satisfies CompareVerdict);
  });

  it("returns inconclusive when both have null score and null positions", () => {
    expect(compareResults({ score: null, positions: null }, { score: null, positions: null })).toBe("inconclusive");
  });

  it("returns inconclusive when both have empty positions", () => {
    expect(compareResults({ positions: [] }, { positions: [] })).toBe("inconclusive");
  });

  it("returns inconclusive when primary has score but verifier score is null", () => {
    const primary = { score: { home_team: "A", away_team: "B", home_score: 1, away_score: 0, periods: null } };
    const verifier = { score: null };
    expect(compareResults(primary, verifier)).toBe("inconclusive");
  });

  it("returns inconclusive when primary has positions but verifier has none", () => {
    const primary = { positions: [{ position: 1, name: "A", team: null }] };
    const verifier = { positions: null };
    expect(compareResults(primary, verifier)).toBe("inconclusive");
  });

  it("returns inconclusive when one has empty positions and other has populated", () => {
    const primary = { positions: [] as { position: number; name: string; team: string | null }[] };
    const verifier = { positions: [{ position: 1, name: "A", team: null }] };
    expect(compareResults(primary, verifier)).toBe("inconclusive");
  });
});

describe("compareResults — edge cases", () => {
  it("score takes precedence over positions when both present", () => {
    // If both fields are populated, score comparison wins (team sport with
    // positions is unusual but possible)
    const primary = {
      score: { home_team: "A", away_team: "B", home_score: 2, away_score: 1, periods: null },
      positions: [{ position: 1, name: "X", team: null }],
    };
    const verifier = {
      score: { home_team: "A", away_team: "B", home_score: 2, away_score: 1, periods: null },
      positions: [{ position: 1, name: "Y", team: null }],
    };
    // Score matches — positions mismatch is irrelevant
    expect(compareResults(primary, verifier)).toBe("match");
  });

  it("handles high scores correctly", () => {
    const primary = { score: { home_team: "A", away_team: "B", home_score: 147, away_score: 0, periods: null } };
    const verifier = { score: { home_team: "A", away_team: "B", home_score: 147, away_score: 0, periods: null } };
    expect(compareResults(primary, verifier)).toBe("match");
  });

  it("treats no arguments as inconclusive", () => {
    expect(compareResults({}, {})).toBe("inconclusive");
  });
});
