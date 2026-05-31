/**
 * Seed script: FIFA World Cup 2026 group-stage events.
 *
 * Creates the 72 group-stage `events` (12 groups x 6 matches) for the World Cup
 * competition, each wired to its matchday prediction window (round) and given
 * `winner` + `exact_score` event_prediction_types rows.
 *
 * IDEMPOTENT — keyed on events.external_event_id (unique per competition). Safe
 * to re-run: existing events are updated in place, prediction-type rows are
 * upserted on (event_id, prediction_type).
 *
 * Prerequisite: U0 (correct group data) must be applied first — this script's
 * team names come from scripts/wc2026-group-fixtures.ts, which matches the
 * corrected WC2026_GROUPS / bracket_templates.
 *
 * Usage:
 *   npx tsx scripts/seed-wc2026-group-events.ts          # dry run (prints plan)
 *   npx tsx scripts/seed-wc2026-group-events.ts --commit # writes to the DB
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { WC2026_GROUP_FIXTURES } from "./wc2026-group-fixtures";

// --- env -------------------------------------------------------------------

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

// --- constants -------------------------------------------------------------

const WC2026_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000026";
const LOCK_OFFSET_MIN = 10; // daily window locks 10min before first kickoff
const POINTS_WINNER = 2; // competition scoring_rules.group_match_outcome
const POINTS_EXACT = 3; // competition scoring_rules.exact_score_bonus

// --- main ------------------------------------------------------------------

async function main() {
  console.log(
    `\nWC2026 group-event seed — ${COMMIT ? "COMMIT" : "DRY RUN"} mode\n`,
  );

  // 1. Resolve the World Cup competition.
  const { data: competition, error: compErr } = await supabase
    .from("competitions")
    .select("id, name, status")
    .eq("product_mode", "world_cup_2026_shell")
    .eq("tournament_id", WC2026_TOURNAMENT_ID)
    .maybeSingle();

  if (compErr) throw new Error(`Competition lookup failed: ${compErr.message}`);
  if (!competition) {
    throw new Error(
      "No World Cup competition found. Create it before seeding events.",
    );
  }
  console.log(`Competition: ${competition.name} (${competition.id}) [${competition.status}]`);

  // 2. Resolve matchday windows (rounds). round_number 1/2/3 == matchday.
  const { data: rounds, error: roundErr } = await supabase
    .from("rounds")
    .select("id, name, round_number")
    .eq("competition_id", competition.id)
    .in("round_number", [1, 2, 3]);

  if (roundErr) throw new Error(`Rounds lookup failed: ${roundErr.message}`);

  const roundByMatchday = new Map<number, string>();
  for (const r of rounds ?? []) roundByMatchday.set(r.round_number, r.id);
  for (const md of [1, 2, 3]) {
    if (!roundByMatchday.has(md)) {
      throw new Error(`Missing prediction window for matchday ${md}.`);
    }
  }
  console.log(`Matchday windows: ${[...roundByMatchday.keys()].sort().join(", ")}`);

  if (WC2026_GROUP_FIXTURES.length !== 72) {
    throw new Error(
      `Expected 72 fixtures, fixture data has ${WC2026_GROUP_FIXTURES.length}.`,
    );
  }

  // 3. Pre-compute daily lock times: all events on the same UTC date
  //    share one lock time = earliest kickoff that day − 10 minutes.
  const fixturesByUtcDate = new Map<string, Date[]>();
  for (const f of WC2026_GROUP_FIXTURES) {
    const start = new Date(f.kickoffUtc);
    const iso = start.toISOString().slice(0, 10);
    const list = fixturesByUtcDate.get(iso) ?? [];
    list.push(start);
    fixturesByUtcDate.set(iso, list);
  }
  const dailyLockByDate = new Map<string, Date>();
  for (const [iso, starts] of fixturesByUtcDate) {
    const earliest = starts.reduce((a, b) => (a < b ? a : b));
    dailyLockByDate.set(iso, new Date(earliest.getTime() - LOCK_OFFSET_MIN * 60_000));
  }

  // 4. Build event rows using daily lock times.
  const eventRows = WC2026_GROUP_FIXTURES.map((f) => {
    const start = new Date(f.kickoffUtc);
    const iso = start.toISOString().slice(0, 10);
    const lock = dailyLockByDate.get(iso)!;
    return {
      fixture: f,
      row: {
        competition_id: competition.id,
        round_id: roundByMatchday.get(f.matchday)!,
        event_name: `${f.home} vs ${f.away}`,
        sport: "soccer",
        start_time: start.toISOString(),
        lock_time: lock.toISOString(),
        status: "upcoming",
        external_event_id: `manual:wc2026-grp-${f.group}-md${f.matchday}-${f.matchInGroup}`,
        provider_league: "soccer/fifa.world",
      },
    };
  });

  if (!COMMIT) {
    console.log(`\nWould upsert ${eventRows.length} events. Sample:`);
    for (const e of eventRows.slice(0, 3)) {
      console.log(
        `  [${e.fixture.group}] ${e.row.event_name} — ${e.row.start_time} (lock ${e.row.lock_time}) -> window md${e.fixture.matchday}`,
      );
    }
    console.log(
      `\nEach event also gets: winner (${POINTS_WINNER}pts, config.options) + exact_score (${POINTS_EXACT}pts).`,
    );
    console.log("\nDry run complete. Re-run with --commit to write.\n");
    return;
  }

  // 5. Insert/update events. Done explicitly rather than via upsert() because
  //    the uniqueness guard on (competition_id, external_event_id) is a PARTIAL
  //    index (WHERE external_event_id IS NOT NULL); onConflict against partial
  //    indexes is unreliable. Explicit select-then-insert/update is idempotent
  //    regardless.
  const externalIds = eventRows.map((e) => e.row.external_event_id);
  const { data: existing, error: existErr } = await supabase
    .from("events")
    .select("id, external_event_id")
    .eq("competition_id", competition.id)
    .in("external_event_id", externalIds);

  if (existErr) throw new Error(`Existing-events lookup failed: ${existErr.message}`);

  const idByExternal = new Map<string, string>();
  for (const e of existing ?? []) idByExternal.set(e.external_event_id, e.id);

  const toInsert = eventRows.filter((e) => !idByExternal.has(e.row.external_event_id));
  const toUpdate = eventRows.filter((e) => idByExternal.has(e.row.external_event_id));

  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("events")
      .insert(toInsert.map((e) => e.row))
      .select("id, external_event_id");
    if (insErr) throw new Error(`Event insert failed: ${insErr.message}`);
    for (const e of inserted ?? []) idByExternal.set(e.external_event_id, e.id);
    console.log(`\nInserted ${inserted?.length ?? 0} new events.`);
  }

  for (const e of toUpdate) {
    const id = idByExternal.get(e.row.external_event_id)!;
    const { error: updErr } = await supabase
      .from("events")
      .update(e.row)
      .eq("id", id);
    if (updErr) throw new Error(`Event update failed (${id}): ${updErr.message}`);
  }
  if (toUpdate.length > 0) console.log(`Updated ${toUpdate.length} existing events.`);

  // 6. Upsert event_prediction_types: winner + exact_score per event.
  const eptRows: Array<{
    event_id: string;
    prediction_type: string;
    points: number;
    partial_points: number;
    config: Record<string, unknown> | null;
  }> = [];

  for (const e of eventRows) {
    const eventId = idByExternal.get(e.row.external_event_id);
    if (!eventId) {
      throw new Error(`No id for ${e.row.external_event_id} after upsert.`);
    }
    eptRows.push({
      event_id: eventId,
      prediction_type: "winner",
      points: POINTS_WINNER,
      partial_points: 0,
      // config.options drives the A/B selection buttons (CLAUDE.md checklist).
      config: { options: [e.fixture.home, "Draw", e.fixture.away] },
    });
    eptRows.push({
      event_id: eventId,
      prediction_type: "exact_score",
      points: POINTS_EXACT,
      partial_points: 0,
      config: null,
    });
  }

  const { error: eptErr } = await supabase
    .from("event_prediction_types")
    .upsert(eptRows, { onConflict: "event_id,prediction_type" });

  if (eptErr) throw new Error(`Prediction-type upsert failed: ${eptErr.message}`);
  console.log(`Upserted ${eptRows.length} event_prediction_types rows.`);

  console.log("\nDone. 72 group events seeded across 3 matchday windows.\n");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
