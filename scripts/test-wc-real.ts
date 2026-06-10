/**
 * test-wc-real.ts — End-to-end stress test of World Cup scoring and elimination logic.
 *
 * CRITICAL: Imports and calls the REAL application functions from src/lib/:
 *   - scorePrediction()          from ../src/lib/scoring
 *   - eliminateFromFormat()      from ../src/lib/tournament/format/elimination
 *   - generateEliminationCurve() from ../src/lib/tournament/format/curve-generator
 *   - computeGroupComposition()  from ../src/lib/tournament/format/group-allocation
 *
 * Usage:
 *   npx tsx scripts/test-wc-real.ts           # dry run (prints plan)
 *   npx tsx scripts/test-wc-real.ts --commit  # writes to DB and runs full test
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// REAL application function imports
// ---------------------------------------------------------------------------

import { scorePrediction } from "../src/lib/scoring";
import { eliminateFromFormat } from "../src/lib/tournament/format/elimination";
import { generateEliminationCurve } from "../src/lib/tournament/format/curve-generator";
import { computeGroupComposition } from "../src/lib/tournament/format/group-allocation";

// ---------------------------------------------------------------------------
// env loading (same pattern as seed-wc2026-group-events.ts)
// ---------------------------------------------------------------------------

function loadEnv(filePath: string) {
  try {
    const content = readFileSync(resolve(filePath), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* no .env.local */
  }
}

loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const COMMIT = process.argv.includes("--commit");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Constants: users
// ---------------------------------------------------------------------------

const SUPERADMIN_ID = "8c7e2e1b-0564-4d86-93e2-85ecf00f1e00";
const TEST_USER_ID  = "ebe5686c-f688-4495-8792-84f7ffc533a1";

const USERS = [
  { id: SUPERADMIN_ID,                              label: "Superadmin", group: 1 },
  { id: TEST_USER_ID,                               label: "Test user",  group: 1 },
  { id: "66f6a822-b20b-402a-977d-18e8f03e4ce1",    label: "Malone",     group: 1 },
  { id: "2d49977a-3edc-4760-95d1-35dca104422a",    label: "Jay",        group: 1 },
  { id: "3a2e7d15-cd3e-427f-a94d-b6fa608bfd7c",    label: "Manning",    group: 2 },
  { id: "1950786d-7216-42a3-aa87-c1088f74ba4e",    label: "Paddy",      group: 2 },
  { id: "5345b650-e8a5-415f-8d0e-4975f40fbe08",    label: "Parker",     group: 2 },
  { id: "10c6c61e-597f-457a-ad5d-c841923852f4",    label: "Bohanna",    group: 2 },
] as const;

type UserLabel = (typeof USERS)[number]["label"];

// ---------------------------------------------------------------------------
// Sporting stage IDs from the seeded WC2026 tournament
// ---------------------------------------------------------------------------

const STAGE_GROUP_MATCHDAY_3 = "b0000000-0000-0000-0003-000000000026"; // group-matchday-3
const STAGE_ROUND_OF_32      = "b0000000-0000-0000-0004-000000000026"; // round-of-32
const STAGE_FINAL            = "b0000000-0000-0000-0009-000000000026"; // final

// ---------------------------------------------------------------------------
// Predetermined predictions and expected scores
// ---------------------------------------------------------------------------

type WinnerSelection = "Home" | "Draw" | "Away";

interface PredictionSpec {
  winner: WinnerSelection;
  score: { home: number; away: number };
  expectedPts: number;
}

interface EventSpec {
  name: string;
  round: "Group Stage" | "Knockout" | "Final";
  result: { winner: WinnerSelection; homeScore: number; awayScore: number };
  predictions: Record<UserLabel, PredictionSpec>;
}

const GROUP_STAGE_EVENTS: EventSpec[] = [
  {
    name: "Rivendell vs Mordor",
    round: "Group Stage",
    result: { winner: "Home", homeScore: 2, awayScore: 1 },
    predictions: {
      Superadmin: { winner: "Home", score: { home: 2, away: 1 }, expectedPts: 5 },
      "Test user": { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 2 },
      Malone:      { winner: "Away", score: { home: 0, away: 1 }, expectedPts: 0 },
      Jay:         { winner: "Home", score: { home: 2, away: 1 }, expectedPts: 5 },
      Manning:     { winner: "Draw", score: { home: 1, away: 1 }, expectedPts: 0 },
      Paddy:       { winner: "Home", score: { home: 3, away: 0 }, expectedPts: 2 },
      Parker:      { winner: "Away", score: { home: 0, away: 2 }, expectedPts: 0 },
      Bohanna:     { winner: "Home", score: { home: 2, away: 0 }, expectedPts: 2 },
    },
  },
  {
    name: "Rohan vs Isengard",
    round: "Group Stage",
    result: { winner: "Draw", homeScore: 0, awayScore: 0 },
    predictions: {
      Superadmin: { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 0 },
      "Test user": { winner: "Draw", score: { home: 0, away: 0 }, expectedPts: 5 },
      Malone:      { winner: "Draw", score: { home: 1, away: 1 }, expectedPts: 2 },
      Jay:         { winner: "Away", score: { home: 0, away: 1 }, expectedPts: 0 },
      Manning:     { winner: "Draw", score: { home: 0, away: 0 }, expectedPts: 5 },
      Paddy:       { winner: "Home", score: { home: 2, away: 0 }, expectedPts: 0 },
      Parker:      { winner: "Draw", score: { home: 0, away: 0 }, expectedPts: 5 },
      Bohanna:     { winner: "Draw", score: { home: 2, away: 2 }, expectedPts: 2 },
    },
  },
  {
    name: "Gondor vs Moria",
    round: "Group Stage",
    result: { winner: "Home", homeScore: 3, awayScore: 0 },
    predictions: {
      Superadmin: { winner: "Home", score: { home: 3, away: 0 }, expectedPts: 5 },
      "Test user": { winner: "Home", score: { home: 2, away: 0 }, expectedPts: 2 },
      Malone:      { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 2 },
      Jay:         { winner: "Home", score: { home: 3, away: 0 }, expectedPts: 5 },
      Manning:     { winner: "Away", score: { home: 0, away: 1 }, expectedPts: 0 },
      Paddy:       { winner: "Home", score: { home: 3, away: 0 }, expectedPts: 5 },
      Parker:      { winner: "Home", score: { home: 2, away: 1 }, expectedPts: 2 },
      Bohanna:     { winner: "Home", score: { home: 3, away: 0 }, expectedPts: 5 },
    },
  },
  {
    name: "Shire vs Helm's Deep",
    round: "Group Stage",
    result: { winner: "Away", homeScore: 1, awayScore: 2 },
    predictions: {
      Superadmin: { winner: "Away", score: { home: 1, away: 2 }, expectedPts: 5 },
      "Test user": { winner: "Home", score: { home: 2, away: 0 }, expectedPts: 0 },
      Malone:      { winner: "Away", score: { home: 0, away: 1 }, expectedPts: 2 },
      Jay:         { winner: "Away", score: { home: 1, away: 2 }, expectedPts: 5 },
      Manning:     { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 0 },
      Paddy:       { winner: "Away", score: { home: 1, away: 2 }, expectedPts: 5 },
      Parker:      { winner: "Away", score: { home: 0, away: 3 }, expectedPts: 2 },
      Bohanna:     { winner: "Draw", score: { home: 1, away: 1 }, expectedPts: 0 },
    },
  },
];

