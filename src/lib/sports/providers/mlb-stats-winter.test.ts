import { afterEach, describe, expect, it, vi } from "vitest";
import { scorePrediction } from "@/lib/scoring";
import { getTimingForSport } from "@/lib/sports/timing";
import { MLBStatsWinterProvider } from "./mlb-stats-winter";

/**
 * End-to-end proof of the winter-league results-automation chain:
 *
 *   MLB Stats live feed  →  MLBStatsWinterProvider.getResult (normalize)
 *                        →  scorePrediction("winner", …)      (score)
 *
 * These are the two pure links the automated cron relies on (the cron itself
 * is DB + network I/O). Using a REAL first-month LMP game from the 2025-26
 * backfill (gamePk 826059, Jaguares de Nayarit 4 – 6 Venados de Mazatlán) so
 * the test reflects the exact data shape production runs on.
 *
 * It also documents the critical result_data shape: scoreWinner reads
 * result.score = { home_team, away_team, home_score, away_score }, NOT the
 * bare { home, away } some seeds store — seeds must use the score shape (or
 * pre-score) for standings to populate.
 */

interface FeedArgs {
  homeName: string;
  awayName: string;
  homeRuns: number;
  awayRuns: number;
  state: string;
}

function mockLiveFeed({ homeName, awayName, homeRuns, awayRuns, state }: FeedArgs) {
  return {
    gameData: {
      game: { pk: 826059 },
      datetime: { dateTime: "2025-10-16T02:00:00Z" },
      status: { detailedState: state },
      teams: { home: { name: homeName }, away: { name: awayName } },
    },
    liveData: {
      linescore: {
        teams: { home: { runs: homeRuns }, away: { runs: awayRuns } },
        innings: [{ num: 9, home: { runs: homeRuns }, away: { runs: awayRuns } }],
      },
    },
  };
}

function stubFetch(feed: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => feed,
    })),
  );
}

const HOME = "Jaguares de Nayarit";
const AWAY = "Venados de Mazatlán";

describe("winter-league results automation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes a real LMP final from the MLB Stats feed", async () => {
    stubFetch(
      mockLiveFeed({
        homeName: HOME,
        awayName: AWAY,
        homeRuns: 4,
        awayRuns: 6,
        state: "Final",
      }),
    );
    const provider = new MLBStatsWinterProvider();
    const res = await provider.getResult("baseball", "826059", "winter/lmp");

    expect(res).not.toBeNull();
    expect(res!.is_final).toBe(true);
    expect(res!.score).toMatchObject({
      home_team: HOME,
      away_team: AWAY,
      home_score: 4,
      away_score: 6,
    });
    expect(res!.winner).toBe(AWAY); // away won 6–4
  });

  it("scores winner predictions from the provider result (full chain)", async () => {
    stubFetch(
      mockLiveFeed({
        homeName: HOME,
        awayName: AWAY,
        homeRuns: 4,
        awayRuns: 6,
        state: "Final",
      }),
    );
    const provider = new MLBStatsWinterProvider();
    const result = await provider.getResult("baseball", "826059", "winter/lmp");

    const ept = { points: 2, partial_points: 0, config: { options: [HOME, AWAY] } };

    const correct = scorePrediction(
      "winner",
      { value: AWAY },
      result as unknown as Record<string, unknown>,
      ept,
    );
    expect(correct).toEqual({
      is_correct: true,
      is_partial: false,
      points_awarded: 2,
    });

    const wrong = scorePrediction(
      "winner",
      { value: HOME },
      result as unknown as Record<string, unknown>,
      ept,
    );
    expect(wrong.is_correct).toBe(false);
    expect(wrong.points_awarded).toBe(0);
  });

  it("does not treat an in-progress game as final (cron waits)", async () => {
    stubFetch(
      mockLiveFeed({
        homeName: HOME,
        awayName: AWAY,
        homeRuns: 2,
        awayRuns: 1,
        state: "In Progress",
      }),
    );
    const provider = new MLBStatsWinterProvider();
    const res = await provider.getResult("baseball", "826059", "winter/lmp");
    expect(res!.is_final).toBe(false);
  });

  it("uses a baseball result window wide enough for the cron (regression)", () => {
    // Was falling to DEFAULT_TIMING (8h) because only 'mlb' existed.
    const timing = getTimingForSport("baseball");
    expect(timing.windowHours).toBeGreaterThanOrEqual(24);
  });
});
