import { describe, it, expect } from "vitest";
import {
  computeLivePoints,
  filterLiveEvents,
  type LiveEvent,
  type LiveEpt,
  type LivePrediction,
} from "./live-overlay";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLiveEvent(
  overrides: Partial<LiveEvent> & { homeScore?: number; awayScore?: number } = {},
): LiveEvent {
  const { homeScore = 1, awayScore = 0, ...rest } = overrides;
  return {
    id: "evt-1",
    sport: "soccer",
    start_time: new Date(Date.now() - 60 * 60_000).toISOString(), // 1h ago
    result_data: {
      live: {
        homeScore,
        awayScore,
        status: "LIVE",
        fetchedAt: new Date().toISOString(),
      },
    },
    ...rest,
  };
}

function makeEpt(overrides: Partial<LiveEpt> = {}): LiveEpt {
  return {
    event_id: "evt-1",
    prediction_type: "winner",
    points: 2,
    partial_points: 0,
    config: { options: ["Home", "Draw", "Away"] },
    ...overrides,
  };
}

function makePrediction(overrides: Partial<LivePrediction> = {}): LivePrediction {
  return {
    user_id: "user-1",
    event_id: "evt-1",
    prediction_type: "winner",
    prediction_data: { value: "Home" },
    ...overrides,
  };
}

// ── computeLivePoints ────────────────────────────────────────────────────────