const KNOCKOUT_EVENTS: EventSpec[] = [
  {
    name: "Rivendell vs Rohan",
    round: "Knockout",
    result: { winner: "Home", homeScore: 2, awayScore: 0 },
    predictions: {
      Superadmin: { winner: "Home", score: { home: 2, away: 0 }, expectedPts: 5 },
      "Test user": { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 2 },
      Malone:      { winner: "Away", score: { home: 0, away: 1 }, expectedPts: 0 },
      Jay:         { winner: "Home", score: { home: 2, away: 0 }, expectedPts: 5 },
      Manning:     { winner: "Draw", score: { home: 1, away: 1 }, expectedPts: 0 },
      Paddy:       { winner: "Home", score: { home: 3, away: 0 }, expectedPts: 2 },
      Parker:      { winner: "Away", score: { home: 0, away: 2 }, expectedPts: 0 },
      Bohanna:     { winner: "Home", score: { home: 2, away: 1 }, expectedPts: 2 },
    },
  },
];

const FINAL_EVENTS: EventSpec[] = [
  {
    name: "Rivendell vs Gondor",
    round: "Final",
    result: { winner: "Home", homeScore: 1, awayScore: 0 },
    predictions: {
      Superadmin: { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 5 },
      "Test user": { winner: "Home", score: { home: 2, away: 0 }, expectedPts: 2 },
      Malone:      { winner: "Away", score: { home: 0, away: 1 }, expectedPts: 0 },
      Jay:         { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 5 },
      Manning:     { winner: "Draw", score: { home: 0, away: 0 }, expectedPts: 0 },
      Paddy:       { winner: "Home", score: { home: 1, away: 0 }, expectedPts: 5 },
      Parker:      { winner: "Away", score: { home: 0, away: 1 }, expectedPts: 0 },
      Bohanna:     { winner: "Home", score: { home: 1, away: 1 }, expectedPts: 2 },
    },
  },
];

// Expected group stage totals (for Phase 2 verification)
const EXPECTED_GROUP_STAGE_TOTALS: Record<UserLabel, number> = {
  Superadmin:  15,
  "Test user":  9,
  Malone:       6,
  Jay:          15,
  Manning:       5,
  Paddy:        12,
  Parker:        9,
  Bohanna:       9,
};

