import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PredictionWindowSelector } from "@/components/tournament/PredictionWindowSelector";

export const dynamic = "force-dynamic";

/**
 * /picks — Prediction window selector for World Cup picks.
 * Shows all open windows with status chips. Tap to navigate to window picks.
 */
export default async function PicksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/picks");
  }

  // Find the WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, status")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"])
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">No active competition</h1>
        <p className="mt-2 text-sm text-ps-text-sec">The World Cup prediction game hasn&apos;t started yet.</p>
      </div>
    );
  }

  // Get all prediction windows (rounds)
  const { data: windows } = await supabase
    .from("rounds")
    .select("id, name, round_number, status, deadline, sporting_stage_id, prediction_window_number")
    .eq("competition_id", competition.id)
    .order("round_number", { ascending: true });

  // Get event counts and earliest lock time per window
  const windowData = await Promise.all(
    (windows ?? []).map(async (w: { id: string; name: string; round_number: number; status: string; deadline: string | null; sporting_stage_id: string | null; prediction_window_number: number | null }) => {
      const { data: events } = await supabase
        .from("events")
        .select("id, lock_time, status")
        .eq("round_id", w.id)
        .order("lock_time", { ascending: true });

      const eventCount = events?.length ?? 0;
      const earliestLock = events?.[0]?.lock_time ?? null;
      const allResulted = eventCount > 0 && events?.every((e: { status: string }) => e.status === "resulted");

      return {
        ...w,
        eventCount,
        earliestLock,
        allResulted: allResulted ?? false,
      };
    })
  );

  // Get user's prediction counts per window
  const { data: userPredictions } = await supabase
    .from("predictions")
    .select("event_id, events!inner(round_id)")
    .eq("user_id", user.id)
    .eq("events.competition_id", competition.id);

  const predCountByWindow = new Map<string, number>();
  for (const p of userPredictions ?? []) {
    const roundId = (p as unknown as { events: { round_id: string } }).events?.round_id;
    if (roundId) {
      predCountByWindow.set(roundId, (predCountByWindow.get(roundId) ?? 0) + 1);
    }
  }

  const enrichedWindows = windowData.map((w) => ({
    ...w,
    userPredictionCount: predCountByWindow.get(w.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="text-xl font-extrabold text-ps-text">Your Picks</h1>
      <p className="mt-1 text-sm text-ps-text-sec">
        Select a matchday to make your predictions.
      </p>
      <div className="mt-6">
        <PredictionWindowSelector
          windows={enrichedWindows}
          competitionId={competition.id}
        />
      </div>
    </div>
  );
}