describe("computeLivePoints", () => {
  it("does nothing when there are no live events", () => {
    const pointsMap = new Map([["user-1", 10]]);
    const scored = computeLivePoints([], [], [], pointsMap);

    expect(scored).toEqual([]);
    expect(pointsMap.get("user-1")).toBe(10);
  });

  it("awards points for a correct winner prediction (home win)", () => {
    const pointsMap = new Map([["user-1", 10]]);
    const events = [makeLiveEvent({ homeScore: 2, awayScore: 0 })];
    const epts = [makeEpt()];
    const preds = [makePrediction({ prediction_data: { value: "Home" } })];

    const scored = computeLivePoints(events, epts, preds, pointsMap);

    expect(scored).toEqual(["evt-1"]);
    expect(pointsMap.get("user-1")).toBe(12); // 10 + 2 pts
  });

  it("awards points for a correct away win prediction", () => {
    const pointsMap = new Map([["user-1", 5]]);
    const events = [makeLiveEvent({ homeScore: 0, awayScore: 3 })];
    const epts = [makeEpt()];
    const preds = [makePrediction({ prediction_data: { value: "Away" } })];

    const scored = computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("user-1")).toBe(7); // 5 + 2
  });

  it("awards points for a correct draw prediction", () => {
    const pointsMap = new Map([["user-1", 0]]);
    const events = [makeLiveEvent({ homeScore: 1, awayScore: 1 })];
    const epts = [makeEpt()];
    const preds = [makePrediction({ prediction_data: { value: "Draw" } })];

    const scored = computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("user-1")).toBe(2);
  });

  it("awards zero for a wrong prediction", () => {
    const pointsMap = new Map([["user-1", 10]]);
    const events = [makeLiveEvent({ homeScore: 2, awayScore: 0 })];
    const epts = [makeEpt()];
    const preds = [makePrediction({ prediction_data: { value: "Away" } })];

    computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("user-1")).toBe(10); // unchanged
  });

  it("handles multiple users on the same event", () => {
    const pointsMap = new Map([
      ["user-1", 10],
      ["user-2", 20],
      ["user-3", 5],
    ]);
    const events = [makeLiveEvent({ homeScore: 1, awayScore: 0 })];
    const epts = [makeEpt({ points: 3 })];
    const preds = [
      makePrediction({ user_id: "user-1", prediction_data: { value: "Home" } }),
      makePrediction({ user_id: "user-2", prediction_data: { value: "Away" } }),
      makePrediction({ user_id: "user-3", prediction_data: { value: "Home" } }),
    ];

    computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("user-1")).toBe(13); // correct: +3
    expect(pointsMap.get("user-2")).toBe(20); // wrong: +0
    expect(pointsMap.get("user-3")).toBe(8);  // correct: +3
  });

  it("handles multiple events accumulating points", () => {
    const pointsMap = new Map([["user-1", 0]]);
    const events = [
      makeLiveEvent({ id: "evt-1", homeScore: 2, awayScore: 0 }),
      makeLiveEvent({ id: "evt-2", homeScore: 0, awayScore: 1 }),
    ];
    const epts = [
      makeEpt({ event_id: "evt-1" }),
      makeEpt({ event_id: "evt-2" }),
    ];
    const preds = [
      makePrediction({ event_id: "evt-1", prediction_data: { value: "Home" } }),
      makePrediction({ event_id: "evt-2", prediction_data: { value: "Away" } }),
    ];

    const scored = computeLivePoints(events, epts, preds, pointsMap);

    expect(scored).toEqual(["evt-1", "evt-2"]);
    expect(pointsMap.get("user-1")).toBe(4); // 2 + 2
  });

  it("skips events with missing live data", () => {
    const pointsMap = new Map([["user-1", 10]]);
    const events: LiveEvent[] = [{
      id: "evt-1",
      sport: "soccer",
      start_time: new Date().toISOString(),
      result_data: null, // no live data
    }];
    const epts = [makeEpt()];
    const preds = [makePrediction()];

    const scored = computeLivePoints(events, epts, preds, pointsMap);

    expect(scored).toEqual([]);
    expect(pointsMap.get("user-1")).toBe(10);
  });

  it("skips events where live scores are not numeric", () => {
    const pointsMap = new Map([["user-1", 10]]);
    const events: LiveEvent[] = [{
      id: "evt-1",
      sport: "soccer",
      start_time: new Date().toISOString(),
      result_data: {
        live: { homeScore: null, awayScore: null, status: "NS", fetchedAt: "" },
      },
    }];

    const scored = computeLivePoints(events, [makeEpt()], [makePrediction()], pointsMap);

    expect(scored).toEqual([]);
    expect(pointsMap.get("user-1")).toBe(10);
  });

  it("skips predictions with no matching EPT", () => {
    const pointsMap = new Map([["user-1", 5]]);
    const events = [makeLiveEvent()];
    // EPT is for "exact_score" but prediction is "winner" — no match
    const epts = [makeEpt({ prediction_type: "exact_score", points: 5 })];
    const preds = [makePrediction({ prediction_type: "winner" })];

    computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("user-1")).toBe(5); // unchanged
  });

  it("handles exact_score prediction type", () => {
    const pointsMap = new Map([["user-1", 0]]);
    const events = [makeLiveEvent({ homeScore: 2, awayScore: 1 })];
    const epts = [makeEpt({
      prediction_type: "exact_score",
      points: 5,
      config: null,
    })];
    // exact_score scorer expects { home: N, away: N }
    const preds = [makePrediction({
      prediction_type: "exact_score",
      prediction_data: { home: 2, away: 1 },
    })];

    computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("user-1")).toBe(5); // exact match
  });

  it("awards zero for wrong exact_score", () => {
    const pointsMap = new Map([["user-1", 0]]);
    const events = [makeLiveEvent({ homeScore: 2, awayScore: 1 })];
    const epts = [makeEpt({
      prediction_type: "exact_score",
      points: 5,
      config: null,
    })];
    const preds = [makePrediction({
      prediction_type: "exact_score",
      prediction_data: { home: 1, away: 0 },
    })];

    computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("user-1")).toBe(0);
  });

  it("handles winner + exact_score for same user (score-derived override)", () => {
    const pointsMap = new Map([["user-1", 0]]);
    const events = [makeLiveEvent({ homeScore: 2, awayScore: 0 })];
    const epts = [
      makeEpt({ prediction_type: "winner", points: 2 }),
      makeEpt({ prediction_type: "exact_score", points: 5, config: null }),
    ];
    // User predicted "Away" as winner but their exact score says 2-0 (home win).
    // Score-derived override should correct winner to "Home".
    const preds = [
      makePrediction({
        prediction_type: "winner",
        prediction_data: { value: "Away" },
      }),
      makePrediction({
        prediction_type: "exact_score",
        prediction_data: { home: 2, away: 0 },
      }),
    ];

    computeLivePoints(events, epts, preds, pointsMap);

    // Winner: overridden to Home (correct) = +2
    // Exact score: 2-0 matches = +5
    expect(pointsMap.get("user-1")).toBe(7);
  });

  it("catches scorer exceptions and continues processing", () => {
    const pointsMap = new Map([
      ["user-1", 0],
      ["user-2", 0],
    ]);
    const events = [makeLiveEvent()];
    const epts = [makeEpt()];
    // user-1 has malformed data that might cause scorer to throw,
    // user-2 should still get scored
    const preds = [
      makePrediction({
        user_id: "user-1",
        prediction_data: { value: undefined as unknown as string },
      }),
      makePrediction({
        user_id: "user-2",
        prediction_data: { value: "Home" },
      }),
    ];

    // Should not throw
    expect(() => computeLivePoints(events, epts, preds, pointsMap)).not.toThrow();
    // user-2 should still get their points
    expect(pointsMap.get("user-2")).toBe(2);
  });

  it("initialises missing users in pointsMap when awarding points", () => {
    const pointsMap = new Map<string, number>(); // empty
    const events = [makeLiveEvent({ homeScore: 1, awayScore: 0 })];
    const epts = [makeEpt({ points: 3 })];
    const preds = [makePrediction({ user_id: "new-user", prediction_data: { value: "Home" } })];

    computeLivePoints(events, epts, preds, pointsMap);

    expect(pointsMap.get("new-user")).toBe(3);
  });

  it("returns all scored event IDs in order", () => {
    const pointsMap = new Map<string, number>();
    const events = [
      makeLiveEvent({ id: "evt-a" }),
      makeLiveEvent({ id: "evt-b" }),
      makeLiveEvent({ id: "evt-c" }),
    ];

    const scored = computeLivePoints(events, [], [], pointsMap);

    expect(scored).toEqual(["evt-a", "evt-b", "evt-c"]);
  });
});

