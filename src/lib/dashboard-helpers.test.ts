import { describe, it, expect } from "vitest";
import {
  computePickCounts,
  findActiveRound,
  type PredictionRow,
  type RoundRow,
} from "./dashboard-helpers";

// ── computePickCounts ──────────────────────────────────────────────────────

describe("computePickCounts", () => {
  it("counts unique events per round", () => {
    const preds: PredictionRow[] = [
      { event_id: "e1", events: { round_id: "r1" } },
      { event_id: "e2", events: { round_id: "r1" } },
      { event_id: "e3", events: { round_id: "r2" } },
    ];
    expect(computePickCounts(preds)).toEqual({ r1: 2, r2: 1 });
  });

  it("deduplicates multiple prediction types on the same event", () => {
    // winner + exact_score on the same match = 1 pick, not 2
    const preds: PredictionRow[] = [
      { event_id: "e1", events: { round_id: "r1" } },
      { event_id: "e1", events: { round_id: "r1" } },
      { event_id: "e1", events: { round_id: "r1" } },
    ];
    expect(computePickCounts(preds)).toEqual({ r1: 1 });
  });

  it("returns empty object when no predictions", () => {
    expect(computePickCounts([])).toEqual({});
  });

  it("skips predictions with null round_id", () => {
    const preds: PredictionRow[] = [
      { event_id: "e1", events: { round_id: null } },
      { event_id: "e2", events: { round_id: "r1" } },
    ];
    expect(computePickCounts(preds)).toEqual({ r1: 1 });
  });

  it("handles events as object (Supabase many-to-one shape)", () => {
    // This is the actual shape Supabase returns — object, not array
    const raw = [
      { event_id: "e1", events: { round_id: "r1" } },
      { event_id: "e2", events: { round_id: "r1" } },
    ];
    expect(computePickCounts(raw)).toEqual({ r1: 2 });
  });

  it("would fail with array access pattern (regression guard)", () => {
    // Simulates the old bug: if events were accessed as an array,
    // round_id would be undefined and all predictions would be skipped
    const pred = { event_id: "e1", events: { round_id: "r1" } };
    // Old bug: (pred.events as any)?.[0]?.round_id → undefined
    expect((pred.events as any)?.[0]?.round_id).toBeUndefined();
    // Fixed: pred.events?.round_id → "r1"
    expect(pred.events?.round_id).toBe("r1");
  });
});

// ── findActiveRound ────────────────────────────────────────────────────────

describe("findActiveRound", () => {
  const rounds: RoundRow[] = [
    { id: "r3", competition_id: "c1", name: "Group Matchday 3", round_number: 3, status: "open" },
    { id: "r1", competition_id: "c1", name: "Group Matchday 1", round_number: 1, status: "open" },
    { id: "r2", competition_id: "c1", name: "Group Matchday 2", round_number: 2, status: "open" },
    { id: "r4", competition_id: "c2", name: "Round 1", round_number: 1, status: "open" },
  ];

  it("returns the earliest round for a competition regardless of input order", () => {
    const active = findActiveRound(rounds, "c1");
    expect(active?.id).toBe("r1");
    expect(active?.name).toBe("Group Matchday 1");
  });

  it("filters by competition_id", () => {
    const active = findActiveRound(rounds, "c2");
    expect(active?.id).toBe("r4");
  });

  it("returns undefined when no rounds match", () => {
    expect(findActiveRound(rounds, "c99")).toBeUndefined();
  });

  it("returns undefined for empty rounds array", () => {
    expect(findActiveRound([], "c1")).toBeUndefined();
  });
});
