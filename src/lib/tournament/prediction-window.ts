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
    // Find the earliest non-cancelled/postponed event lock_time in this round
    const { data: earliest, error: eventError } = await supabase
      .from("events")
      .select("lock_time")
      .eq("round_id", round.id)
      .not("status", "in", '("cancelled","postponed")')
      .order("lock_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (eventError)
      throw new Error(
        `Failed to fetch events for round ${round.id}: ${eventError.message}`
      );

    if (earliest?.lock_time && earliest.lock_time <= now) {
      toLock.push({ id: round.id, name: round.name });
    }
  }

  return toLock;
}
