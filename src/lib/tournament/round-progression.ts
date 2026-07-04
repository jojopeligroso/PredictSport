import { createServiceClient } from "@/lib/supabase/service";

/**
 * Auto Round Progression (ARP-1)
 *
 * After a result is confirmed, check if ALL events in that round now have
 * result_confirmed = true. If so, find the next round (round_number + 1)
 * for the same competition and open it.
 *
 * Idempotent: re-confirming a result or calling multiple times is safe.
 * Both white-label (tournament_id IS NOT NULL) and custom competitions
 * auto-progress by default.
 */
export async function checkAndAdvanceRound(
  eventId: string,
  competitionId: string,
): Promise<void> {
  const supabase = createServiceClient();

  // 1. Find the round this event belongs to
  const { data: event } = await supabase
    .from("events")
    .select("round_id")
    .eq("id", eventId)
    .single();

  if (!event?.round_id) return; // No round — nothing to advance

  // 2. Get the current round's details (need round_number)
  const { data: currentRound } = await supabase
    .from("rounds")
    .select("id, round_number, competition_id, status")
    .eq("id", event.round_id)
    .single();

  if (!currentRound) return;

  // 3. Check if ALL events in this round are confirmed
  const { data: roundEvents } = await supabase
    .from("events")
    .select("id, result_confirmed")
    .eq("round_id", currentRound.id)
    .limit(200);

  if (!roundEvents || roundEvents.length === 0) return;

  const allConfirmed = roundEvents.every((e) => e.result_confirmed === true);
  if (!allConfirmed) return;

  // 4. Mark current round as scored (if not already)
  if (currentRound.status !== "scored") {
    await supabase
      .from("rounds")
      .update({ status: "scored" })
      .eq("id", currentRound.id);
  }

  // 5. Find next round by round_number + 1
  const { data: nextRound } = await supabase
    .from("rounds")
    .select("id, status")
    .eq("competition_id", competitionId)
    .eq("round_number", currentRound.round_number + 1)
    .single();

  if (!nextRound) return; // No next round — tournament is complete

  // 6. Only open if currently in draft state (idempotent — already open/locked/scored is fine)
  if (nextRound.status !== "draft") return;

  const { error } = await supabase
    .from("rounds")
    .update({ status: "open" })
    .eq("id", nextRound.id);

  if (error) {
    console.error(
      `[round-progression] Failed to open round ${nextRound.id}:`,
      error.message,
    );
    return;
  }

  console.log(
    `[round-progression] Round ${currentRound.round_number} fully confirmed — opened round ${currentRound.round_number + 1} (${nextRound.id})`,
  );
}