// Expected eliminated users after group stage
const EXPECTED_ELIMINATED: UserLabel[] = ["Malone", "Manning"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(msg: string) { console.log(`  PASS: ${msg}`); }
function fail(msg: string) { console.log(`  FAIL: ${msg}`); }
function section(msg: string) { console.log(`\n${msg}`); }

function buildResultData(
  eventSpec: EventSpec,
): Record<string, unknown> {
  const parts = eventSpec.name.split(" vs ");
  const homeTeam = parts[0];
  const awayTeam = parts[1];
  return {
    winner: eventSpec.result.winner,
    score: {
      home_team: homeTeam,
      away_team: awayTeam,
      home_score: eventSpec.result.homeScore,
      away_score: eventSpec.result.awayScore,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\nREALITY CHECKER: Using ACTUAL application code from src/lib/scoring.ts and src/lib/tournament/format/");
  console.log(`Mode: ${COMMIT ? "COMMIT (writing to DB)" : "DRY RUN (no writes)"}\n`);

  // =========================================================================
  // Phase 0: Setup
  // =========================================================================
  section("--- Phase 0: Setup ---");

  // --- 0.0 Show real function outputs before any DB work ---

  section("EVIDENCE: Elimination curve (from generateEliminationCurve(8)):");
  const curve = generateEliminationCurve(8);
  for (const step of curve) {
    console.log(`  ${step.stage}: ${step.remaining} remaining`);
  }

  section("EVIDENCE: Group composition (from computeGroupComposition(8, 6)):");
  const groupComp = computeGroupComposition(8, 6);
  console.log(`  groups3=${groupComp.groups3}, groups4=${groupComp.groups4}, groups5=${groupComp.groups5}`);
  console.log(`  totalGroups=${groupComp.totalGroups}, autoQualifiers=${groupComp.autoQualifiers}, bestThirdSlots=${groupComp.bestThirdSlots}, totalSurvivors=${groupComp.totalSurvivors}`);

  if (!COMMIT) {
    console.log("\nPhase 0 dry run plan:");
    console.log("  Would create competition 'LOTR Cup' (invite_code: lotrcup)");
    console.log("  Would create 2 classifications: overall (leaderboard) + format (format_elimination)");
    console.log("  Would create 3 rounds: Group Stage (rn=1), Knockout (rn=2), Final (rn=3)");
    console.log("  Would create 6 events (4 group stage, 1 knockout, 1 final)");
    console.log("  Would create 12 event_prediction_types (winner + exact_score per event)");
    console.log("  Would enrol 8 users + create classification_memberships");
    console.log("  Would create 2 format prediction groups of 4");
    console.log("  Would create classification_events (event -> sporting stage mapping)");
    console.log("  Would seed 96 predictions (8 users x 6 events x 2 types)");
    console.log("\nDry run complete. Re-run with --commit to execute.\n");
    return;
  }

  // ---- COMMIT path --------------------------------------------------------

  const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago

  // ---- 0.1 Competition ---------------------------------------------------

  let competitionId: string;

  const { data: existingComp, error: existingCompErr } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("invite_code", "lotrcup")
    .maybeSingle();

  if (existingCompErr) throw new Error(`Competition lookup failed: ${existingCompErr.message}`);

  if (existingComp) {
    competitionId = existingComp.id;
    console.log(`Found existing competition: ${existingComp.name} (${competitionId})`);
  } else {
    const { data: newComp, error: compErr } = await supabase
      .from("competitions")
      .insert({
        name: "LOTR Cup",
        status: "active",
        visibility: "private",
        product_mode: null,
        tournament_id: null,
        created_by: SUPERADMIN_ID,
        type: "fixed",
        scoring_rules: { points_per_outcome: 2, points_per_exact: 3 },
        allow_prediction_updates: true,
        invite_code: "lotrcup",
      })
      .select("id")
      .single();

    if (compErr) throw new Error(`Competition insert failed: ${compErr.message}`);
    competitionId = newComp.id;
    console.log(`Created competition: ${competitionId}`);
  }

  // ---- 0.2 Classifications -----------------------------------------------

  let overallClassId: string;
  let formatClassId: string;

  const { data: existingClasses, error: classLookupErr } = await supabase
    .from("classifications")
    .select("id, classification_key")
    .eq("competition_id", competitionId)
    .in("classification_key", ["overall", "format"]);

  if (classLookupErr) throw new Error(`Classifications lookup failed: ${classLookupErr.message}`);

  const existingByKey = new Map<string, string>();
  for (const c of existingClasses ?? []) existingByKey.set(c.classification_key, c.id);

  if (!existingByKey.has("overall")) {
    const { data: overallClass, error: overallErr } = await supabase
      .from("classifications")
      .insert({
        competition_id: competitionId,
        classification_key: "overall",
        classification_type: "leaderboard",
        name: "Overall",
        status: "active",
        scoring_strategy: {},
        config: {},
      })
      .select("id")
      .single();

    if (overallErr) throw new Error(`Overall classification insert failed: ${overallErr.message}`);
    overallClassId = overallClass.id;
    console.log(`Created overall classification: ${overallClassId}`);
  } else {
    overallClassId = existingByKey.get("overall")!;
    console.log(`Found existing overall classification: ${overallClassId}`);
  }

  if (!existingByKey.has("format")) {
    const { data: formatClass, error: formatErr } = await supabase
      .from("classifications")
      .insert({
        competition_id: competitionId,
        classification_key: "format",
        classification_type: "format_elimination",
        name: "Format Elimination",
        status: "active",
        scoring_strategy: {},
        elimination_strategy: { type: "curve", entrant_count: 8 },
        config: {
          group_size: 4,
          elimination_curve: {
            entrantCount: 8,
            locked: false,
            curve: curve,
          },
        },
      })
      .select("id")
      .single();

    if (formatErr) throw new Error(`Format classification insert failed: ${formatErr.message}`);
    formatClassId = formatClass.id;
    console.log(`Created format classification: ${formatClassId}`);
  } else {
    formatClassId = existingByKey.get("format")!;
    console.log(`Found existing format classification: ${formatClassId}`);
  }

  // ---- 0.3 Rounds ---------------------------------------------------------

  const roundDefs = [
    { round_number: 1, name: "Group Stage", sporting_stage_id: STAGE_GROUP_MATCHDAY_3 },
    { round_number: 2, name: "Knockout",    sporting_stage_id: STAGE_ROUND_OF_32 },
    { round_number: 3, name: "Final",       sporting_stage_id: STAGE_FINAL },
  ];

  const roundIdByName = new Map<string, string>();

  const { data: existingRounds, error: roundLookupErr } = await supabase
    .from("rounds")
    .select("id, name, round_number")
    .eq("competition_id", competitionId);

  if (roundLookupErr) throw new Error(`Rounds lookup failed: ${roundLookupErr.message}`);

  const existingRoundsByNumber = new Map<number, { id: string; name: string }>();
  for (const r of existingRounds ?? []) existingRoundsByNumber.set(r.round_number, r);

  for (const roundDef of roundDefs) {
    if (existingRoundsByNumber.has(roundDef.round_number)) {
      const existing = existingRoundsByNumber.get(roundDef.round_number)!;
      roundIdByName.set(roundDef.name, existing.id);
      console.log(`Found existing round '${roundDef.name}': ${existing.id}`);
    } else {
      const { data: newRound, error: roundErr } = await supabase
        .from("rounds")
        .insert({
          competition_id: competitionId,
          name: roundDef.name,
          round_number: roundDef.round_number,
          status: "scored",
          sporting_stage_id: roundDef.sporting_stage_id,
        })
        .select("id")
        .single();

      if (roundErr) throw new Error(`Round insert failed (${roundDef.name}): ${roundErr.message}`);
      roundIdByName.set(roundDef.name, newRound.id);
      console.log(`Created round '${roundDef.name}': ${newRound.id}`);
    }
  }

  // ---- 0.4 Events + event_prediction_types --------------------------------

  const allEventSpecs = [...GROUP_STAGE_EVENTS, ...KNOCKOUT_EVENTS, ...FINAL_EVENTS];
  const eventIdByName = new Map<string, string>();
  // eptId stored as "eventId:predType"
  const eptByKey = new Map<string, { id: string; points: number; partial_points: number; config: Record<string, unknown> | null }>();

  const allExternalIds = allEventSpecs.map(
    (e) => `lotr-cup:${e.name.toLowerCase().replace(/[\s']/g, "-")}`,
  );

  const { data: existingEvents, error: eventLookupErr } = await supabase
    .from("events")
    .select("id, external_event_id, event_name")
    .eq("competition_id", competitionId)
    .in("external_event_id", allExternalIds);

  if (eventLookupErr) throw new Error(`Events lookup failed: ${eventLookupErr.message}`);

  const idByExternal = new Map<string, string>();
  for (const e of existingEvents ?? []) {
    if (e.external_event_id) idByExternal.set(e.external_event_id, e.id);
  }

  for (const eventSpec of allEventSpecs) {
    const extId = `lotr-cup:${eventSpec.name.toLowerCase().replace(/[\s']/g, "-")}`;
    let eventId: string;

    if (idByExternal.has(extId)) {
      eventId = idByExternal.get(extId)!;
      console.log(`Found existing event '${eventSpec.name}': ${eventId}`);
    } else {
      const roundId = roundIdByName.get(eventSpec.round)!;
      const { data: newEvent, error: eventErr } = await supabase
        .from("events")
        .insert({
          competition_id: competitionId,
          round_id: roundId,
          event_name: eventSpec.name,
          sport: "soccer",
          status: "resulted",
          lock_time: pastTime,
          start_time: pastTime,
          external_event_id: extId,
          result_confirmed: true,
        })
        .select("id")
        .single();

      if (eventErr) throw new Error(`Event insert failed (${eventSpec.name}): ${eventErr.message}`);
      eventId = newEvent.id;
      idByExternal.set(extId, eventId);
      console.log(`Created event '${eventSpec.name}': ${eventId}`);
    }

    eventIdByName.set(eventSpec.name, eventId);
  }

  // Fetch existing EPTs for all events
  const allEventIds = Array.from(eventIdByName.values());

  const { data: existingEpts, error: eptLookupErr } = await supabase
    .from("event_prediction_types")
    .select("id, event_id, prediction_type, points, partial_points, config")
    .in("event_id", allEventIds);

  if (eptLookupErr) throw new Error(`EPT lookup failed: ${eptLookupErr.message}`);

  for (const ept of existingEpts ?? []) {
    eptByKey.set(`${ept.event_id}:${ept.prediction_type}`, {
      id: ept.id,
      points: ept.points,
      partial_points: ept.partial_points,
      config: ept.config,
    });
  }

  // Create missing EPTs
  for (const eventSpec of allEventSpecs) {
    const eventId = eventIdByName.get(eventSpec.name)!;

    const winnerKey = `${eventId}:winner`;
    if (!eptByKey.has(winnerKey)) {
      const { data: winnerEpt, error: winnerErr } = await supabase
        .from("event_prediction_types")
        .insert({
          event_id: eventId,
          prediction_type: "winner",
          points: 2,
          partial_points: 0,
          // allow_draw=true required for draw results to score (not void)
          config: { options: ["Home", "Draw", "Away"], allow_draw: true },
        })
        .select("id, points, partial_points, config")
        .single();

      if (winnerErr) throw new Error(`Winner EPT insert failed (${eventSpec.name}): ${winnerErr.message}`);
      eptByKey.set(winnerKey, winnerEpt);
      console.log(`Created winner EPT for '${eventSpec.name}'`);
    }

    const exactKey = `${eventId}:exact_score`;
    if (!eptByKey.has(exactKey)) {
      const { data: exactEpt, error: exactErr } = await supabase
        .from("event_prediction_types")
        .insert({
          event_id: eventId,
          prediction_type: "exact_score",
          points: 3,
          partial_points: 0,
          config: {},
        })
        .select("id, points, partial_points, config")
        .single();

      if (exactErr) throw new Error(`Exact score EPT insert failed (${eventSpec.name}): ${exactErr.message}`);
      eptByKey.set(exactKey, exactEpt);
      console.log(`Created exact_score EPT for '${eventSpec.name}'`);
    }
  }

  // ---- 0.5 Competition members + classification memberships ---------------

  const allMemberDefs = USERS.map((u) => ({
    id: u.id,
    label: u.label,
    role: u.id === SUPERADMIN_ID ? "admin" : "participant",
  }));

  const { data: existingMembers, error: memberLookupErr } = await supabase
    .from("competition_members")
    .select("user_id")
    .eq("competition_id", competitionId);

  if (memberLookupErr) throw new Error(`Members lookup failed: ${memberLookupErr.message}`);

  const existingMemberIds = new Set((existingMembers ?? []).map((m: { user_id: string }) => m.user_id));

  for (const member of allMemberDefs) {
    if (!existingMemberIds.has(member.id)) {
      const { error: memberErr } = await supabase
        .from("competition_members")
        .insert({ competition_id: competitionId, user_id: member.id, role: member.role });

      if (memberErr) throw new Error(`Member insert failed (${member.label}): ${memberErr.message}`);
      console.log(`Enrolled ${member.label}`);
    }
  }

  // Classification memberships
  for (const classId of [overallClassId, formatClassId]) {
    const { data: existingCm, error: cmLookupErr } = await supabase
      .from("classification_memberships")
      .select("user_id")
      .eq("classification_id", classId);

    if (cmLookupErr) throw new Error(`CM lookup failed: ${cmLookupErr.message}`);

    const existingCmIds = new Set((existingCm ?? []).map((m: { user_id: string }) => m.user_id));

    for (const member of allMemberDefs) {
      if (!existingCmIds.has(member.id)) {
        const { error: cmErr } = await supabase
          .from("classification_memberships")
          .insert({
            classification_id: classId,
            competition_id: competitionId,
            user_id: member.id,
            status: "active",
          });

        if (cmErr) throw new Error(`CM insert failed (${member.label}): ${cmErr.message}`);
      }
    }
  }

  console.log("Classification memberships ready");

  // ---- 0.6 Format prediction groups ---------------------------------------

  const groupDefs = [
    {
      group_number: 1,
      group_name: "Group A",
      members: USERS.filter((u) => u.group === 1).map((u) => u.id),
    },
    {
      group_number: 2,
      group_name: "Group B",
      members: USERS.filter((u) => u.group === 2).map((u) => u.id),
    },
  ];

  const groupIdByNumber = new Map<number, string>();

  const { data: existingGroups, error: groupLookupErr } = await supabase
    .from("format_prediction_groups")
    .select("id, group_number")
    .eq("classification_id", formatClassId);

  if (groupLookupErr) throw new Error(`Groups lookup failed: ${groupLookupErr.message}`);

  for (const g of existingGroups ?? []) groupIdByNumber.set(g.group_number, g.id);

  for (const groupDef of groupDefs) {
    let groupId: string;

    if (groupIdByNumber.has(groupDef.group_number)) {
      groupId = groupIdByNumber.get(groupDef.group_number)!;
      console.log(`Found existing group ${groupDef.group_name}: ${groupId}`);
    } else {
      const { data: newGroup, error: groupErr } = await supabase
        .from("format_prediction_groups")
        .insert({
          classification_id: formatClassId,
          competition_id: competitionId,
          group_name: groupDef.group_name,
          group_number: groupDef.group_number,
          target_size: 4,
          metadata: {},
        })
        .select("id")
        .single();

      if (groupErr) throw new Error(`Group insert failed (${groupDef.group_name}): ${groupErr.message}`);
      groupId = newGroup.id;
      groupIdByNumber.set(groupDef.group_number, groupId);
      console.log(`Created group ${groupDef.group_name}: ${groupId}`);
    }

    // Group memberships
    const { data: existingGm, error: gmLookupErr } = await supabase
      .from("format_group_memberships")
      .select("user_id")
      .eq("group_id", groupId);

    if (gmLookupErr) throw new Error(`Group memberships lookup failed: ${gmLookupErr.message}`);

    const existingGmIds = new Set((existingGm ?? []).map((m: { user_id: string }) => m.user_id));

    for (let i = 0; i < groupDef.members.length; i++) {
      const userId = groupDef.members[i];
      if (!existingGmIds.has(userId)) {
        const { error: gmErr } = await supabase
          .from("format_group_memberships")
          .insert({
            group_id: groupId,
            classification_id: formatClassId,
            user_id: userId,
            seed_position: i + 1,
            status: "active",
          });

        if (gmErr) throw new Error(`Group membership insert failed: ${gmErr.message}`);
      }
    }
  }

  console.log("Format prediction groups ready");

  // ---- 0.7 classification_events (event -> sporting stage mapping) ---------
  // Required by computeFormatGroupStandings() which queries classification_events
  // by sporting_stage_id to know which events count for each stage.

  const classificationEventDefs = [
    ...GROUP_STAGE_EVENTS.map((e) => ({
      eventName: e.name,
      sportingStageId: STAGE_GROUP_MATCHDAY_3,
    })),
    ...KNOCKOUT_EVENTS.map((e) => ({
      eventName: e.name,
      sportingStageId: STAGE_ROUND_OF_32,
    })),
    ...FINAL_EVENTS.map((e) => ({
      eventName: e.name,
      sportingStageId: STAGE_FINAL,
    })),
  ];

  const { data: existingCe, error: ceLookupErr } = await supabase
    .from("classification_events")
    .select("event_id, classification_id, sporting_stage_id")
    .eq("competition_id", competitionId)
    .eq("classification_id", formatClassId);

  if (ceLookupErr) throw new Error(`classification_events lookup failed: ${ceLookupErr.message}`);

  const existingCeSet = new Set(
    (existingCe ?? []).map((ce: { event_id: string }) => ce.event_id),
  );

  for (const ceDef of classificationEventDefs) {
    const eventId = eventIdByName.get(ceDef.eventName);
    if (!eventId) throw new Error(`No eventId for ${ceDef.eventName}`);

    if (!existingCeSet.has(eventId)) {
      const { error: ceErr } = await supabase
        .from("classification_events")
        .insert({
          classification_id: formatClassId,
          competition_id: competitionId,
          event_id: eventId,
          sporting_stage_id: ceDef.sportingStageId,
          counts_for_scoring: true,
          counts_for_elimination: true,
          metadata: {},
        });

      if (ceErr) throw new Error(`classification_events insert failed (${ceDef.eventName}): ${ceErr.message}`);
    }
  }

  console.log("classification_events ready");

  // ---- 0.8 Seed predictions -----------------------------------------------

  // Gather all existing predictions to skip duplicates
  const { data: existingPreds, error: predLookupErr } = await supabase
    .from("predictions")
    .select("event_prediction_type_id, user_id")
    .in("event_id", allEventIds);

  if (predLookupErr) throw new Error(`Predictions lookup failed: ${predLookupErr.message}`);

  const existingPredSet = new Set<string>();
  for (const p of existingPreds ?? []) {
    existingPredSet.add(`${p.event_prediction_type_id}:${p.user_id}`);
  }

  const predRowsToInsert: Array<{
    event_prediction_type_id: string;
    event_id: string;
    user_id: string;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
    points_awarded: number;
    is_partial: boolean;
    is_correct: boolean | null;
  }> = [];

  for (const eventSpec of allEventSpecs) {
    const eventId = eventIdByName.get(eventSpec.name)!;
    const winnerEpt = eptByKey.get(`${eventId}:winner`)!;
    const exactEpt  = eptByKey.get(`${eventId}:exact_score`)!;

    for (const user of USERS) {
      const predSpec = eventSpec.predictions[user.label];

      // winner prediction
      const winnerPredKey = `${winnerEpt.id}:${user.id}`;
      if (!existingPredSet.has(winnerPredKey)) {
        predRowsToInsert.push({
          event_prediction_type_id: winnerEpt.id,
          event_id: eventId,
          user_id: user.id,
          prediction_type: "winner",
          prediction_data: { winner: predSpec.winner },
          points_awarded: 0,
          is_partial: false,
          is_correct: null,
        });
      }

      // exact_score prediction
      const exactPredKey = `${exactEpt.id}:${user.id}`;
      if (!existingPredSet.has(exactPredKey)) {
        predRowsToInsert.push({
          event_prediction_type_id: exactEpt.id,
          event_id: eventId,
          user_id: user.id,
          prediction_type: "exact_score",
          prediction_data: { home: predSpec.score.home, away: predSpec.score.away },
          points_awarded: 0,
          is_partial: false,
          is_correct: null,
        });
      }
    }
  }

  if (predRowsToInsert.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < predRowsToInsert.length; i += BATCH) {
      const batch = predRowsToInsert.slice(i, i + BATCH);
      const { error: predErr } = await supabase
        .from("predictions")
        .upsert(batch, { onConflict: "event_prediction_type_id,user_id" });

      if (predErr) throw new Error(`Predictions upsert failed: ${predErr.message}`);
    }
    console.log(`Seeded ${predRowsToInsert.length} predictions`);
  } else {
    console.log("All predictions already exist");
  }

  console.log("\nPhase 0 complete: competition + data ready\n");

  // =========================================================================
  // Phase 1: Score Group Stage using REAL scorePrediction()
  // =========================================================================
  section("API TEST: Phase 1 — Scoring with real scorePrediction()");

  let phase1Pass = 0;
  let phase1Total = 0;
  const phase1Failures: string[] = [];

  for (const eventSpec of GROUP_STAGE_EVENTS) {
    const eventId = eventIdByName.get(eventSpec.name)!;
    const resultData = buildResultData(eventSpec);

    // Set result on event
    const { error: resultErr } = await supabase
      .from("events")
      .update({
        result_data: resultData,
        result_confirmed: true,
        status: "resulted",
      })
      .eq("id", eventId);

    if (resultErr) throw new Error(`Result update failed (${eventSpec.name}): ${resultErr.message}`);

    // Fetch all predictions for this event
    const { data: preds, error: predsErr } = await supabase
      .from("predictions")
      .select("id, user_id, prediction_type, prediction_data, event_prediction_type_id")
      .eq("event_id", eventId);

    if (predsErr) throw new Error(`Predictions fetch failed (${eventSpec.name}): ${predsErr.message}`);

    for (const pred of preds ?? []) {
      const eptData = eptByKey.get(`${eventId}:${pred.prediction_type}`);
      if (!eptData) continue;

      // *** Call the REAL scorePrediction() from src/lib/scoring.ts ***
      const scored = scorePrediction(
        pred.prediction_type as Parameters<typeof scorePrediction>[0],
        pred.prediction_data as Record<string, unknown>,
        resultData,
        {
          points: eptData.points,
          partial_points: eptData.partial_points,
          config: eptData.config,
        },
      );

      // Write scored result back to DB
      const { error: updateErr } = await supabase
        .from("predictions")
        .update({
          is_correct: scored.is_correct,
          is_partial: scored.is_partial,
          points_awarded: scored.points_awarded,
        })
        .eq("id", pred.id);

      if (updateErr) throw new Error(`Prediction update failed: ${updateErr.message}`);

      // Verify against expected: expected points come from the sum per user per event.
      // Each event has 2 prediction types; the expectedPts covers both combined.
      // We verify by comparing the sum at the end (Phase 2), but here we can check
      // individual predictions where we know the split.
      //
      // The expectedPts in the spec covers winner+exact_score combined.
      // winner: 2pts full, exact_score: 3pts full.
      // If expectedPts=5: winner correct (2pts) + exact correct (3pts).
      // If expectedPts=2: winner correct (2pts) only OR exact correct (3pts)... actually:
      //   - 2pts means winner correct, exact wrong
      //   - 3pts means winner wrong, exact correct (but we have no such case in our data)
      //   - 0pts means both wrong
      // So for per-prediction verification:

      const user = USERS.find((u) => u.id === pred.user_id);
      if (!user) continue;

      const predSpec = eventSpec.predictions[user.label];
      phase1Total++;

      if (pred.prediction_type === "winner") {
        // Expected winner points
        let expectedWinnerPts = 0;
        if (predSpec.winner === eventSpec.result.winner) {
          expectedWinnerPts = 2;
        }
        if (scored.points_awarded === expectedWinnerPts) {
          phase1Pass++;
        } else {
          phase1Failures.push(
            `${eventSpec.name} | ${user.label} | winner | expected=${expectedWinnerPts} actual=${scored.points_awarded} (prediction=${predSpec.winner}, result=${eventSpec.result.winner})`,
          );
        }
      } else if (pred.prediction_type === "exact_score") {
        // Expected exact pts
        const homeMatch = predSpec.score.home === eventSpec.result.homeScore;
        const awayMatch = predSpec.score.away === eventSpec.result.awayScore;
        const expectedExactPts = homeMatch && awayMatch ? 3 : 0;
        if (scored.points_awarded === expectedExactPts) {
          phase1Pass++;
        } else {
          phase1Failures.push(
            `${eventSpec.name} | ${user.label} | exact_score | expected=${expectedExactPts} actual=${scored.points_awarded} (prediction=${predSpec.score.home}-${predSpec.score.away}, result=${eventSpec.result.homeScore}-${eventSpec.result.awayScore})`,
          );
        }
      }
    }
  }

  if (phase1Failures.length > 0) {
    console.log("  Failures:");
    for (const f of phase1Failures) fail(f);
  }
  console.log(`\nRESULT Phase 1: ${phase1Pass}/${phase1Total} predictions scored correctly ${phase1Failures.length === 0 ? "PASS" : "FAIL"}`);

  // =========================================================================
  // Phase 2: Verify group stage standings
  // =========================================================================
  section("API TEST: Phase 2 — Group standings verification");

  // Sum points per user across all group stage events
  const { data: groupStagePreds, error: gsPredsErr } = await supabase
    .from("predictions")
    .select("user_id, points_awarded")
    .in("event_id", GROUP_STAGE_EVENTS.map((e) => eventIdByName.get(e.name)!));

  if (gsPredsErr) throw new Error(`Group stage predictions fetch failed: ${gsPredsErr.message}`);

  const actualTotals = new Map<string, number>();
  for (const pred of groupStagePreds ?? []) {
    const current = actualTotals.get(pred.user_id) ?? 0;
    actualTotals.set(pred.user_id, current + (pred.points_awarded ?? 0));
  }

  let phase2Pass = 0;
  let phase2Total = 0;

  for (const user of USERS) {
    const expected = EXPECTED_GROUP_STAGE_TOTALS[user.label];
    const actual   = actualTotals.get(user.id) ?? 0;
    phase2Total++;

    if (actual === expected) {
      phase2Pass++;
      console.log(`  ${user.label}: ${actual}pts PASS`);
    } else {
      fail(`${user.label}: expected=${expected} actual=${actual}`);
    }
  }

  console.log(`\nRESULT Phase 2: ${phase2Pass}/${phase2Total} ${phase2Pass === phase2Total ? "PASS" : "FAIL"}`);

  // =========================================================================
  // Phase 3: Eliminate using REAL eliminateFromFormat()
  // =========================================================================
  section("REALITY CHECK: Phase 3 — Elimination with real eliminateFromFormat()");

  // Update Group Stage round status to "scored"
  const groupStageRoundId = roundIdByName.get("Group Stage")!;
  await supabase
    .from("rounds")
    .update({ status: "scored" })
    .eq("id", groupStageRoundId);

  console.log(`  Calling eliminateFromFormat(supabase, "${formatClassId}", "${STAGE_GROUP_MATCHDAY_3}")`);

  // *** Call the REAL eliminateFromFormat() from src/lib/tournament/format/elimination.ts ***
  const eliminationResult = await eliminateFromFormat(
    supabase,
    formatClassId,
    STAGE_GROUP_MATCHDAY_3,
  );

  console.log(`  Returned: {`);
  console.log(`    stage_id: "${eliminationResult.stage_id}",`);
  console.log(`    classification_id: "${eliminationResult.classification_id}",`);
  console.log(`    eliminated_user_ids: [${eliminationResult.eliminated_user_ids.map((id) => `"${id}"`).join(", ")}],`);
  console.log(`    survivors: ${eliminationResult.survivors},`);
  console.log(`    target_survivors: ${eliminationResult.target_survivors},`);
  console.log(`  }`);

  const expectedEliminatedIds = EXPECTED_ELIMINATED.map(
    (label) => USERS.find((u) => u.label === label)!.id,
  );

  const phase3Checks: boolean[] = [];

  // Check target_survivors == 6
  const targetOk = eliminationResult.target_survivors === 6;
  phase3Checks.push(targetOk);
  if (targetOk) pass(`target_survivors=6`);
  else fail(`target_survivors expected=6 actual=${eliminationResult.target_survivors}`);

  // Check eliminated count == 2
  const elimCountOk = eliminationResult.eliminated_user_ids.length === 2;
  phase3Checks.push(elimCountOk);
  if (elimCountOk) pass(`eliminated_count=2`);
  else fail(`eliminated_count expected=2 actual=${eliminationResult.eliminated_user_ids.length}`);

  // Check the two eliminated users are Malone and Manning
  for (const expectedId of expectedEliminatedIds) {
    const eliminated = eliminationResult.eliminated_user_ids.includes(expectedId);
    phase3Checks.push(eliminated);
    const label = USERS.find((u) => u.id === expectedId)!.label;
    if (eliminated) pass(`${label} correctly eliminated`);
    else fail(`${label} NOT eliminated (expected to be eliminated)`);
  }

  // Check survivors count
  const survivorsOk = eliminationResult.survivors === 6;
  phase3Checks.push(survivorsOk);
  if (survivorsOk) pass(`survivors=6`);
  else fail(`survivors expected=6 actual=${eliminationResult.survivors}`);

  const phase3AllPass = phase3Checks.every(Boolean);
  console.log(`\nRESULT Phase 3: ${phase3AllPass ? "PASS" : "FAIL"}`);

  // DB state snapshot after elimination
  const { data: cmRows, error: cmRowsErr } = await supabase
    .from("classification_memberships")
    .select("user_id, status")
    .eq("classification_id", formatClassId)
    .order("user_id");

  if (!cmRowsErr) {
    section("EVIDENCE: DB state after elimination (classification_memberships):");
    for (const row of cmRows ?? []) {
      const label = USERS.find((u) => u.id === row.user_id)?.label ?? row.user_id;
      console.log(`  ${label}: ${row.status}`);
    }
  }

  // =========================================================================
  // Phase 4: Knockout scoring
  // =========================================================================
  section("API TEST: Phase 4 — Knockout scoring with real scorePrediction()");

  let phase4Pass = 0;
  let phase4Total = 0;

  for (const eventSpec of KNOCKOUT_EVENTS) {
    const eventId = eventIdByName.get(eventSpec.name)!;
    const resultData = buildResultData(eventSpec);

    await supabase
      .from("events")
      .update({ result_data: resultData, result_confirmed: true, status: "resulted" })
      .eq("id", eventId);

    const { data: preds } = await supabase
      .from("predictions")
      .select("id, user_id, prediction_type, prediction_data, event_prediction_type_id")
      .eq("event_id", eventId);

    for (const pred of preds ?? []) {
      const eptData = eptByKey.get(`${eventId}:${pred.prediction_type}`);
      if (!eptData) continue;

      // *** Call the REAL scorePrediction() ***
      const scored = scorePrediction(
        pred.prediction_type as Parameters<typeof scorePrediction>[0],
        pred.prediction_data as Record<string, unknown>,
        resultData,
        { points: eptData.points, partial_points: eptData.partial_points, config: eptData.config },
      );

      await supabase
        .from("predictions")
        .update({ is_correct: scored.is_correct, is_partial: scored.is_partial, points_awarded: scored.points_awarded })
        .eq("id", pred.id);

      const user = USERS.find((u) => u.id === pred.user_id);
      if (!user) continue;

      const predSpec = eventSpec.predictions[user.label];
      phase4Total++;

      if (pred.prediction_type === "winner") {
        const expectedWinnerPts = predSpec.winner === eventSpec.result.winner ? 2 : 0;
        if (scored.points_awarded === expectedWinnerPts) {
          phase4Pass++;
        } else {
          fail(`${eventSpec.name} | ${user.label} | winner | expected=${expectedWinnerPts} actual=${scored.points_awarded}`);
        }
      } else if (pred.prediction_type === "exact_score") {
        const expectedExactPts =
          predSpec.score.home === eventSpec.result.homeScore &&
          predSpec.score.away === eventSpec.result.awayScore
            ? 3 : 0;
        if (scored.points_awarded === expectedExactPts) {
          phase4Pass++;
        } else {
          fail(`${eventSpec.name} | ${user.label} | exact_score | expected=${expectedExactPts} actual=${scored.points_awarded}`);
        }
      }
    }
  }

  console.log(`\nRESULT Phase 4: ${phase4Pass}/${phase4Total} ${phase4Pass === phase4Total ? "PASS" : "FAIL"}`);

  // =========================================================================
  // Phase 5: Final scoring
  // =========================================================================
  section("API TEST: Phase 5 — Final scoring with real scorePrediction()");

  let phase5Pass = 0;
  let phase5Total = 0;

  for (const eventSpec of FINAL_EVENTS) {
    const eventId = eventIdByName.get(eventSpec.name)!;
    const resultData = buildResultData(eventSpec);

    await supabase
      .from("events")
      .update({ result_data: resultData, result_confirmed: true, status: "resulted" })
      .eq("id", eventId);

    const { data: preds } = await supabase
      .from("predictions")
      .select("id, user_id, prediction_type, prediction_data, event_prediction_type_id")
      .eq("event_id", eventId);

    for (const pred of preds ?? []) {
      const eptData = eptByKey.get(`${eventId}:${pred.prediction_type}`);
      if (!eptData) continue;

      // *** Call the REAL scorePrediction() ***
      const scored = scorePrediction(
        pred.prediction_type as Parameters<typeof scorePrediction>[0],
        pred.prediction_data as Record<string, unknown>,
        resultData,
        { points: eptData.points, partial_points: eptData.partial_points, config: eptData.config },
      );

      await supabase
        .from("predictions")
        .update({ is_correct: scored.is_correct, is_partial: scored.is_partial, points_awarded: scored.points_awarded })
        .eq("id", pred.id);

      const user = USERS.find((u) => u.id === pred.user_id);
      if (!user) continue;

      const predSpec = eventSpec.predictions[user.label];
      phase5Total++;

      if (pred.prediction_type === "winner") {
        const expectedWinnerPts = predSpec.winner === eventSpec.result.winner ? 2 : 0;
        if (scored.points_awarded === expectedWinnerPts) {
          phase5Pass++;
        } else {
          fail(`${eventSpec.name} | ${user.label} | winner | expected=${expectedWinnerPts} actual=${scored.points_awarded}`);
        }
      } else if (pred.prediction_type === "exact_score") {
        const expectedExactPts =
          predSpec.score.home === eventSpec.result.homeScore &&
          predSpec.score.away === eventSpec.result.awayScore
            ? 3 : 0;
        if (scored.points_awarded === expectedExactPts) {
          phase5Pass++;
        } else {
          fail(`${eventSpec.name} | ${user.label} | exact_score | expected=${expectedExactPts} actual=${scored.points_awarded}`);
        }
      }
    }
  }

  console.log(`\nRESULT Phase 5: ${phase5Pass}/${phase5Total} ${phase5Pass === phase5Total ? "PASS" : "FAIL"}`);

  // =========================================================================
  // Phase 6: Cleanup
  // =========================================================================
  section("Phase 6 — Cleanup");

  const { error: deleteErr } = await supabase
    .from("competitions")
    .delete()
    .eq("id", competitionId);

  if (deleteErr) {
    fail(`Cleanup failed: ${deleteErr.message}`);
  } else {
    pass(`Competition ${competitionId} deleted (cascade)`);
  }

  // =========================================================================
  // Final verdict
  // =========================================================================
  section("=".repeat(60));

  const phaseResults = [
    { phase: 1, ok: phase1Failures.length === 0 },
    { phase: 2, ok: phase2Pass === phase2Total },
    { phase: 3, ok: phase3AllPass },
    { phase: 4, ok: phase4Pass === phase4Total },
    { phase: 5, ok: phase5Pass === phase5Total },
  ];

  const passed = phaseResults.filter((r) => r.ok).length;

  console.log(`FINAL VERDICT: ${passed}/${phaseResults.length} phases passed.`);
  for (const r of phaseResults) {
    console.log(`  Phase ${r.phase}: ${r.ok ? "PASS" : "FAIL"}`);
  }

  if (passed === phaseResults.length) {
    console.log("\nPRODUCTION READY: All real application functions behave correctly.\n");
  } else {
    console.log("\nNEEDS WORK: Some phases failed — review output above.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nTest failed:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