// ── filterLiveEvents ─────────────────────────────────────────────────────────

describe("filterLiveEvents", () => {
  it("returns events within their sport live window", () => {
    const now = Date.now();
    const events = [
      makeLiveEvent({
        sport: "soccer",
        // Started 1 hour ago — within soccer's 3h window
        start_time: new Date(now - 1 * 3_600_000).toISOString(),
      }),
    ];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(1);
  });

  it("excludes events outside their sport live window", () => {
    const now = Date.now();
    const events = [
      makeLiveEvent({
        sport: "soccer",
        // Started 4 hours ago — outside soccer's 3h (checkAfterHours=2 + 1h buffer) window
        start_time: new Date(now - 4 * 3_600_000).toISOString(),
      }),
    ];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(0);
  });

  it("respects sport-specific timing (golf has longer window)", () => {
    const now = Date.now();
    const events = [
      makeLiveEvent({
        sport: "golf",
        // Started 7 hours ago — within golf's 9h (8h + 1h buffer) window
        start_time: new Date(now - 7 * 3_600_000).toISOString(),
      }),
    ];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(1);
  });

  it("excludes golf events outside the 9h window", () => {
    const now = Date.now();
    const events = [
      makeLiveEvent({
        sport: "golf",
        // Started 10 hours ago — outside golf's 9h window
        start_time: new Date(now - 10 * 3_600_000).toISOString(),
      }),
    ];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(0);
  });

  it("excludes events with no live score data", () => {
    const now = Date.now();
    const events: LiveEvent[] = [{
      id: "evt-1",
      sport: "soccer",
      start_time: new Date(now - 1 * 3_600_000).toISOString(),
      result_data: {}, // no live sub-key
    }];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(0);
  });

  it("excludes events with null result_data", () => {
    const now = Date.now();
    const events: LiveEvent[] = [{
      id: "evt-1",
      sport: "soccer",
      start_time: new Date(now - 1 * 3_600_000).toISOString(),
      result_data: null,
    }];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(0);
  });

  it("excludes events where live scores are non-numeric", () => {
    const now = Date.now();
    const events: LiveEvent[] = [{
      id: "evt-1",
      sport: "soccer",
      start_time: new Date(now - 1 * 3_600_000).toISOString(),
      result_data: {
        live: { homeScore: "N/A", awayScore: null, status: "NS", fetchedAt: "" },
      },
    }];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(0);
  });

  it("handles mixed valid and invalid events", () => {
    const now = Date.now();
    const events: LiveEvent[] = [
      makeLiveEvent({
        id: "valid",
        start_time: new Date(now - 1 * 3_600_000).toISOString(),
      }),
      {
        id: "no-live",
        sport: "soccer",
        start_time: new Date(now - 1 * 3_600_000).toISOString(),
        result_data: {},
      },
      makeLiveEvent({
        id: "expired",
        start_time: new Date(now - 5 * 3_600_000).toISOString(),
      }),
      makeLiveEvent({
        id: "also-valid",
        start_time: new Date(now - 30 * 60_000).toISOString(), // 30 min ago
      }),
    ];

    const result = filterLiveEvents(events, now);

    expect(result.map((e) => e.id)).toEqual(["valid", "also-valid"]);
  });

  it("returns empty array for empty input", () => {
    expect(filterLiveEvents([], Date.now())).toEqual([]);
  });

  it("handles unknown sport with default timing", () => {
    const now = Date.now();
    // Default timing: checkAfterHours=3, so window = (3+1)*3600000 = 4h
    const events = [
      makeLiveEvent({
        sport: "curling" as never, // unknown sport
        start_time: new Date(now - 3.5 * 3_600_000).toISOString(),
      }),
    ];

    const result = filterLiveEvents(events, now);

    expect(result).toHaveLength(1);
  });
});
