import type { SupabaseClient } from "@supabase/supabase-js";
import type { Round } from "@/types/database";

// ============================================================
// All open (unlocked) prediction windows for a competition
// ============================================================

export async function getOpenPredictionWindows(
  supabase: SupabaseClient,
  competitionId: string
): Promise<Round[]> {
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "open")
    .order("round_number", { ascending: true });

  if (error) throw new Error(`Failed to fetch open prediction windows: ${error.message}`);
  return (data ?? []) as Round[];
}

// ============================================================
// Lock a prediction window — set round status to 'locked'
// ============================================================

export async function lockPredictionWindow(
  supabase: SupabaseClient,
  roundId: string
): Promise<void> {
  const { error } = await supabase
    .from("rounds")
    .update({ status: "locked" })
    .eq("id", roundId)
    .eq("status", "open"); // Guard: only lock if currently open

  if (error) throw new Error(`Failed to lock prediction window: ${error.message}`);
}

// ============================================================
// Next lock time across all open windows in a competition
// ============================================================

export async function getNextLockTime(
  supabase: SupabaseClient,
  competitionId: string
): Promise<Date | null> {
  // Find the earliest lock_time among events in open rounds for this competition
  const { data: openRounds, error: roundError } = await supabase
    .from("rounds")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("status", "open");

  if (roundError) throw new Error(`Failed to fetch open rounds: ${roundError.message}`);
  if (!openRounds || openRounds.length === 0) return null;

  const roundIds = openRounds.map((r: { id: string }) => r.id);

  const { data: events, error: eventError } = await supabase
    .from("events")
    .select("lock_time")
    .in("round_id", roundIds)
    .not("status", "in", '("cancelled","postponed")')
    .order("lock_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (eventError) throw new Error(`Failed to fetch events: ${eventError.message}`);
  if (!events?.lock_time) return null;

  return new Date(events.lock_time);
}

// ============================================================
// Windows that should be auto-locked (earliest event lock_time
// in the round is past, but round is still open)
// ============================================================

export async function getWindowsToLock(
  supabase: SupabaseClient,
  competitionId: string
): Promise<Pick<Round, "id" | "name">[]> {
  const now = new Date().toISOString();

  const { data: openRounds, error: roundError } = await supabase
    .from("rounds")
    .select("id, name")
    .eq("competition_id", competitionId)
    .eq("status", "open");

  if (roundError)
    throw new Error(
      `Failed to fetch open rounds for locking check: ${roundError.message}`
    );
  if (!openRounds || openRounds.length === 0) return [];

  const toLock: Pick<Round, "id" | "name">[] = [];

  for (const round of openRounds) {
    // Find the LATEST non-cancelled/postponed event lock_time in this round.
    // The round only locks when ALL its events have passed their lock_time,
    // so users can still predict later days within the same matchday round.
    const { data: latest, error: eventError } = await supabase
      .from("events")
      .select("lock_time")
      .eq("round_id", round.id)
      .not("status", "in", '("cancelled","postponed")')
      .order("lock_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (eventError)
      throw new Error(
        `Failed to fetch events for round ${round.id}: ${eventError.message}`
      );

    if (latest?.lock_time && latest.lock_time <= now) {
      toLock.push({ id: round.id, name: round.name });
    }
  }

  return toLock;
}

// ============================================================
// Classifications that need undersized-group reconciliation.
// Triggers when the first event in the competition has locked
// (competition has started). Runs every cron cycle — idempotent,
// no-op when no undersized groups exist. This handles both the
// initial reconciliation and any late joiners who create new
// undersized groups after the first reconciliation.
//
// Note: entry_closes_at and first-event lock are independent.
// Entry can close significantly after the first event locks.
// Reconciliation triggers on first-event lock, not entry close.
// ============================================================

export async function getClassificationsNeedingReconciliation(
  supabase: SupabaseClient,
  competitionId: string,
): Promise<{ classificationId: string }[]> {
  // Check if first event in the competition has locked
  const { data: allRounds } = await supabase
    .from("rounds")
    .select("id")
    .eq("competition_id", competitionId);

  if (!allRounds || allRounds.length === 0) return [];

  const roundIds = allRounds.map((r: { id: string }) => r.id);

  const { data: firstEvent } = await supabase
    .from("events")
    .select("lock_time")
    .in("round_id", roundIds)
    .not("status", "in", '("cancelled","postponed")')
    .order("lock_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstEvent?.lock_time) return [];

  const now = new Date().toISOString();
  if (firstEvent.lock_time > now) return []; // competition hasn't started

  // Find active format_elimination classifications
  const { data: classifications, error: clsError } = await supabase
    .from("classifications")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("classification_type", "format_elimination")
    .eq("status", "active");

  if (clsError) throw new Error(`Failed to fetch classifications: ${clsError.message}`);
  if (!classifications || classifications.length === 0) return [];

  // Filter to classifications that have groups (draw has happened)
  const result: { classificationId: string }[] = [];

  for (const cls of classifications) {

    // Check groups exist
    const { data: groupCheck } = await supabase
      .from("format_prediction_groups")
      .select("id")
      .eq("classification_id", cls.id)
      .limit(1);

    if (groupCheck && groupCheck.length > 0) {
      result.push({ classificationId: cls.id });
    }
  }

  return result;
}
