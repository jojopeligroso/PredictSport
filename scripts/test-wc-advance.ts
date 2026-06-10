/**
 * Advance a stage in the compressed WC stress test.
 *
 * Reads /tmp/test-wc-state.json (written by test-wc-setup.ts) for all IDs.
 *
 * Usage:
 *   npx tsx scripts/test-wc-advance.ts open MD1       # open round for predictions
 *   npx tsx scripts/test-wc-advance.ts lock MD1       # lock round
 *   npx tsx scripts/test-wc-advance.ts confirm MD1    # confirm results + score predictions
 *   npx tsx scripts/test-wc-advance.ts finalize MD1   # mark round scored, print leaderboard
 *   npx tsx scripts/test-wc-advance.ts eliminate MD3  # run elimination after stage
 *   npx tsx scripts/test-wc-advance.ts status         # print current state
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Env loading
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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// State file types
// ---------------------------------------------------------------------------

interface EventRef {
  id: string;
  event_name: string;
  round_name: string;
}

interface TestState {
  competition_id: string;
  classifications: { overall: string; format: string };
  rounds: Record<string, { id: string }>;
  events: Record<string, EventRef[]>; // keyed by stage name (MD1, MD2, etc.)
  groups: { group1: string; group2: string };
  users: Record<string, string>; // display_name -> user_id
}

// Raw state file shape (flat maps written by setup script)
interface RawState {
  competition_id: string;
  classifications: { overall: string; format: string };
  rounds: Record<string, string>; // "MD1" -> round UUID
  events: Record<string, string>; // "MD1:Mordor vs Gondor" -> event UUID
  groups: { group1: string; group2: string };
  users: Record<string, string>;
}

function loadState(): TestState {
  let raw: RawState;
  try {
    const content = readFileSync("/tmp/test-wc-state.json", "utf-8");
    raw = JSON.parse(content) as RawState;
  } catch (err) {
    console.error("Could not read /tmp/test-wc-state.json — run test-wc-setup.ts first.");
    console.error((err as Error).message);
    process.exit(1);
  }

  // Adapt flat maps to structured format
  const rounds: Record<string, { id: string }> = {};
  for (const [name, id] of Object.entries(raw.rounds)) {
    rounds[name] = { id };
  }

  const events: Record<string, EventRef[]> = {};
  for (const [key, id] of Object.entries(raw.events)) {
    const colonIdx = key.indexOf(":");
    const roundName = key.slice(0, colonIdx);
    const eventName = key.slice(colonIdx + 1);
    if (!events[roundName]) events[roundName] = [];
    events[roundName].push({ id, event_name: eventName, round_name: roundName });
  }

  return {
    competition_id: raw.competition_id,
    classifications: raw.classifications,
    rounds,
    events,
    groups: raw.groups,
    users: raw.users,
  };
}

// ---------------------------------------------------------------------------
// Predetermined results
// ---------------------------------------------------------------------------

type WinnerValue = "Home" | "Away" | "Draw";

interface EventResult {
  winner: WinnerValue;
  homeScore: number;
  awayScore: number;
}

// Keyed by "ROUND:event_name" to handle duplicate matchup names across rounds
const PREDETERMINED_RESULTS: Record<string, EventResult> = {
  // Group stage
  "MD1:Mordor vs Gondor":           { winner: "Home", homeScore: 2, awayScore: 1 },
  "MD1:Kanto vs Johto":             { winner: "Draw", homeScore: 0, awayScore: 0 },
  "MD2:Narnia vs Hogwarts":         { winner: "Away", homeScore: 1, awayScore: 3 },
  "MD2:Wakanda vs Asgard":          { winner: "Home", homeScore: 2, awayScore: 0 },
  "MD3:Tatooine vs Coruscant":      { winner: "Draw", homeScore: 1, awayScore: 1 },
  "MD3:Hyrule vs Mushroom Kingdom": { winner: "Away", homeScore: 0, awayScore: 2 },
  // Knockout
  "R32:Mordor vs Hogwarts":         { winner: "Home", homeScore: 3, awayScore: 1 },
  "R32:Kanto vs Wakanda":           { winner: "Home", homeScore: 1, awayScore: 0 },
  "R16:Gondor vs Narnia":           { winner: "Home", homeScore: 2, awayScore: 2 }, // draw in score, Gondor advances
  "R16:Johto vs Asgard":            { winner: "Away", homeScore: 0, awayScore: 1 },
  "QF:Mordor vs Kanto":             { winner: "Home", homeScore: 2, awayScore: 1 },
  "QF:Gondor vs Asgard":            { winner: "Home", homeScore: 1, awayScore: 0 },
  "SF:Mordor vs Gondor":            { winner: "Home", homeScore: 3, awayScore: 0 },
  "SF:Kanto vs Asgard":             { winner: "Home", homeScore: 2, awayScore: 1 },
  "FINAL:Mordor vs Kanto":          { winner: "Home", homeScore: 1, awayScore: 0 },
  "FINAL:Gondor vs Asgard":         { winner: "Home", homeScore: 2, awayScore: 1 },
};

// Superadmin user ID used for result_confirmed_by
const SUPERADMIN_USER_ID = "8c7e2e1b-0564-4d86-93e2-85ecf00f1e00";

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreWinner(
  predictionData: Record<string, unknown>,
  result: EventResult,
): { is_correct: boolean; points_awarded: number } {
  const predicted = predictionData["winner"] as string | undefined;
  if (predicted === result.winner) {
    return { is_correct: true, points_awarded: 2 };
  }
  return { is_correct: false, points_awarded: 0 };
}

function scoreExactScore(
  predictionData: Record<string, unknown>,
  result: EventResult,
): { is_correct: boolean; points_awarded: number } {
  const home = predictionData["home"] as number | undefined;
  const away = predictionData["away"] as number | undefined;
  if (home === result.homeScore && away === result.awayScore) {
    return { is_correct: true, points_awarded: 3 };
  }
  return { is_correct: false, points_awarded: 0 };
}

// ---------------------------------------------------------------------------
// Command: open
// ---------------------------------------------------------------------------

async function cmdOpen(state: TestState, stage: string): Promise<void> {
  const round = state.rounds[stage];
  if (!round) {
    console.error(`Unknown stage: ${stage}. Available: ${Object.keys(state.rounds).join(", ")}`);
    process.exit(1);
  }

  const now = new Date();
  const lockTime = new Date(now.getTime() + 10 * 60_000);
  const startTime = new Date(now.getTime() + 15 * 60_000);

  // Update all events in this stage
  const events = state.events[stage] ?? [];
  if (events.length === 0) {
    console.error(`No events found for stage: ${stage}`);
    process.exit(1);
  }

  const eventIds = events.map((e) => e.id);

  const { error: evtErr } = await supabase
    .from("events")
    .update({
      lock_time: lockTime.toISOString(),
      start_time: startTime.toISOString(),
    })
    .in("id", eventIds);

  if (evtErr) {
    console.error(`Failed to update events: ${evtErr.message}`);
    process.exit(1);
  }

  // Update round status to open
  const { error: roundErr } = await supabase
    .from("rounds")
    .update({ status: "open" })
    .eq("id", round.id);

  if (roundErr) {
    console.error(`Failed to update round status: ${roundErr.message}`);
    process.exit(1);
  }

  const lockStr = lockTime.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  console.log(`${stage} is now open. Lock time: ${lockStr}. Go make your picks!`);
  console.log(`  Updated ${events.length} events: lock=${lockTime.toISOString()}, start=${startTime.toISOString()}`);
}

// ---------------------------------------------------------------------------
// Command: lock
// ---------------------------------------------------------------------------

async function cmdLock(state: TestState, stage: string): Promise<void> {
  const round = state.rounds[stage];
  if (!round) {
    console.error(`Unknown stage: ${stage}. Available: ${Object.keys(state.rounds).join(", ")}`);
    process.exit(1);
  }

  const { error } = await supabase
    .from("rounds")
    .update({ status: "locked" })
    .eq("id", round.id);

  if (error) {
    console.error(`Failed to lock round: ${error.message}`);
    process.exit(1);
  }

  console.log(`${stage} is now locked.`);
}

// ---------------------------------------------------------------------------
// Command: confirm
// ---------------------------------------------------------------------------

async function cmdConfirm(state: TestState, stage: string): Promise<void> {
  const events = state.events[stage];
  if (!events || events.length === 0) {
    console.error(`No events found for stage: ${stage}`);
    process.exit(1);
  }

  // Build display name lookup (user_id -> display_name)
  const userNameById: Record<string, string> = {};
  for (const [name, id] of Object.entries(state.users)) {
    userNameById[id] = name;
  }

  for (const eventRef of events) {
    const resultKey = `${stage}:${eventRef.event_name}`;
    const result = PREDETERMINED_RESULTS[resultKey];
    if (!result) {
      console.error(`No predetermined result for event: "${resultKey}"`);
      console.error("Add it to PREDETERMINED_RESULTS in the script.");
      process.exit(1);
    }

    // Fetch home/away team names from event name (format: "Home vs Away")
    const parts = eventRef.event_name.split(" vs ");
    const homeTeam = parts[0]?.trim() ?? "Home";
    const awayTeam = parts[1]?.trim() ?? "Away";

    const resultData = {
      winner: result.winner,
      score: {
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: result.homeScore,
        away_score: result.awayScore,
      },
    };

    // Update event with result
    const { error: evtErr } = await supabase
      .from("events")
      .update({
        result_data: resultData,
        result_confirmed: true,
        result_confirmed_by: SUPERADMIN_USER_ID,
        status: "resulted",
      })
      .eq("id", eventRef.id);

    if (evtErr) {
      console.error(`Failed to confirm event "${eventRef.event_name}": ${evtErr.message}`);
      continue;
    }

    // Fetch all predictions for this event
    const { data: predictions, error: predErr } = await supabase
      .from("predictions")
      .select("id, user_id, prediction_type, prediction_data, event_prediction_type_id")
      .eq("event_id", eventRef.id);

    if (predErr) {
      console.error(`Failed to fetch predictions for "${eventRef.event_name}": ${predErr.message}`);
      continue;
    }

    if (!predictions || predictions.length === 0) {
      console.log(`${eventRef.event_name} (${result.homeScore}-${result.awayScore}, ${result.winner} wins): no predictions`);
      continue;
    }

    // Group predictions by user for display
    const byUser: Record<
      string,
      { winner?: { is_correct: boolean; points_awarded: number }; exact?: { is_correct: boolean; points_awarded: number } }
    > = {};

    const updates: Promise<void>[] = [];

    for (const pred of predictions) {
      const userId = pred.user_id as string;
      if (!byUser[userId]) byUser[userId] = {};

      let scored: { is_correct: boolean; points_awarded: number };

      if (pred.prediction_type === "winner") {
        scored = scoreWinner(pred.prediction_data as Record<string, unknown>, result);
        byUser[userId].winner = scored;
      } else if (pred.prediction_type === "exact_score") {
        scored = scoreExactScore(pred.prediction_data as Record<string, unknown>, result);
        byUser[userId].exact = scored;
      } else {
        // Unknown type — skip scoring
        continue;
      }

      updates.push(
        supabase
          .from("predictions")
          .update({
            is_correct: scored.is_correct,
            is_partial: false,
            points_awarded: scored.points_awarded,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pred.id)
          .then(({ error }) => {
            if (error) {
              console.error(`  Failed to score prediction ${pred.id}: ${error.message}`);
            }
          }),
      );
    }

    await Promise.all(updates);

    // Print scoring summary
    const scoreLabel = `${result.homeScore}-${result.awayScore}`;
    console.log(`\n${eventRef.event_name} (${scoreLabel}, ${result.winner} wins):`);

    const sortedUserIds = Object.keys(byUser).sort((a, b) => {
      const nameA = userNameById[a] ?? a;
      const nameB = userNameById[b] ?? b;
      return nameA.localeCompare(nameB);
    });

    for (const userId of sortedUserIds) {
      const userName = userNameById[userId] ?? userId;
      const w = byUser[userId].winner;
      const e = byUser[userId].exact;
      const wStr = w ? `winner=${w.is_correct ? "✓" : "✗"}(${w.points_awarded})` : "winner=no pick";
      const eStr = e ? `score=${e.is_correct ? "✓" : "✗"}(${e.points_awarded})` : "score=no pick";
      const total = (w?.points_awarded ?? 0) + (e?.points_awarded ?? 0);
      console.log(`  ${userName}: ${wStr} + ${eStr} = ${total}pts`);
    }
  }

  console.log(`\n${stage} results confirmed.`);
}

// ---------------------------------------------------------------------------
// Command: finalize
// ---------------------------------------------------------------------------

async function cmdFinalize(state: TestState, stage: string): Promise<void> {
  const round = state.rounds[stage];
  if (!round) {
    console.error(`Unknown stage: ${stage}. Available: ${Object.keys(state.rounds).join(", ")}`);
    process.exit(1);
  }

  // Set round status to scored
  const { error: roundErr } = await supabase
    .from("rounds")
    .update({ status: "scored" })
    .eq("id", round.id);

  if (roundErr) {
    console.error(`Failed to finalize round: ${roundErr.message}`);
    process.exit(1);
  }

  console.log(`${stage} is now finalized (status: scored).`);

  // Print overall leaderboard
  await printLeaderboard(state);

  // Print format group standings for stages up to and including this one
  await printFormatGroupStandings(state, stage);
}

// ---------------------------------------------------------------------------
// Command: eliminate
// ---------------------------------------------------------------------------

// Map stage name -> sporting_stage_id for ordering
const STAGE_ORDER: Record<string, number> = {
  MD1: 1, MD2: 2, MD3: 3,
  R32: 4, R16: 5, QF: 6, SF: 7, "3RD": 8, FINAL: 9,
};

async function cmdEliminate(state: TestState, stage: string): Promise<void> {
  const validElimStages = ["MD3", "R32", "R16", "QF", "SF"];
  if (!validElimStages.includes(stage)) {
    console.error(`Elimination only valid after: ${validElimStages.join(", ")}`);
    console.error(`Got: ${stage}`);
    process.exit(1);
  }

  const formatClassId = state.classifications.format;

  // Gather all rounds at or before this stage (by STAGE_ORDER)
  const stageOrderLimit = STAGE_ORDER[stage] ?? 0;
  const includedRoundIds = Object.entries(state.rounds)
    .filter(([name]) => (STAGE_ORDER[name] ?? 0) <= stageOrderLimit)
    .map(([, r]) => r.id);

  // Get all event IDs in those rounds
  const allEventIds = Object.entries(state.events)
    .filter(([name]) => (STAGE_ORDER[name] ?? 0) <= stageOrderLimit)
    .flatMap(([, evts]) => evts.map((e) => e.id));

  if (allEventIds.length === 0) {
    console.error("No events found for included stages.");
    process.exit(1);
  }

  // Fetch total points per user across all included events
  const { data: preds, error: predErr } = await supabase
    .from("predictions")
    .select("user_id, points_awarded")
    .in("event_id", allEventIds);

  if (predErr) {
    console.error(`Failed to fetch predictions: ${predErr.message}`);
    process.exit(1);
  }

  const pointsByUser: Record<string, number> = {};
  for (const { user_id, points_awarded } of preds ?? []) {
    pointsByUser[user_id] = (pointsByUser[user_id] ?? 0) + (points_awarded ?? 0);
  }

  // User name lookup
  const userNameById: Record<string, string> = {};
  for (const [name, id] of Object.entries(state.users)) {
    userNameById[id] = name;
  }

  // Fetch format group memberships
  const { data: groupMembers, error: gmErr } = await supabase
    .from("format_group_memberships")
    .select("id, group_id, user_id, status")
    .eq("classification_id", formatClassId);

  if (gmErr) {
    console.error(`Failed to fetch format group memberships: ${gmErr.message}`);
    process.exit(1);
  }

  if (!groupMembers || groupMembers.length === 0) {
    console.error("No format group memberships found.");
    process.exit(1);
  }

  // Fetch group info
  const { data: groups, error: grpErr } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, group_number")
    .eq("classification_id", formatClassId);

  if (grpErr) {
    console.error(`Failed to fetch format groups: ${grpErr.message}`);
    process.exit(1);
  }

  const groupById: Record<string, { group_name: string; group_number: number }> = {};
  for (const g of groups ?? []) {
    groupById[g.id] = { group_name: g.group_name, group_number: g.group_number };
  }

  // Group members by group_id
  const membersByGroup: Record<string, Array<{ id: string; user_id: string; status: string }>> = {};
  for (const m of groupMembers) {
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
    membersByGroup[m.group_id].push(m);
  }

  const toEliminate: string[] = []; // user display names
  const toSurvive: string[] = [];
  const memberIdsToEliminate: string[] = []; // format_group_memberships.id
  const userIdsToEliminate: string[] = [];

  if (stage === "MD3") {
    // Group stage elimination:
    // Top 2 per group auto-qualify (4 total from 2 groups).
    // 2 best thirds needed — but with only 2 groups, both thirds survive.
    // 4th place in each group (2 users total) is eliminated.

    const thirdPlaceUsers: Array<{ user_id: string; points: number; group_name: string }> = [];

    for (const [groupId, members] of Object.entries(membersByGroup)) {
      const grpInfo = groupById[groupId];
      const ranked = members
        .filter((m) => m.status !== "eliminated")
        .map((m) => ({ ...m, points: pointsByUser[m.user_id] ?? 0 }))
        .sort((a, b) => b.points - a.points);

      const groupName = grpInfo?.group_name ?? groupId;
      console.log(`\nGroup ${groupName} standings (after ${stage}):`);
      ranked.forEach((m, idx) => {
        const name = userNameById[m.user_id] ?? m.user_id;
        const pos = idx + 1;
        console.log(`  ${pos}. ${name} — ${m.points}pts`);
      });

      // 4th place eliminated immediately
      if (ranked.length >= 4) {
        const fourth = ranked[3];
        memberIdsToEliminate.push(fourth.id);
        userIdsToEliminate.push(fourth.user_id);
        toEliminate.push(userNameById[fourth.user_id] ?? fourth.user_id);
      }

      // 3rd place goes to best-thirds pool
      if (ranked.length >= 3) {
        const third = ranked[2];
        thirdPlaceUsers.push({
          user_id: third.user_id,
          points: third.points,
          group_name: groupName,
        });
      }

      // Top 2 survive
      for (const survivor of ranked.slice(0, 2)) {
        toSurvive.push(userNameById[survivor.user_id] ?? survivor.user_id);
      }
    }

    // Best thirds: with 2 groups and 2 slots needed, both thirds survive
    console.log("\nBest thirds:");
    thirdPlaceUsers.sort((a, b) => b.points - a.points);
    for (const t of thirdPlaceUsers) {
      const name = userNameById[t.user_id] ?? t.user_id;
      console.log(`  ${name} (${t.group_name}) — ${t.points}pts — SURVIVES (best third)`);
      toSurvive.push(name);
    }
  } else {
    // Knockout elimination: use the elimination curve to determine target survivors
    // Curve for 8 entrants:
    //   group_stage: 6, round_of_32: 5, round_of_16: 4,
    //   quarter_finals: 3, semi_finals: 2, final: 1
    const CURVE_TARGETS: Record<string, number> = {
      R32: 5,
      R16: 4,
      QF: 3,
      SF: 2,
    };

    const targetSurvivors = CURVE_TARGETS[stage];
    if (targetSurvivors === undefined) {
      console.error(`No curve target for stage: ${stage}`);
      process.exit(1);
    }

    const allActive: Array<{ id: string; user_id: string; points: number }> = [];

    for (const members of Object.values(membersByGroup)) {
      for (const m of members) {
        if (m.status !== "eliminated") {
          allActive.push({ id: m.id, user_id: m.user_id, points: pointsByUser[m.user_id] ?? 0 });
        }
      }
    }

    allActive.sort((a, b) => b.points - a.points);

    const toKeep = Math.min(targetSurvivors, allActive.length);
    const survivors = allActive.slice(0, toKeep);
    const eliminated = allActive.slice(toKeep);

    console.log(`\nKnockout elimination: ${allActive.length} active → ${targetSurvivors} target survivors → ${eliminated.length} eliminated`);

    for (const s of survivors) {
      toSurvive.push(userNameById[s.user_id] ?? s.user_id);
    }

    for (const e of eliminated) {
      memberIdsToEliminate.push(e.id);
      userIdsToEliminate.push(e.user_id);
      toEliminate.push(userNameById[e.user_id] ?? e.user_id);
    }
  }

  // Apply eliminations: format_group_memberships
  if (memberIdsToEliminate.length > 0) {
    const { error: fgmErr } = await supabase
      .from("format_group_memberships")
      .update({ status: "eliminated" })
      .in("id", memberIdsToEliminate);

    if (fgmErr) {
      console.error(`Failed to update format_group_memberships: ${fgmErr.message}`);
    }

    // Also update classification_memberships
    const { error: clsErr } = await supabase
      .from("classification_memberships")
      .update({
        status: "eliminated",
        eliminated_at: new Date().toISOString(),
        elimination_reason: `Eliminated after ${stage}`,
      })
      .eq("classification_id", formatClassId)
      .in("user_id", userIdsToEliminate);

    if (clsErr) {
      console.error(`Failed to update classification_memberships: ${clsErr.message}`);
    }
  }

  console.log(`\nEliminated: ${toEliminate.join(", ") || "none"}.`);
  console.log(`Survivors: ${toSurvive.join(", ") || "none"}.`);
}

// ---------------------------------------------------------------------------
// Command: status
// ---------------------------------------------------------------------------

async function cmdStatus(state: TestState): Promise<void> {
  console.log("\n=== ROUNDS ===");

  const roundIds = Object.values(state.rounds).map((r) => r.id);
  const { data: rounds, error: roundErr } = await supabase
    .from("rounds")
    .select("id, name, status, round_number")
    .in("id", roundIds)
    .order("round_number");

  if (roundErr) {
    console.error(`Failed to fetch rounds: ${roundErr.message}`);
  } else {
    for (const r of rounds ?? []) {
      console.log(`  ${r.name.padEnd(20)} status=${r.status}`);
    }
  }

  console.log("\n=== EVENTS ===");

  const allEventIds = Object.values(state.events).flatMap((evts) => evts.map((e) => e.id));
  const { data: events, error: evtErr } = await supabase
    .from("events")
    .select("id, event_name, status, result_confirmed, lock_time")
    .in("id", allEventIds);

  if (evtErr) {
    console.error(`Failed to fetch events: ${evtErr.message}`);
  } else {
    // Group by round
    const eventByRound: Record<string, typeof events> = {};
    for (const [stageName, stageEvts] of Object.entries(state.events)) {
      eventByRound[stageName] = [];
      for (const stateEvt of stageEvts) {
        const dbEvt = (events ?? []).find((e) => e.id === stateEvt.id);
        if (dbEvt) eventByRound[stageName]!.push(dbEvt);
      }
    }

    for (const [stageName, stageEvts] of Object.entries(eventByRound)) {
      console.log(`  ${stageName}:`);
      for (const e of stageEvts ?? []) {
        const confirmed = e.result_confirmed ? "confirmed" : "pending";
        console.log(`    ${e.event_name.padEnd(35)} status=${e.status.padEnd(8)} result=${confirmed}`);
      }
    }
  }

  console.log("");
  await printLeaderboard(state);

  // Find the latest finalized/scored stage for format standings
  const { data: scoredRounds } = await supabase
    .from("rounds")
    .select("id, name")
    .in("id", roundIds)
    .eq("status", "scored");

  if (scoredRounds && scoredRounds.length > 0) {
    // Find latest by STAGE_ORDER
    const latestStage = scoredRounds
      .map((r) => r.name)
      .sort((a, b) => (STAGE_ORDER[b] ?? 0) - (STAGE_ORDER[a] ?? 0))[0];

    if (latestStage) {
      await printFormatGroupStandings(state, latestStage);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared: leaderboard
// ---------------------------------------------------------------------------

async function printLeaderboard(state: TestState): Promise<void> {
  const allEventIds = Object.values(state.events).flatMap((evts) => evts.map((e) => e.id));

  const { data: preds, error } = await supabase
    .from("predictions")
    .select("user_id, points_awarded")
    .in("event_id", allEventIds);

  if (error) {
    console.error(`Failed to fetch predictions for leaderboard: ${error.message}`);
    return;
  }

  const pointsByUser: Record<string, number> = {};
  for (const { user_id, points_awarded } of preds ?? []) {
    pointsByUser[user_id] = (pointsByUser[user_id] ?? 0) + (points_awarded ?? 0);
  }

  const userNameById: Record<string, string> = {};
  for (const [name, id] of Object.entries(state.users)) {
    userNameById[id] = name;
  }

  const ranked = Object.entries(pointsByUser)
    .map(([userId, pts]) => ({ name: userNameById[userId] ?? userId, pts }))
    .sort((a, b) => b.pts - a.pts);

  console.log("=== OVERALL LEADERBOARD ===");
  if (ranked.length === 0) {
    console.log("  No scores yet.");
  } else {
    ranked.forEach((entry, idx) => {
      console.log(`  ${(idx + 1).toString().padStart(2)}. ${entry.name.padEnd(20)} ${entry.pts}pts`);
    });
  }
}

// ---------------------------------------------------------------------------
// Shared: format group standings
// ---------------------------------------------------------------------------

async function printFormatGroupStandings(state: TestState, upToStage: string): Promise<void> {
  const formatClassId = state.classifications.format;
  const stageOrderLimit = STAGE_ORDER[upToStage] ?? 0;

  // Events in stages up to and including this one
  const includedEventIds = Object.entries(state.events)
    .filter(([name]) => (STAGE_ORDER[name] ?? 0) <= stageOrderLimit)
    .flatMap(([, evts]) => evts.map((e) => e.id));

  if (includedEventIds.length === 0) {
    return;
  }

  const { data: preds, error: predErr } = await supabase
    .from("predictions")
    .select("user_id, points_awarded")
    .in("event_id", includedEventIds);

  if (predErr) {
    console.error(`Failed to fetch predictions for format standings: ${predErr.message}`);
    return;
  }

  const pointsByUser: Record<string, number> = {};
  for (const { user_id, points_awarded } of preds ?? []) {
    pointsByUser[user_id] = (pointsByUser[user_id] ?? 0) + (points_awarded ?? 0);
  }

  // Fetch format groups and memberships
  const { data: groups, error: grpErr } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, group_number")
    .eq("classification_id", formatClassId)
    .order("group_number");

  if (grpErr || !groups) {
    console.error("Could not fetch format groups.");
    return;
  }

  const { data: memberships, error: memErr } = await supabase
    .from("format_group_memberships")
    .select("group_id, user_id, status")
    .eq("classification_id", formatClassId);

  if (memErr || !memberships) {
    console.error("Could not fetch format group memberships.");
    return;
  }

  const userNameById: Record<string, string> = {};
  for (const [name, id] of Object.entries(state.users)) {
    userNameById[id] = name;
  }

  console.log(`\n=== FORMAT GROUP STANDINGS (up to ${upToStage}) ===`);

  for (const group of groups) {
    const groupMembers = memberships.filter((m) => m.group_id === group.id);
    const ranked = groupMembers
      .map((m) => ({
        name: userNameById[m.user_id] ?? m.user_id,
        pts: pointsByUser[m.user_id] ?? 0,
        status: m.status,
      }))
      .sort((a, b) => b.pts - a.pts);

    console.log(`  ${group.group_name}:`);
    ranked.forEach((m, idx) => {
      const statusStr = m.status === "eliminated" ? " [ELIMINATED]" : "";
      console.log(`    ${(idx + 1).toString()}. ${m.name.padEnd(20)} ${m.pts}pts${statusStr}`);
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const stage = args[1]?.toUpperCase();

  if (!cmd) {
    console.error("Usage: npx tsx scripts/test-wc-advance.ts <command> [STAGE]");
    console.error("Commands: open, lock, confirm, finalize, eliminate, status");
    process.exit(1);
  }

  const state = loadState();

  switch (cmd) {
    case "open":
      if (!stage) { console.error("Usage: open <STAGE>"); process.exit(1); }
      await cmdOpen(state, stage);
      break;

    case "lock":
      if (!stage) { console.error("Usage: lock <STAGE>"); process.exit(1); }
      await cmdLock(state, stage);
      break;

    case "confirm":
      if (!stage) { console.error("Usage: confirm <STAGE>"); process.exit(1); }
      await cmdConfirm(state, stage);
      break;

    case "finalize":
      if (!stage) { console.error("Usage: finalize <STAGE>"); process.exit(1); }
      await cmdFinalize(state, stage);
      break;

    case "eliminate":
      if (!stage) { console.error("Usage: eliminate <STAGE>"); process.exit(1); }
      await cmdEliminate(state, stage);
      break;

    case "status":
      await cmdStatus(state);
      break;

    default:
      console.error(`Unknown command: ${cmd}`);
      console.error("Commands: open, lock, confirm, finalize, eliminate, status");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nScript failed:", (err as Error).message);
  process.exit(1);
});
