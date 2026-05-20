import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finaliseWindow } from "@/lib/tournament/finalisation";

export const dynamic = "force-dynamic";

/**
 * Auto-finalise cron — runs every 5 minutes.
 * Finds completed but unfinalised prediction windows and auto-finalises them
 * if the next dependent window locks within 15 minutes.
 */
export async function GET() {
  const supabase = await createClient();
  const now = new Date();
  const fifteenMinutes = 15 * 60 * 1000;

  // Find tournament competitions
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"]);

  const finalised: string[] = [];
  const skipped: string[] = [];

  for (const comp of competitions ?? []) {
    // Find locked (not yet scored) windows where all events have results confirmed
    const { data: lockedWindows } = await supabase
      .from("rounds")
      .select("id, name, round_number")
      .eq("competition_id", comp.id)
      .eq("status", "locked")
      .order("round_number", { ascending: true });

    for (const window of lockedWindows ?? []) {
      // Check if all events in this window are resulted and confirmed
      const { data: events } = await supabase
        .from("events")
        .select("id, status, result_confirmed")
        .eq("round_id", window.id);

      if (!events?.length) continue;

      const allConfirmed = events.every(
        (e) => e.status === "resulted" && e.result_confirmed
      );

      if (!allConfirmed) {
        skipped.push(`${window.name}: not all results confirmed`);
        continue;
      }

      // Check if the next window locks within 15 minutes
      const { data: nextWindow } = await supabase
        .from("rounds")
        .select("id")
        .eq("competition_id", comp.id)
        .gt("round_number", window.round_number)
        .eq("status", "open")
        .order("round_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      let shouldAutoFinalise = false;

      if (nextWindow) {
        // Find earliest lock_time in the next window
        const { data: nextEvents } = await supabase
          .from("events")
          .select("lock_time")
          .eq("round_id", nextWindow.id)
          .order("lock_time", { ascending: true })
          .limit(1);

        if (nextEvents?.length) {
          const nextLock = new Date(nextEvents[0].lock_time);
          shouldAutoFinalise = nextLock.getTime() - now.getTime() < fifteenMinutes;
        }
      } else {
        // No next window — auto-finalise anyway (last window in tournament)
        shouldAutoFinalise = true;
      }

      if (shouldAutoFinalise) {
        try {
          await finaliseWindow(supabase, window.id, null);
          finalised.push(window.name);
        } catch (err) {
          skipped.push(
            `${window.name}: finalisation error - ${err instanceof Error ? err.message : "unknown"}`
          );
        }
      } else {
        skipped.push(`${window.name}: next window not imminent`);
      }
    }
  }

  return NextResponse.json({
    finalised,
    skipped,
    checkedAt: now.toISOString(),
  });
}
