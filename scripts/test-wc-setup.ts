/**
 * test-wc-setup.ts — Create a compressed World Cup stress test competition.
 *
 * Creates a self-contained "WC Stress Test" competition with:
 *   - 2 classifications (overall leaderboard + format elimination)
 *   - 8 rounds (MD1-MD3, R32, R16, QF, SF, Final)
 *   - 16 events with fake fantasy-land teams
 *   - 2 event_prediction_types per event (winner + exact_score)
 *   - 8 enrolled users (superadmin + test user + 6 bots)
 *   - classification_memberships for all users in both classifications
 *   - 2 format prediction groups of 4
 *   - Bot predictions seeded for all 7 non-test entrants
 *
 * Usage:
 *   npx tsx scripts/test-wc-setup.ts          # dry run (prints plan)
 *   npx tsx scripts/test-wc-setup.ts --commit  # writes to the DB
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Writes /tmp/test-wc-state.json with all IDs for the advance script.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

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
// constants
// ---------------------------------------------------------------------------

const SUPERADMIN_ID = "8c7e2e1b-0564-4d86-93e2-85ecf00f1e00";
const TEST_USER_ID = "ebe5686c-f688-4495-8792-84f7ffc533a1";

const BOT_USERS = [
  { id: "66f6a822-b20b-402a-977d-18e8f03e4ce1", label: "Malone" },
  { id: "2d49977a-3edc-4760-95d1-35dca104422a", label: "Jay" },
  { id: "3a2e7d15-cd3e-427f-a94d-b6fa608bfd7c", label: "Manning" },
  { id: "1950786d-7216-42a3-aa87-c1088f74ba4e", label: "Paddy" },
  { id: "5345b650-e8a5-415f-8d0e-4975f40fbe08", label: "Parker" },
  { id: "10c6c61e-597f-457a-ad5d-c841923852f4", label: "Bohanna" },
] as const;

// All non-test-user entrants who receive seeded bot predictions
const BOT_PREDICTOR_IDS = [SUPERADMIN_ID, ...BOT_USERS.map((b) => b.id)];

const ROUND_DEFS = [
  { round_number: 1, name: "MD1", sporting_stage_id: "b0000000-0000-0000-0001-000000000026" },
  { round_number: 2, name: "MD2", sporting_stage_id: "b0000000-0000-0000-0002-000000000026" },
  { round_number: 3, name: "MD3", sporting_stage_id: "b0000000-0000-0000-0003-000000000026" },
  { round_number: 4, name: "R32", sporting_stage_id: "b0000000-0000-0000-0004-000000000026" },
  { round_number: 5, name: "R16", sporting_stage_id: "b0000000-0000-0000-0005-000000000026" },
  { round_number: 6, name: "QF",  sporting_stage_id: "b0000000-0000-0000-0006-000000000026" },
  { round_number: 7, name: "SF",  sporting_stage_id: "b0000000-0000-0000-0007-000000000026" },
  { round_number: 8, name: "Final", sporting_stage_id: "b0000000-0000-0000-0009-000000000026" },
] as const;

// 2 events per round: [home, away] pairs
const EVENT_DEFS: Record<string, [string, string][]> = {
  MD1:   [["Mordor", "Gondor"],          ["Kanto", "Johto"]],
  MD2:   [["Narnia", "Hogwarts"],         ["Wakanda", "Asgard"]],
  MD3:   [["Tatooine", "Coruscant"],      ["Hyrule", "Mushroom Kingdom"]],
  R32:   [["Mordor", "Hogwarts"],         ["Kanto", "Wakanda"]],
  R16:   [["Gondor", "Narnia"],           ["Johto", "Asgard"]],
  QF:    [["Mordor", "Kanto"],            ["Gondor", "Asgard"]],
  SF:    [["Mordor", "Gondor"],           ["Kanto", "Asgard"]],
  Final: [["Mordor", "Kanto"],            ["Gondor", "Asgard"]],
};

// Elimination curve for 8 entrants
const CURVE_FOR_8 = [
  { stage: "start",         remaining: 8 },
  { stage: "group_stage",   remaining: 6 },
  { stage: "round_of_32",   remaining: 5 },
  { stage: "round_of_16",   remaining: 4 },
  { stage: "quarter_finals",remaining: 3 },
  { stage: "semi_finals",   remaining: 2 },
  { stage: "final",         remaining: 1 },
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function weightedWinner(): string {
  const r = Math.random();
  if (r < 0.45) return "Home";
  if (r < 0.55) return "Draw";
  return "Away";
}

function randomScore(): { home: number; away: number } {
  return {
    home: Math.floor(Math.random() * 4),
    away: Math.floor(Math.random() * 4),
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nWC Stress Test setup — ${COMMIT ? "COMMIT" : "DRY RUN"} mode\n`);

  const now = new Date();
  const lockTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  const startTime = new Date(lockTime.getTime() + 10 * 60 * 1000); // lock + 10 min

  // -------------------------------------------------------------------------
  // 1. Competition
  // -------------------------------------------------------------------------

  let competitionId: string;

  // Check for existing stress test competition (idempotent)
  const { data: existingComp, error: existingCompErr } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("invite_code", "STRESSTEST")
    .maybeSingle();

  if (existingCompErr) throw new Error(`Competition lookup failed: ${existingCompErr.message}`);

  if (existingComp) {
    competitionId = existingComp.id;
    console.log(`Found existing competition: ${existingComp.name} (${competitionId})`);
  } else {
    console.log(`Would create competition: "WC Stress Test" (invite_code: STRESSTEST)`);

    if (COMMIT) {
      const { data: newComp, error: compErr } = await supabase
        .from("competitions")
        .insert({
          name: "WC Stress Test",
          status: "active",
          visibility: "private",
          product_mode: null,
          tournament_id: null,
          created_by: SUPERADMIN_ID,
          type: "fixed",
          scoring_rules: { points_per_outcome: 2, points_per_exact: 3 },
          allow_prediction_updates: true,
          invite_code: "STRESSTEST",
        })
        .select("id")
        .single();

      if (compErr) throw new Error(`Competition insert failed: ${compErr.message}`);
      competitionId = newComp.id;
      console.log(`Created competition: ${competitionId}`);
    } else {
      competitionId = "<competition-id>";
    }
  }

  // -------------------------------------------------------------------------
  // 2. Classifications
  // -------------------------------------------------------------------------

  let overallClassId: string;
  let formatClassId: string;

  if (!COMMIT) {
    console.log(`Would create 2 classifications: "Overall" (leaderboard) + "Format" (format_elimination)`);
    overallClassId = "<overall-class-id>";
    formatClassId = "<format-class-id>";
  } else {
    // Check for existing
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
          name: "Format",
          status: "active",
          scoring_strategy: {},
          elimination_strategy: { type: "curve", entrant_count: 8 },
          config: {
            group_size: 4,
            elimination_curve: { curve: CURVE_FOR_8 },
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
  }

  // -------------------------------------------------------------------------
  // 3. Rounds
  // -------------------------------------------------------------------------

  const roundIdByName = new Map<string, string>();

  if (!COMMIT) {
    console.log(`Would create 8 rounds: ${ROUND_DEFS.map((r) => r.name).join(", ")}`);
    for (const r of ROUND_DEFS) roundIdByName.set(r.name, `<round-id-${r.name}>`);
  } else {
    // Check for existing rounds
    const { data: existingRounds, error: roundLookupErr } = await supabase
      .from("rounds")
      .select("id, name, round_number")
      .eq("competition_id", competitionId);

    if (roundLookupErr) throw new Error(`Rounds lookup failed: ${roundLookupErr.message}`);

    const existingByNumber = new Map<number, { id: string; name: string }>();
    for (const r of existingRounds ?? []) existingByNumber.set(r.round_number, r);

    for (const roundDef of ROUND_DEFS) {
      if (existingByNumber.has(roundDef.round_number)) {
        const existing = existingByNumber.get(roundDef.round_number)!;
        roundIdByName.set(roundDef.name, existing.id);
        console.log(`Found existing round ${roundDef.name}: ${existing.id}`);
      } else {
        const { data: newRound, error: roundErr } = await supabase
          .from("rounds")
          .insert({
            competition_id: competitionId,
            name: roundDef.name,
            round_number: roundDef.round_number,
            status: "draft",
            sporting_stage_id: roundDef.sporting_stage_id,
          })
          .select("id")
          .single();

        if (roundErr) throw new Error(`Round insert failed (${roundDef.name}): ${roundErr.message}`);
        roundIdByName.set(roundDef.name, newRound.id);
        console.log(`Created round ${roundDef.name}: ${newRound.id}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Events + event_prediction_types
  // -------------------------------------------------------------------------

  // Key: "roundName:eventName" (composite to handle same matchup in different rounds)
  // e.g. "QF:Mordor vs Kanto" and "Final:Mordor vs Kanto" are distinct events
  const eventIdByKey = new Map<string, string>();
  // Map: "eventId:predType" -> eptId
  const eptIdByKey = new Map<string, string>();

  // Helper to build the composite event key and external_event_id
  const eventKey = (roundName: string, home: string, away: string) =>
    `${roundName}:${home} vs ${away}`;
  const externalEventId = (roundName: string, home: string, away: string) =>
    `stress-test:${roundName}:${home.toLowerCase().replace(/\s+/g, "-")}-vs-${away.toLowerCase().replace(/\s+/g, "-")}`;

  if (!COMMIT) {
    let totalEvents = 0;
    for (const roundDef of ROUND_DEFS) {
      const matches = EVENT_DEFS[roundDef.name];
      for (const [home, away] of matches) {
        const eventName = `${home} vs ${away}`;
        console.log(
          `  Would create event: [${roundDef.name}] ${eventName} (lock: ${lockTime.toISOString()})`,
        );
        totalEvents++;
      }
    }
    console.log(`Would create ${totalEvents} events + ${totalEvents * 2} event_prediction_types`);
  } else {
    // Check existing events by external_event_id (idempotent)
    const allExternalIds = ROUND_DEFS.flatMap((r) =>
      EVENT_DEFS[r.name].map(([home, away]) => externalEventId(r.name, home, away)),
    );

    const { data: existingEvents, error: eventLookupErr } = await supabase
      .from("events")
      .select("id, external_event_id, round_id, event_name")
      .eq("competition_id", competitionId)
      .in("external_event_id", allExternalIds);

    if (eventLookupErr) throw new Error(`Events lookup failed: ${eventLookupErr.message}`);

    // Reverse-map: external_event_id -> id
    const idByExternal = new Map<string, string>();
    for (const e of existingEvents ?? []) {
      if (e.external_event_id) idByExternal.set(e.external_event_id, e.id);
    }

    // Collect all existing event IDs to look up EPTs
    const existingEventIds = Array.from(idByExternal.values());
    if (existingEventIds.length > 0) {
      const { data: existingEpts, error: eptLookupErr } = await supabase
        .from("event_prediction_types")
        .select("id, event_id, prediction_type")
        .in("event_id", existingEventIds);

      if (eptLookupErr) throw new Error(`EPT lookup failed: ${eptLookupErr.message}`);

      for (const ept of existingEpts ?? []) {
        eptIdByKey.set(`${ept.event_id}:${ept.prediction_type}`, ept.id);
      }
    }

    for (const roundDef of ROUND_DEFS) {
      const roundId = roundIdByName.get(roundDef.name)!;
      const matches = EVENT_DEFS[roundDef.name];

      for (const [home, away] of matches) {
        const eventName = `${home} vs ${away}`;
        const extId = externalEventId(roundDef.name, home, away);
        const ek = eventKey(roundDef.name, home, away);

        let eventId: string;
        if (idByExternal.has(extId)) {
          eventId = idByExternal.get(extId)!;
          eventIdByKey.set(ek, eventId);
          console.log(`Found existing event [${roundDef.name}] ${eventName}: ${eventId}`);
        } else {
          const { data: newEvent, error: eventErr } = await supabase
            .from("events")
            .insert({
              competition_id: competitionId,
              round_id: roundId,
              event_name: eventName,
              sport: "soccer",
              status: "upcoming",
              lock_time: lockTime.toISOString(),
              start_time: startTime.toISOString(),
              external_event_id: extId,
            })
            .select("id")
            .single();

          if (eventErr) throw new Error(`Event insert failed (${eventName}): ${eventErr.message}`);
          eventId = newEvent.id;
          eventIdByKey.set(ek, eventId);
          idByExternal.set(extId, eventId);
          console.log(`Created event [${roundDef.name}] ${eventName}: ${eventId}`);
        }

        // winner EPT
        const winnerKey = `${eventId}:winner`;
        if (!eptIdByKey.has(winnerKey)) {
          const { data: winnerEpt, error: winnerErr } = await supabase
            .from("event_prediction_types")
            .insert({
              event_id: eventId,
              prediction_type: "winner",
              points: 2,
              partial_points: 0,
              config: { options: ["Home", "Draw", "Away"] },
            })
            .select("id")
            .single();

          if (winnerErr) throw new Error(`Winner EPT insert failed (${eventName}): ${winnerErr.message}`);
          eptIdByKey.set(winnerKey, winnerEpt.id);
        }

        // exact_score EPT
        const exactKey = `${eventId}:exact_score`;
        if (!eptIdByKey.has(exactKey)) {
          const { data: exactEpt, error: exactErr } = await supabase
            .from("event_prediction_types")
            .insert({
              event_id: eventId,
              prediction_type: "exact_score",
              points: 3,
              partial_points: 0,
              config: {},
            })
            .select("id")
            .single();

          if (exactErr) throw new Error(`Exact score EPT insert failed (${eventName}): ${exactErr.message}`);
          eptIdByKey.set(exactKey, exactEpt.id);
        }
      }
    }

    console.log(`Events ready: ${eventIdByKey.size}, EPTs ready: ${eptIdByKey.size}`);
  }

  // -------------------------------------------------------------------------
  // 5. Competition members + classification memberships
  // -------------------------------------------------------------------------

  const allMembers = [
    { id: SUPERADMIN_ID, role: "admin" as const, label: "Superadmin" },
    { id: TEST_USER_ID, role: "participant" as const, label: "Test user" },
    ...BOT_USERS.map((b) => ({ id: b.id, role: "participant" as const, label: b.label })),
  ];

  if (!COMMIT) {
    console.log(`Would enrol ${allMembers.length} users as competition_members`);
    console.log(`Would create ${allMembers.length * 2} classification_memberships (both classifications)`);
  } else {
    // Check existing competition members
    const { data: existingMembers, error: memberLookupErr } = await supabase
      .from("competition_members")
      .select("id, user_id")
      .eq("competition_id", competitionId);

    if (memberLookupErr) throw new Error(`Members lookup failed: ${memberLookupErr.message}`);

    const existingMemberIds = new Set((existingMembers ?? []).map((m) => m.user_id));

    for (const member of allMembers) {
      if (!existingMemberIds.has(member.id)) {
        const { error: memberErr } = await supabase
          .from("competition_members")
          .insert({
            competition_id: competitionId,
            user_id: member.id,
            role: member.role,
          });

        if (memberErr) {
          throw new Error(`Member insert failed (${member.label}): ${memberErr.message}`);
        }
        console.log(`Enrolled ${member.label} as ${member.role}`);
      } else {
        console.log(`${member.label} already a member`);
      }
    }

    // classification_memberships for both classifications
    const { data: existingCmOverall, error: cmOverallErr } = await supabase
      .from("classification_memberships")
      .select("user_id")
      .eq("classification_id", overallClassId);

    if (cmOverallErr) throw new Error(`CM overall lookup failed: ${cmOverallErr.message}`);

    const { data: existingCmFormat, error: cmFormatErr } = await supabase
      .from("classification_memberships")
      .select("user_id")
      .eq("classification_id", formatClassId);

    if (cmFormatErr) throw new Error(`CM format lookup failed: ${cmFormatErr.message}`);

    const existingCmOverallIds = new Set((existingCmOverall ?? []).map((m) => m.user_id));
    const existingCmFormatIds = new Set((existingCmFormat ?? []).map((m) => m.user_id));

    for (const member of allMembers) {
      if (!existingCmOverallIds.has(member.id)) {
        const { error: cmErr } = await supabase
          .from("classification_memberships")
          .insert({
            classification_id: overallClassId,
            competition_id: competitionId,
            user_id: member.id,
            status: "active",
          });

        if (cmErr) throw new Error(`Overall CM insert failed (${member.label}): ${cmErr.message}`);
        console.log(`Added ${member.label} to overall classification`);
      }

      if (!existingCmFormatIds.has(member.id)) {
        const { error: cmErr } = await supabase
          .from("classification_memberships")
          .insert({
            classification_id: formatClassId,
            competition_id: competitionId,
            user_id: member.id,
            status: "active",
          });

        if (cmErr) throw new Error(`Format CM insert failed (${member.label}): ${cmErr.message}`);
        console.log(`Added ${member.label} to format classification`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. Format prediction groups
  // -------------------------------------------------------------------------

  // Group 1: Superadmin, Test user, Malone, Jay
  // Group 2: Manning, Paddy, Parker, Bohanna
  const groupDefs = [
    {
      group_number: 1,
      group_name: "Group 1",
      members: [
        SUPERADMIN_ID,
        TEST_USER_ID,
        BOT_USERS[0].id, // Malone
        BOT_USERS[1].id, // Jay
      ],
    },
    {
      group_number: 2,
      group_name: "Group 2",
      members: [
        BOT_USERS[2].id, // Manning
        BOT_USERS[3].id, // Paddy
        BOT_USERS[4].id, // Parker
        BOT_USERS[5].id, // Bohanna
      ],
    },
  ];

  let group1Id: string;
  let group2Id: string;

  if (!COMMIT) {
    console.log(`Would create 2 format prediction groups of 4`);
    group1Id = "<group-1-id>";
    group2Id = "<group-2-id>";
  } else {
    // Check existing groups
    const { data: existingGroups, error: groupLookupErr } = await supabase
      .from("format_prediction_groups")
      .select("id, group_number")
      .eq("classification_id", formatClassId);

    if (groupLookupErr) throw new Error(`Groups lookup failed: ${groupLookupErr.message}`);

    const existingGroupByNumber = new Map<number, string>();
    for (const g of existingGroups ?? []) existingGroupByNumber.set(g.group_number, g.id);

    const resolvedGroupIds: string[] = [];

    for (const groupDef of groupDefs) {
      let groupId: string;

      if (existingGroupByNumber.has(groupDef.group_number)) {
        groupId = existingGroupByNumber.get(groupDef.group_number)!;
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
        console.log(`Created group ${groupDef.group_name}: ${groupId}`);
      }

      resolvedGroupIds.push(groupId);

      // Check existing memberships for this group
      const { data: existingGroupMembers, error: gmLookupErr } = await supabase
        .from("format_group_memberships")
        .select("user_id")
        .eq("group_id", groupId);

      if (gmLookupErr) throw new Error(`Group memberships lookup failed: ${gmLookupErr.message}`);

      const existingGroupMemberIds = new Set((existingGroupMembers ?? []).map((m) => m.user_id));

      for (let i = 0; i < groupDef.members.length; i++) {
        const userId = groupDef.members[i];
        if (!existingGroupMemberIds.has(userId)) {
          const { error: gmErr } = await supabase
            .from("format_group_memberships")
            .insert({
              group_id: groupId,
              classification_id: formatClassId,
              user_id: userId,
              seed_position: i + 1,
              status: "active",
            });

          if (gmErr) throw new Error(`Group membership insert failed (group ${groupDef.group_number}, seed ${i + 1}): ${gmErr.message}`);
          console.log(`Added user ${userId} to ${groupDef.group_name} (seed ${i + 1})`);
        }
      }
    }

    group1Id = resolvedGroupIds[0];
    group2Id = resolvedGroupIds[1];
  }

  // -------------------------------------------------------------------------
  // 7. Bot predictions
  // -------------------------------------------------------------------------

  let botPredictionsSeeded = 0;

  if (!COMMIT) {
    const eventCount = Object.values(EVENT_DEFS).reduce((sum, matches) => sum + matches.length, 0);
    const predictorsCount = BOT_PREDICTOR_IDS.length;
    // 2 prediction types per event per user
    const expectedPredictions = eventCount * predictorsCount * 2;
    console.log(
      `Would seed ${expectedPredictions} bot predictions (${eventCount} events × ${predictorsCount} users × 2 types)`,
    );
  } else {
    // Build EPT ID lookups (event_id -> winner EPT id, event_id -> exact_score EPT id)
    // We already populated eptIdByKey above
    // Gather all existing predictions to avoid duplicates
    const allEventIds = Array.from(eventIdByKey.values());

    const { data: existingPredictions, error: predLookupErr } = await supabase
      .from("predictions")
      .select("event_prediction_type_id, user_id")
      .in("event_id", allEventIds)
      .in("user_id", BOT_PREDICTOR_IDS);

    if (predLookupErr) throw new Error(`Predictions lookup failed: ${predLookupErr.message}`);

    const existingPredSet = new Set<string>();
    for (const p of existingPredictions ?? []) {
      existingPredSet.add(`${p.event_prediction_type_id}:${p.user_id}`);
    }

    // Build prediction rows to upsert
    const predictionRows: Array<{
      event_prediction_type_id: string;
      event_id: string;
      user_id: string;
      prediction_type: string;
      prediction_data: Record<string, unknown>;
      points_awarded: number;
      is_partial: boolean;
    }> = [];

    for (const [eventKey_, eventId] of Array.from(eventIdByKey.entries())) {
      const winnerEptId = eptIdByKey.get(`${eventId}:winner`);
      const exactEptId = eptIdByKey.get(`${eventId}:exact_score`);

      if (!winnerEptId || !exactEptId) {
        throw new Error(`Missing EPTs for event ${eventKey_} (${eventId})`);
      }

      for (const userId of BOT_PREDICTOR_IDS) {
        // winner prediction
        const winnerKey = `${winnerEptId}:${userId}`;
        if (!existingPredSet.has(winnerKey)) {
          predictionRows.push({
            event_prediction_type_id: winnerEptId,
            event_id: eventId,
            user_id: userId,
            prediction_type: "winner",
            prediction_data: { outcome: weightedWinner() },
            points_awarded: 0,
            is_partial: false,
          });
        }

        // exact_score prediction
        const exactKey = `${exactEptId}:${userId}`;
        if (!existingPredSet.has(exactKey)) {
          const score = randomScore();
          predictionRows.push({
            event_prediction_type_id: exactEptId,
            event_id: eventId,
            user_id: userId,
            prediction_type: "exact_score",
            prediction_data: { home: score.home, away: score.away },
            points_awarded: 0,
            is_partial: false,
          });
        }
      }
    }

    if (predictionRows.length > 0) {
      // Batch in chunks of 100 to avoid payload limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < predictionRows.length; i += BATCH_SIZE) {
        const batch = predictionRows.slice(i, i + BATCH_SIZE);
        const { error: predErr } = await supabase
          .from("predictions")
          .upsert(batch, { onConflict: "event_prediction_type_id,user_id" });

        if (predErr) throw new Error(`Predictions upsert failed (batch ${i / BATCH_SIZE + 1}): ${predErr.message}`);
        botPredictionsSeeded += batch.length;
      }
      console.log(`Seeded ${botPredictionsSeeded} bot predictions`);
    } else {
      console.log("All bot predictions already exist");
    }
  }

  // -------------------------------------------------------------------------
  // 8. Summary output
  // -------------------------------------------------------------------------

  const roundSummary = ROUND_DEFS.map((r) => `${r.name}=${roundIdByName.get(r.name) ?? "?"}`).join(", ");

  const eventSummaryLines: string[] = [];
  if (COMMIT) {
    for (const [key, id] of Array.from(eventIdByKey.entries())) {
      eventSummaryLines.push(`  ${key}: ${id}`);
    }
  } else {
    for (const roundDef of ROUND_DEFS) {
      for (const [home, away] of EVENT_DEFS[roundDef.name]) {
        eventSummaryLines.push(`  [${roundDef.name}] ${home} vs ${away}: <dry-run>`);
      }
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Competition: ${competitionId}`);
  console.log(`Classifications: overall=${overallClassId}, format=${formatClassId}`);
  console.log(`Rounds: ${roundSummary}`);
  console.log(`Events:\n${eventSummaryLines.join("\n")}`);
  console.log(`Groups: Group1=${group1Id}, Group2=${group2Id}`);
  console.log(`Entrants: ${allMembers.length} (1 admin, 1 test user, 6 bots)`);
  console.log(`Bot predictions: ${COMMIT ? botPredictionsSeeded : "<dry-run>"} seeded`);

  // -------------------------------------------------------------------------
  // 9. Write state JSON
  // -------------------------------------------------------------------------

  const stateJson = {
    competition_id: competitionId,
    classifications: {
      overall: overallClassId,
      format: formatClassId,
    },
    rounds: Object.fromEntries(ROUND_DEFS.map((r) => [r.name, roundIdByName.get(r.name) ?? null])),
    events: COMMIT
      ? Object.fromEntries(Array.from(eventIdByKey.entries()))
      : Object.fromEntries(
          ROUND_DEFS.flatMap((r) =>
            EVENT_DEFS[r.name].map(([home, away]) => [eventKey(r.name, home, away), null]),
          ),
        ),
    event_prediction_types: COMMIT
      ? Object.fromEntries(Array.from(eptIdByKey.entries()))
      : {},
    groups: {
      group1: group1Id,
      group2: group2Id,
    },
    users: {
      Superadmin: SUPERADMIN_ID,
      "Test user": TEST_USER_ID,
      ...BOT_USERS.reduce<Record<string, string>>((acc, b) => {
        acc[b.label] = b.id;
        return acc;
      }, {}),
    },
    entrants: {
      superadmin: SUPERADMIN_ID,
      test_user: TEST_USER_ID,
      bots: BOT_USERS.reduce<Record<string, string>>((acc, b) => {
        acc[b.label] = b.id;
        return acc;
      }, {}),
    },
    dry_run: !COMMIT,
    generated_at: new Date().toISOString(),
  };

  const statePath = "/tmp/test-wc-state.json";
  writeFileSync(statePath, JSON.stringify(stateJson, null, 2));
  console.log(`State saved to ${statePath}`);
  console.log("---------------\n");
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  process.exit(1);
});
