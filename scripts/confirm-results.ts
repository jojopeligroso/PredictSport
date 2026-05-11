/**
 * Confirm results from a YAML file and score all predictions.
 *
 * Usage:
 *   npx tsx scripts/confirm-results.ts fixtures/results-round1.yaml [--dry-run]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * Uses the service role key to bypass RLS.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { scorePrediction } from "../src/lib/scoring";
import type { PredictionType, EventPredictionType } from "../src/types/database";

// ---------------------------------------------------------------------------
// Env loading (same pattern as seed-quiz-2026.ts)
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
// YAML types
// ---------------------------------------------------------------------------

interface ResultEntry {
  external_event_id: string;
  result_data: Record<string, unknown>;
}

interface ResultsFile {
  results: ResultEntry[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const yamlPath = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");

  if (!yamlPath) {
    console.error("Usage: npx tsx scripts/confirm-results.ts <results.yaml> [--dry-run]");
    process.exit(1);
  }

  const fileContent = readFileSync(resolve(yamlPath), "utf-8");
  const parsed = yaml.load(fileContent) as ResultsFile;

  if (!parsed?.results || !Array.isArray(parsed.results)) {
    console.error("Invalid YAML: expected a 'results' array at top level");
    process.exit(1);
  }

  if (dryRun) {
    console.log("[DRY RUN] No changes will be written to the database.\n");
  }

  let confirmed = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of parsed.results) {
    const { external_event_id, result_data } = entry;

    if (!external_event_id) {
      console.error("  SKIP: entry missing external_event_id");
      skipped++;
      continue;
    }

    if (!result_data || Object.keys(result_data).length === 0) {
      console.error(`  SKIP: ${external_event_id} — no result_data`);
      skipped++;
      continue;
    }

    // Look up the event by external_event_id
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, event_name, result_confirmed, competition_id")
      .eq("external_event_id", external_event_id)
      .maybeSingle();

    if (eventError) {
      console.error(`  ERROR: ${external_event_id} — ${eventError.message}`);
      errors++;
      continue;
    }

    if (!event) {
      console.error(`  NOT FOUND: ${external_event_id} — no matching event in DB`);
      errors++;
      continue;
    }

    if (event.result_confirmed) {
      console.log(`  ALREADY CONFIRMED: "${event.event_name}" — skipping`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  WOULD CONFIRM: "${event.event_name}" (${event.id})`);
      skipped++;
      continue;
    }

    // Confirm: update event with result_data, result_confirmed=true, status='resulted'
    // Use .eq("result_confirmed", false) to prevent double-scoring
    const { data: confirmedEvent, error: updateError } = await supabase
      .from("events")
      .update({
        result_data,
        result_confirmed: true,
        status: "resulted",
      })
      .eq("id", event.id)
      .eq("result_confirmed", false)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error(`  ERROR confirming "${event.event_name}": ${updateError.message}`);
      errors++;
      continue;
    }

    if (!confirmedEvent) {
      console.log(`  ALREADY CONFIRMED (concurrent): "${event.event_name}" — skipping`);
      skipped++;
      continue;
    }

    // Fetch event_prediction_types for this event
    const { data: eptRows } = await supabase
      .from("event_prediction_types")
      .select("*")
      .eq("event_id", event.id);

    const eptMap = new Map<string, EventPredictionType>();
    for (const row of eptRows ?? []) {
      eptMap.set(row.prediction_type, row as EventPredictionType);
    }

    // Fetch all predictions for this event
    const { data: predictions, error: predError } = await supabase
      .from("predictions")
      .select("*")
      .eq("event_id", event.id);

    if (predError) {
      console.error(`  ERROR fetching predictions for "${event.event_name}": ${predError.message}`);
      errors++;
      continue;
    }

    // Score each prediction
    let scored = 0;
    let scoreErrors = 0;

    for (const prediction of predictions ?? []) {
      const predType = prediction.prediction_type as PredictionType;
      const ept = eptMap.get(predType);

      const eptData = ept ?? {
        points: 10,
        partial_points: 0,
        config: null,
      };

      const result = scorePrediction(
        predType,
        prediction.prediction_data as Record<string, unknown>,
        result_data as Record<string, unknown>,
        eptData
      );

      const { error: scoreError } = await supabase
        .from("predictions")
        .update({
          is_correct: result.is_correct,
          is_partial: result.is_partial,
          points_awarded: result.points_awarded,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prediction.id);

      if (scoreError) {
        scoreErrors++;
      } else {
        scored++;
      }
    }

    console.log(
      `  CONFIRMED: "${event.event_name}" — ${scored} predictions scored` +
        (scoreErrors > 0 ? `, ${scoreErrors} scoring errors` : "")
    );
    confirmed++;
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`  Total entries: ${parsed.results.length}`);
  console.log(`  Confirmed:     ${confirmed}`);
  console.log(`  Skipped:       ${skipped}`);
  console.log(`  Errors:        ${errors}`);

  if (dryRun) {
    console.log("\n[DRY RUN] No changes were written.");
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
