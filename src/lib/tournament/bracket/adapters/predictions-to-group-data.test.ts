/**
 * Tests for predictions-to-group-data adapter.
 *
 * Run with: npx tsx src/lib/tournament/bracket/adapters/predictions-to-group-data.test.ts
 *
 * Uses a fake SupabaseClient that returns canned rows. The adapter only ever
 * calls `.from().select()...` chains, so we model that surface tightly.
 */

import { loadGroupDataFromPredictions, selectionForResult } from "./predictions-to-group-data";

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`  Expected: ${e}`);
    console.error(`  Actual:   ${a}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

// ---------------------------------------------------------------------------
// Fake SupabaseClient
// ---------------------------------------------------------------------------

interface FakeEvent {
  id: string;
  external_event_id: string | null;
  event_name: string;
  competition_id: string;
}

interface FakePrediction {
  event_id: string;
  user_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown>;
}

function makeFakeClient(events: FakeEvent[], predictions: FakePrediction[]) {
  return {
    from(table: string) {
      if (table === "events") {
        return {
          select() {
            return {
              _filters: { competitionId: undefined as string | undefined, like: undefined as string | undefined },
              eq(this: any, col: string, val: string) {
                if (col === "competition_id") this._filters.competitionId = val;
                return this;
              },
              like(this: any, _col: string, pattern: string) {
                this._filters.like = pattern;
                return Promise.resolve({
                  data: events
                    .filter((e) => e.competition_id === this._filters.competitionId)
                    .filter((e) =>
                      this._filters.like
                        ? new RegExp("^" + (this._filters.like as string).replace(/%/g, ".*") + "$").test(
                            e.external_event_id ?? "",
                          )
                        : true,
                    )
                    .map(({ id, external_event_id, event_name }) => ({ id, external_event_id, event_name })),
                  error: null,
                });
              },
            };
          },
        };
      }
      if (table === "predictions") {
        return {
          select() {
            return {
              _filters: { user_id: undefined as string | undefined, event_ids: [] as string[], types: [] as string[] },
              eq(this: any, col: string, val: string) {
                if (col === "user_id") this._filters.user_id = val;
                return this;
              },
              in(this: any, col: string, vals: string[]) {
                if (col === "event_id") this._filters.event_ids = vals;
                if (col === "prediction_type") this._filters.types = vals;
                if (col === "prediction_type") {
                  // Last `.in()` finalises the query in our usage.
                  return Promise.resolve({
                    data: predictions
                      .filter((p) => p.user_id === this._filters.user_id)
                      .filter((p) => this._filters.event_ids.includes(p.event_id))
                      .filter((p) => this._filters.types.includes(p.prediction_type))
                      .map(({ event_id, prediction_type, prediction_data }) => ({
                        event_id,
                        prediction_type,
                        prediction_data,
                      })),
                    error: null,
                  });
                }
                return this;
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMP = "comp-1";
const USER = "user-1";

const GROUP_A_TEAMS = ["Mexico", "South Korea", "South Africa", "Czechia"];
const GROUP_A_SPEC = { groupId: "A", name: "Group A", teams: GROUP_A_TEAMS };

// 6 events for Group A's round-robin in declaration order:
// (Mex,SKor) (Mex,SAfr) (Mex,Cze) (SKor,SAfr) (SKor,Cze) (SAfr,Cze)
const GROUP_A_EVENTS: FakeEvent[] = [
  { id: "e-A-1", competition_id: COMP, external_event_id: "wc2026-grp-A-md1-1", event_name: "Mexico vs South Korea" },
  { id: "e-A-2", competition_id: COMP, external_event_id: "wc2026-grp-A-md2-1", event_name: "Mexico vs South Africa" },
  { id: "e-A-3", competition_id: COMP, external_event_id: "wc2026-grp-A-md3-1", event_name: "Mexico vs Czechia" },
  { id: "e-A-4", competition_id: COMP, external_event_id: "wc2026-grp-A-md1-2", event_name: "South Korea vs South Africa" },
  { id: "e-A-5", competition_id: COMP, external_event_id: "wc2026-grp-A-md2-2", event_name: "South Korea vs Czechia" },
  { id: "e-A-6", competition_id: COMP, external_event_id: "wc2026-grp-A-md3-2", event_name: "South Africa vs Czechia" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function run() {
  console.log("\n🧪 Testing loadGroupDataFromPredictions\n");

  // Test 1: no predictions yet
  {
    const client = makeFakeClient(GROUP_A_EVENTS, []);
    const result = await loadGroupDataFromPredictions(client, {
      userId: USER,
      competitionId: COMP,
      groups: [GROUP_A_SPEC],
    });
    assertEqual(
      result.length === 1 && result[0].matches.length === 6 && result[0].matches.every((m) => m.result === null),
      true,
      "Empty predictions store yields 6 matches with result=null",
    );
    assertEqual(
      result[0].has_tiebreaker_scores,
      false,
      "Empty predictions → has_tiebreaker_scores=false",
    );
  }

  // Test 2: a winner pick maps team-name selection back to home_win/away_win/draw
  {
    const predictions: FakePrediction[] = [
      // Mexico beat South Korea (m1 = home_win)
      { event_id: "e-A-1", user_id: USER, prediction_type: "winner", prediction_data: { selection: "Mexico" } },
      // South Africa beat Mexico (m2 = away_win — Mexico was home in event)
      { event_id: "e-A-2", user_id: USER, prediction_type: "winner", prediction_data: { selection: "South Africa" } },
      // Czechia vs Mexico draw (m3)
      { event_id: "e-A-3", user_id: USER, prediction_type: "winner", prediction_data: { selection: "Draw" } },
    ];
    const client = makeFakeClient(GROUP_A_EVENTS, predictions);
    const result = await loadGroupDataFromPredictions(client, {
      userId: USER,
      competitionId: COMP,
      groups: [GROUP_A_SPEC],
    });

    const m1 = result[0].matches.find((m) => m.match_id === "A-m1")!;
    const m2 = result[0].matches.find((m) => m.match_id === "A-m2")!;
    const m3 = result[0].matches.find((m) => m.match_id === "A-m3")!;
    const m4 = result[0].matches.find((m) => m.match_id === "A-m4")!;

    assertEqual(m1.result, "home_win", "m1 (Mexico home) Mexico selection → home_win");
    assertEqual(m2.result, "away_win", "m2 (Mexico home) South Africa selection → away_win");
    assertEqual(m3.result, "draw", "m3 Draw selection → draw");
    assertEqual(m4.result, null, "m4 with no prediction → null");
  }

  // Test 3: exact_score row populates exact_score and flips has_tiebreaker_scores
  {
    const predictions: FakePrediction[] = [
      { event_id: "e-A-1", user_id: USER, prediction_type: "winner", prediction_data: { selection: "Mexico" } },
      { event_id: "e-A-1", user_id: USER, prediction_type: "exact_score", prediction_data: { home_score: 2, away_score: 1 } },
    ];
    const client = makeFakeClient(GROUP_A_EVENTS, predictions);
    const result = await loadGroupDataFromPredictions(client, {
      userId: USER,
      competitionId: COMP,
      groups: [GROUP_A_SPEC],
    });

    const m1 = result[0].matches.find((m) => m.match_id === "A-m1")!;
    assertEqual(m1.exact_score, { home_score: 2, away_score: 1 }, "m1 exact_score reflected");
    assertEqual(result[0].has_tiebreaker_scores, true, "Any exact_score flips has_tiebreaker_scores=true");
  }

  // Test 4: another user's predictions are not leaked
  {
    const predictions: FakePrediction[] = [
      { event_id: "e-A-1", user_id: "user-2", prediction_type: "winner", prediction_data: { selection: "Mexico" } },
    ];
    const client = makeFakeClient(GROUP_A_EVENTS, predictions);
    const result = await loadGroupDataFromPredictions(client, {
      userId: USER,
      competitionId: COMP,
      groups: [GROUP_A_SPEC],
    });
    const m1 = result[0].matches.find((m) => m.match_id === "A-m1")!;
    assertEqual(m1.result, null, "Other user's predictions ignored");
  }

  // Test 5: a stale `selection` value (e.g. team renamed) leaves result null
  {
    const predictions: FakePrediction[] = [
      { event_id: "e-A-1", user_id: USER, prediction_type: "winner", prediction_data: { selection: "Atlantis" } },
    ];
    const client = makeFakeClient(GROUP_A_EVENTS, predictions);
    const result = await loadGroupDataFromPredictions(client, {
      userId: USER,
      competitionId: COMP,
      groups: [GROUP_A_SPEC],
    });
    const m1 = result[0].matches.find((m) => m.match_id === "A-m1")!;
    assertEqual(m1.result, null, "Stale/unknown selection → null, not a guessed mapping");
  }

  // Test 6: legacy "Group A: X vs Y" event name format is still tolerated
  {
    const legacyEvents: FakeEvent[] = [
      { id: "e-A-1", competition_id: COMP, external_event_id: "wc2026-grp-A-md1-1", event_name: "Group A: Mexico vs South Korea" },
      { id: "e-A-2", competition_id: COMP, external_event_id: "wc2026-grp-A-md2-1", event_name: "Group A: Mexico vs South Africa" },
      { id: "e-A-3", competition_id: COMP, external_event_id: "wc2026-grp-A-md3-1", event_name: "Group A: Mexico vs Czechia" },
      { id: "e-A-4", competition_id: COMP, external_event_id: "wc2026-grp-A-md1-2", event_name: "Group A: South Korea vs South Africa" },
      { id: "e-A-5", competition_id: COMP, external_event_id: "wc2026-grp-A-md2-2", event_name: "Group A: South Korea vs Czechia" },
      { id: "e-A-6", competition_id: COMP, external_event_id: "wc2026-grp-A-md3-2", event_name: "Group A: South Africa vs Czechia" },
    ];
    const predictions: FakePrediction[] = [
      { event_id: "e-A-1", user_id: USER, prediction_type: "winner", prediction_data: { selection: "Mexico" } },
    ];
    const client = makeFakeClient(legacyEvents, predictions);
    const result = await loadGroupDataFromPredictions(client, {
      userId: USER,
      competitionId: COMP,
      groups: [GROUP_A_SPEC],
    });
    const m1 = result[0].matches.find((m) => m.match_id === "A-m1")!;
    assertEqual(m1.result, "home_win", "Legacy 'Group A: X vs Y' event name still matches");
  }

  // selectionForResult helper
  console.log("\n🧪 Testing selectionForResult\n");
  assertEqual(selectionForResult("home_win", "Mexico", "South Korea"), "Mexico", "home_win → home team");
  assertEqual(selectionForResult("away_win", "Mexico", "South Korea"), "South Korea", "away_win → away team");
  assertEqual(selectionForResult("draw", "Mexico", "South Korea"), "Draw", "draw → 'Draw'");

  console.log("\n✅ All tests passed\n");
}

run().catch((e) => {
  console.error("Unhandled error in tests:", e);
  process.exit(1);
});
