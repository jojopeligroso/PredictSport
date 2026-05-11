/**
 * Ingest fixtures from a YAML file into Supabase.
 *
 * TWO MODES:
 *
 * 1. Pool mode — top-level key: `sporting_events`
 *    Inserts/upserts into the `sporting_events` table (sport-agnostic library).
 *    No prediction competition needed. These events appear in the fixture browser
 *    for competition creators to pick from.
 *
 * 2. Competition mode — top-level key: `competition`
 *    Upserts a prediction competition, its rounds, events, and event_prediction_types.
 *    Each event gets a `competition_id`. Use this when you already know the competition.
 *
 * Both modes are idempotent (safe to re-run).
 *
 * Usage:
 *   npx tsx scripts/ingest-fixtures.ts <fixture-file.yaml>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { getTimingForSport } from "../src/lib/sports/timing.ts";

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

function loadEnv(filePath: string) {
  try {
    const content = readFileSync(resolve(filePath), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // File not found
  }
}

loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// YAML schema types
// ---------------------------------------------------------------------------

// --- Pool mode ---

interface PoolEvent {
  event_name: string;
  sport: string;
  start_time: string;
  participants?: string[];
  competition_name?: string;   // real-world sporting competition (e.g. "Leinster SHC 2026")
}

interface PoolFile {
  sporting_events: PoolEvent[];
}

// --- Competition mode ---

interface FixturePredictionType {
  type: string;
  points?: number;
  partial_points?: number;
  config?: Record<string, unknown>;
}

interface FixtureEvent {
  event_name: string;
  sport: string;
  start_time: string;
  lock_time?: string;
  result_check_after?: string;
  prediction_types: FixturePredictionType[];
}

interface FixtureRound {
  round_number: number;
  name: string;
  events: FixtureEvent[];
}

interface FixtureCompetition {
  name: string;
  description?: string;
  type?: "fixed" | "open";
  visibility?: "public" | "private";
  status?: "draft" | "active";
  allow_prediction_updates?: boolean;
  lock_default_minutes?: number;
  scoring_rules?: Record<string, unknown>;
}

interface CompetitionFile {
  competition: FixtureCompetition;
  rounds: FixtureRound[];
}

// Union — at least one top-level key must be present
type FixtureFile = PoolFile | CompetitionFile | (PoolFile & CompetitionFile);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function computeExternalId(eventName: string, startTime: string): string {
  return "manual:" + slugify(eventName + "-" + startTime.slice(0, 10));
}

function computeLockTime(
  startTime: string,
  explicit: string | undefined,
  lockDefaultMinutes: number
): string {
  if (explicit) {
    const lockMs = new Date(explicit).getTime();
    const startMs = new Date(startTime).getTime();
    if (lockMs >= startMs) {
      throw new Error(
        `lock_time (${explicit}) must be before start_time (${startTime})`
      );
    }
    return new Date(lockMs).toISOString();
  }
  const startMs = new Date(startTime).getTime();
  return new Date(startMs - lockDefaultMinutes * 60_000).toISOString();
}

function computeResultCheckAfter(
  startTime: string,
  explicit: string | undefined,
  sport: string
): string {
  if (explicit) {
    return new Date(explicit).toISOString();
  }
  const timing = getTimingForSport(sport);
  const startMs = new Date(startTime).getTime();
  return new Date(startMs + timing.checkAfterHours * 3_600_000).toISOString();
}

// ---------------------------------------------------------------------------
// Pool mode
// ---------------------------------------------------------------------------

function validatePool(file: PoolFile): void {
  if (!Array.isArray(file.sporting_events) || file.sporting_events.length === 0) {
    throw new Error("sporting_events must be a non-empty array");
  }

  const seen = new Set<string>();

  for (let i = 0; i < file.sporting_events.length; i++) {
    const ev = file.sporting_events[i];
    const label = `sporting_events[${i}]`;

    if (!ev.event_name) throw new Error(`${label}.event_name is required`);
    if (!ev.sport) throw new Error(`${label}.sport is required`);
    if (!ev.start_time) throw new Error(`${label}.start_time is required`);
    if (isNaN(new Date(ev.start_time).getTime())) {
      throw new Error(`${label}.start_time is not a valid ISO 8601 date: "${ev.start_time}"`);
    }

    const externalId = computeExternalId(ev.event_name, ev.start_time);
    if (seen.has(externalId)) {
      throw new Error(
        `Duplicate external_event_id "${externalId}" for "${ev.event_name}". Rename one to disambiguate.`
      );
    }
    seen.add(externalId);
  }
}

async function ingestPool(sb: SupabaseClient, file: PoolFile): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const ev of file.sporting_events) {
    const externalId = computeExternalId(ev.event_name, ev.start_time);

    const row = {
      event_name: ev.event_name,
      sport: ev.sport,
      start_time: new Date(ev.start_time).toISOString(),
      participants: ev.participants ?? [],
      competition_name: ev.competition_name ?? null,
      external_event_id: externalId,
      source: "manual",
    };

    // Select by external_event_id (no unique index — do it manually)
    const { data: existing, error: selError } = await sb
      .from("sporting_events")
      .select("id")
      .eq("external_event_id", externalId)
      .maybeSingle();

    if (selError) {
      throw new Error(`Failed to query sporting_event "${ev.event_name}": ${selError.message}`);
    }

    if (existing) {
      const { error: updError } = await sb
        .from("sporting_events")
        .update(row)
        .eq("id", existing.id);
      if (updError) {
        throw new Error(`Failed to update "${ev.event_name}": ${updError.message}`);
      }
      console.log(`  ~ ${ev.event_name} (updated) [${externalId}]`);
      updated++;
    } else {
      const { error: insError } = await sb.from("sporting_events").insert(row);
      if (insError) {
        throw new Error(`Failed to insert "${ev.event_name}": ${insError.message}`);
      }
      console.log(`  + ${ev.event_name} (created) [${externalId}]`);
      created++;
    }
  }

  const total = created + updated;
  console.log(
    `\nPool summary: ${total} event${total !== 1 ? "s" : ""} (${created} created, ${updated} updated)`
  );
}

// ---------------------------------------------------------------------------
// Competition mode
// ---------------------------------------------------------------------------

function validateCompetition(fixture: CompetitionFile): void {
  const { competition, rounds } = fixture;

  if (!competition?.name) {
    throw new Error("competition.name is required");
  }

  if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
    throw new Error("At least one round is required");
  }

  const seen = new Set<string>();

  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const rLabel = `rounds[${ri}]`;

    if (round.round_number == null || typeof round.round_number !== "number") {
      throw new Error(`${rLabel}.round_number is required and must be a number`);
    }
    if (!round.name) {
      throw new Error(`${rLabel}.name is required`);
    }
    if (!round.events || !Array.isArray(round.events) || round.events.length === 0) {
      throw new Error(`${rLabel} must have at least one event`);
    }

    for (let ei = 0; ei < round.events.length; ei++) {
      const event = round.events[ei];
      const eLabel = `${rLabel}.events[${ei}]`;

      if (!event.event_name) throw new Error(`${eLabel}.event_name is required`);
      if (!event.sport) throw new Error(`${eLabel}.sport is required`);
      if (!event.start_time) throw new Error(`${eLabel}.start_time is required`);

      if (isNaN(new Date(event.start_time).getTime())) {
        throw new Error(`${eLabel}.start_time is not a valid ISO 8601 date: "${event.start_time}"`);
      }

      if (
        !event.prediction_types ||
        !Array.isArray(event.prediction_types) ||
        event.prediction_types.length === 0
      ) {
        throw new Error(`${eLabel}.prediction_types must have at least one entry`);
      }

      for (let pi = 0; pi < event.prediction_types.length; pi++) {
        const pt = event.prediction_types[pi];
        if (!pt.type) {
          throw new Error(`${eLabel}.prediction_types[${pi}].type is required`);
        }
      }

      const externalId = computeExternalId(event.event_name, event.start_time);
      if (seen.has(externalId)) {
        throw new Error(
          `Duplicate external_event_id "${externalId}" for event "${event.event_name}". ` +
          `Two events produce the same slug. Rename one to disambiguate.`
        );
      }
      seen.add(externalId);
    }
  }
}

async function upsertCompetition(
  sb: SupabaseClient,
  compDef: FixtureCompetition
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: selectError } = await sb
    .from("competitions")
    .select("id")
    .eq("name", compDef.name)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to query competition: ${selectError.message}`);
  }

  const fields: Record<string, unknown> = { name: compDef.name };
  if (compDef.description != null) fields.description = compDef.description;
  if (compDef.type != null) fields.type = compDef.type;
  if (compDef.visibility != null) fields.visibility = compDef.visibility;
  if (compDef.status != null) fields.status = compDef.status;
  if (compDef.allow_prediction_updates != null)
    fields.allow_prediction_updates = compDef.allow_prediction_updates;
  if (compDef.lock_default_minutes != null)
    fields.lock_default_minutes = compDef.lock_default_minutes;
  if (compDef.scoring_rules != null) fields.scoring_rules = compDef.scoring_rules;

  if (existing) {
    const { error: updateError } = await sb
      .from("competitions")
      .update(fields)
      .eq("id", existing.id);
    if (updateError) {
      throw new Error(`Failed to update competition: ${updateError.message}`);
    }
    return { id: existing.id, created: false };
  }

  const { data: adminUser, error: userError } = await sb
    .from("users")
    .select("id")
    .limit(1)
    .single();

  if (userError || !adminUser) {
    throw new Error(
      "No users found. Log in to the app first to create a user profile."
    );
  }

  const insertFields = {
    ...fields,
    type: compDef.type ?? "fixed",
    visibility: compDef.visibility ?? "private",
    status: compDef.status ?? "active",
    allow_prediction_updates: compDef.allow_prediction_updates ?? false,
    lock_default_minutes: compDef.lock_default_minutes ?? 30,
    scoring_rules: compDef.scoring_rules ?? {},
    created_by: adminUser.id,
  };

  const { data: inserted, error: insertError } = await sb
    .from("competitions")
    .insert(insertFields)
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to create competition: ${insertError.message}`);
  }

  return { id: inserted.id, created: true };
}

async function upsertRound(
  sb: SupabaseClient,
  competitionId: string,
  roundDef: FixtureRound
): Promise<{ id: string }> {
  const { data, error } = await sb
    .from("rounds")
    .upsert(
      {
        competition_id: competitionId,
        round_number: roundDef.round_number,
        name: roundDef.name,
        status: "open",
      },
      { onConflict: "competition_id,round_number" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Failed to upsert round ${roundDef.round_number}: ${error.message}`
    );
  }

  return { id: data.id };
}

async function upsertEvent(
  sb: SupabaseClient,
  competitionId: string,
  roundId: string,
  eventDef: FixtureEvent,
  lockDefaultMinutes: number
): Promise<{ id: string; action: "created" | "updated" }> {
  const externalId = computeExternalId(eventDef.event_name, eventDef.start_time);
  const lockTime = computeLockTime(
    eventDef.start_time,
    eventDef.lock_time,
    lockDefaultMinutes
  );
  const resultCheckAfter = computeResultCheckAfter(
    eventDef.start_time,
    eventDef.result_check_after,
    eventDef.sport
  );

  const eventFields = {
    competition_id: competitionId,
    round_id: roundId,
    event_name: eventDef.event_name,
    sport: eventDef.sport,
    start_time: new Date(eventDef.start_time).toISOString(),
    lock_time: lockTime,
    external_event_id: externalId,
    result_data: {
      auto_result_check_after: resultCheckAfter,
      auto_result_status: "pending",
    },
  };

  const { data: existing, error: selectError } = await sb
    .from("events")
    .select("id")
    .eq("external_event_id", externalId)
    .maybeSingle();

  if (selectError) {
    throw new Error(
      `Failed to query event "${eventDef.event_name}": ${selectError.message}`
    );
  }

  let eventId: string;
  let action: "created" | "updated";

  if (existing) {
    const { error: updateError } = await sb
      .from("events")
      .update(eventFields)
      .eq("id", existing.id);
    if (updateError) {
      throw new Error(
        `Failed to update event "${eventDef.event_name}": ${updateError.message}`
      );
    }
    eventId = existing.id;
    action = "updated";
  } else {
    const { data: inserted, error: insertError } = await sb
      .from("events")
      .insert(eventFields)
      .select("id")
      .single();
    if (insertError) {
      throw new Error(
        `Failed to create event "${eventDef.event_name}": ${insertError.message}`
      );
    }
    eventId = inserted.id;
    action = "created";
  }

  // Delete existing event_prediction_types, then reinsert
  const { error: deleteError } = await sb
    .from("event_prediction_types")
    .delete()
    .eq("event_id", eventId);

  if (deleteError) {
    throw new Error(
      `Failed to clear prediction types for "${eventDef.event_name}": ${deleteError.message}`
    );
  }

  const eptRows = eventDef.prediction_types.map((pt) => ({
    event_id: eventId,
    prediction_type: pt.type,
    points: pt.points ?? 10,
    partial_points: pt.partial_points ?? 0,
    config: pt.config ?? null,
  }));

  const { error: eptError } = await sb
    .from("event_prediction_types")
    .insert(eptRows);

  if (eptError) {
    throw new Error(
      `Failed to insert prediction types for "${eventDef.event_name}": ${eptError.message}`
    );
  }

  return { id: eventId, action };
}

async function ingestCompetition(sb: SupabaseClient, fixture: CompetitionFile): Promise<void> {
  const lockDefaultMinutes = fixture.competition.lock_default_minutes ?? 30;

  const comp = await upsertCompetition(sb, fixture.competition);
  console.log(
    `Competition: "${fixture.competition.name}" (${comp.created ? "created" : "updated"})`
  );

  let roundCount = 0;
  let eventCreated = 0;
  let eventUpdated = 0;

  for (const roundDef of fixture.rounds) {
    const round = await upsertRound(sb, comp.id, roundDef);
    roundCount++;

    console.log(`  Round ${roundDef.round_number} "${roundDef.name}"`);

    for (const eventDef of roundDef.events) {
      const result = await upsertEvent(
        sb,
        comp.id,
        round.id,
        eventDef,
        lockDefaultMinutes
      );

      const externalId = computeExternalId(eventDef.event_name, eventDef.start_time);

      if (result.action === "created") eventCreated++;
      else eventUpdated++;

      const symbol = result.action === "created" ? "+" : "~";
      console.log(
        `    ${symbol} ${eventDef.event_name} (${result.action}) [${externalId}]`
      );
    }
  }

  const total = eventCreated + eventUpdated;
  console.log(
    `\nCompetition summary: 1 competition, ${roundCount} round${roundCount !== 1 ? "s" : ""}, ` +
    `${total} event${total !== 1 ? "s" : ""} (${eventCreated} created, ${eventUpdated} updated)`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      "Usage: npx tsx scripts/ingest-fixtures.ts <fixture-file.yaml>"
    );
    process.exit(1);
  }

  console.log(`\nIngesting: ${filePath}\n`);

  const raw = readFileSync(resolve(filePath), "utf-8");
  const fixture = yaml.load(raw) as FixtureFile;

  if (!fixture || typeof fixture !== "object") {
    throw new Error("Failed to parse YAML file — expected an object");
  }

  const hasPool = "sporting_events" in fixture;
  const hasCompetition = "competition" in fixture;

  if (!hasPool && !hasCompetition) {
    throw new Error(
      "YAML file must have a top-level `sporting_events` key (pool mode) " +
      "or a `competition` key (competition mode), or both."
    );
  }

  // Pool mode
  if (hasPool) {
    const poolFile = fixture as PoolFile;
    validatePool(poolFile);
    console.log("Mode: pool (sporting_events table)\n");
    await ingestPool(supabase, poolFile);
  }

  // Competition mode
  if (hasCompetition) {
    const compFile = fixture as CompetitionFile;
    validateCompetition(compFile);
    if (hasPool) console.log("\nMode: competition (prediction competition)\n");
    else console.log("Mode: competition (prediction competition)\n");
    await ingestCompetition(supabase, compFile);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
