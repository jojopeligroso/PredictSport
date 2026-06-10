/**
 * Cleanup script: remove a WC stress-test competition and all its data.
 *
 * Reads /tmp/test-wc-state.json for the competition ID, then tries a direct
 * competition delete first (relying on CASCADE). If FK constraints block that,
 * falls back to manual ordered deletion respecting FK dependencies.
 *
 * Usage:
 *   npx tsx scripts/test-wc-cleanup.ts          # dry run (shows what would be deleted)
 *   npx tsx scripts/test-wc-cleanup.ts --commit # actually deletes
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";

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
const STATE_FILE = "/tmp/test-wc-state.json";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- helpers ---------------------------------------------------------------

async function countRows(
  table: string,
  column: string,
  value: string | string[],
): Promise<number> {
  const query = supabase.from(table).select("id", { count: "exact", head: true });
  if (Array.isArray(value)) {
    query.in(column, value);
  } else {
    query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw new Error(`Count failed on ${table}: ${error.message}`);
  return count ?? 0;
}

async function deleteRows(
  table: string,
  column: string,
  value: string | string[],
): Promise<number> {
  const query = supabase.from(table).delete().select("id");
  if (Array.isArray(value)) {
    query.in(column, value);
  } else {
    query.eq(column, value);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Delete failed on ${table}: ${error.message}`);
  return data?.length ?? 0;
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log(`\nWC test cleanup — ${COMMIT ? "COMMIT" : "DRY RUN"} mode\n`);

  // 1. Read state file
  if (!existsSync(STATE_FILE)) {
    console.error(`State file not found: ${STATE_FILE}`);
    console.error("Nothing to clean up.");
    process.exit(1);
  }

  let competitionId: string;
  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    const state = JSON.parse(raw) as Record<string, unknown>;
    if (typeof state.competitionId !== "string") {
      throw new Error("competitionId field missing or not a string");
    }
    competitionId = state.competitionId;
  } catch (err) {
    console.error(`Failed to parse ${STATE_FILE}:`, (err as Error).message);
    process.exit(1);
  }

  console.log(`Competition ID: ${competitionId}`);

  // 2. Verify competition exists
  const { data: competition, error: compErr } = await supabase
    .from("competitions")
    .select("id, name, status")
    .eq("id", competitionId)
    .maybeSingle();

  if (compErr) throw new Error(`Competition lookup failed: ${compErr.message}`);
  if (!competition) {
    console.log("Competition not found — already deleted or invalid ID.");
    if (existsSync(STATE_FILE)) {
      if (COMMIT) {
        unlinkSync(STATE_FILE);
        console.log(`Deleted state file: ${STATE_FILE}`);
      } else {
        console.log(`Would delete state file: ${STATE_FILE}`);
      }
    }
    return;
  }

  console.log(`Found: "${competition.name}" [${competition.status}]\n`);

  // 3. Resolve IDs needed for scoped deletes
  const { data: eventRows, error: eventsErr } = await supabase
    .from("events")
    .select("id")
    .eq("competition_id", competitionId);
  if (eventsErr) throw new Error(`Events lookup failed: ${eventsErr.message}`);
  const eventIds = (eventRows ?? []).map((e) => e.id);

  const { data: classRows, error: classErr } = await supabase
    .from("classifications")
    .select("id")
    .eq("competition_id", competitionId);
  if (classErr) throw new Error(`Classifications lookup failed: ${classErr.message}`);
  const classificationIds = (classRows ?? []).map((c) => c.id);

  // 4. Count what we'd delete
  console.log("Rows to be deleted:");

  const counts: Record<string, number> = {};

  if (eventIds.length > 0) {
    counts.predictions = await countRows("predictions", "event_id", eventIds);
    counts.event_prediction_types = await countRows("event_prediction_types", "event_id", eventIds);
  } else {
    counts.predictions = 0;
    counts.event_prediction_types = 0;
  }

  if (classificationIds.length > 0) {
    counts.format_group_memberships = await countRows("format_group_memberships", "classification_id", classificationIds);
    counts.format_prediction_groups = await countRows("format_prediction_groups", "classification_id", classificationIds);
    counts.classification_standings_snapshots = await countRows("classification_standings_snapshots", "classification_id", classificationIds);
  } else {
    counts.format_group_memberships = 0;
    counts.format_prediction_groups = 0;
    counts.classification_standings_snapshots = 0;
  }

  counts.classification_memberships = await countRows("classification_memberships", "competition_id", competitionId);
  counts.result_finalisations = await countRows("result_finalisations", "competition_id", competitionId);
  counts.events = eventIds.length;
  counts.rounds = await countRows("rounds", "competition_id", competitionId);
  counts.classifications = classificationIds.length;
  counts.competition_members = await countRows("competition_members", "competition_id", competitionId);
  counts.competitions = 1;

  const order = [
    "predictions",
    "event_prediction_types",
    "format_group_memberships",
    "format_prediction_groups",
    "classification_memberships",
    "classification_standings_snapshots",
    "result_finalisations",
    "events",
    "rounds",
    "classifications",
    "competition_members",
    "competitions",
  ];

  for (const table of order) {
    console.log(`  ${table}: ${counts[table]}`);
  }

  if (!COMMIT) {
    console.log(`\nWould also delete state file: ${STATE_FILE}`);
    console.log("\nDry run complete. Re-run with --commit to delete.\n");
    return;
  }

  // 5. Try direct competition delete first (CASCADE handles children)
  console.log("\nAttempting direct competition delete (cascade)...");
  const { error: directErr } = await supabase
    .from("competitions")
    .delete()
    .eq("id", competitionId);

  if (!directErr) {
    console.log("  competitions: 1 (cascaded all children)");
    unlinkSync(STATE_FILE);
    console.log(`\nDeleted state file: ${STATE_FILE}`);
    console.log("\nDone. Competition and all related data removed.\n");
    return;
  }

  console.log(`  Cascade failed (${directErr.message}), falling back to manual ordered deletion...\n`);

  // 6. Manual ordered deletion
  const deleted: Record<string, number> = {};

  if (eventIds.length > 0) {
    deleted.predictions = await deleteRows("predictions", "event_id", eventIds);
    console.log(`  predictions: ${deleted.predictions}`);

    deleted.event_prediction_types = await deleteRows("event_prediction_types", "event_id", eventIds);
    console.log(`  event_prediction_types: ${deleted.event_prediction_types}`);
  }

  if (classificationIds.length > 0) {
    deleted.format_group_memberships = await deleteRows("format_group_memberships", "classification_id", classificationIds);
    console.log(`  format_group_memberships: ${deleted.format_group_memberships}`);

    deleted.format_prediction_groups = await deleteRows("format_prediction_groups", "classification_id", classificationIds);
    console.log(`  format_prediction_groups: ${deleted.format_prediction_groups}`);
  }

  deleted.classification_memberships = await deleteRows("classification_memberships", "competition_id", competitionId);
  console.log(`  classification_memberships: ${deleted.classification_memberships}`);

  if (classificationIds.length > 0) {
    deleted.classification_standings_snapshots = await deleteRows("classification_standings_snapshots", "classification_id", classificationIds);
    console.log(`  classification_standings_snapshots: ${deleted.classification_standings_snapshots}`);
  }

  deleted.result_finalisations = await deleteRows("result_finalisations", "competition_id", competitionId);
  console.log(`  result_finalisations: ${deleted.result_finalisations}`);

  deleted.events = await deleteRows("events", "competition_id", competitionId);
  console.log(`  events: ${deleted.events}`);

  deleted.rounds = await deleteRows("rounds", "competition_id", competitionId);
  console.log(`  rounds: ${deleted.rounds}`);

  deleted.classifications = await deleteRows("classifications", "competition_id", competitionId);
  console.log(`  classifications: ${deleted.classifications}`);

  deleted.competition_members = await deleteRows("competition_members", "competition_id", competitionId);
  console.log(`  competition_members: ${deleted.competition_members}`);

  deleted.competitions = await deleteRows("competitions", "id", competitionId);
  console.log(`  competitions: ${deleted.competitions}`);

  unlinkSync(STATE_FILE);
  console.log(`\nDeleted state file: ${STATE_FILE}`);
  console.log("\nDone. Competition and all related data removed.\n");
}

main().catch((err) => {
  console.error("\nCleanup failed:", (err as Error).message);
  process.exit(1);
});
