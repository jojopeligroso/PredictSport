import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PredictionWindowSelector } from "@/components/tournament/PredictionWindowSelector";
import { getWcBracketSnapshot } from "@/lib/tournament/bracket-snapshot";

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

  // Get events + their prediction-type rows per window. The exact_score EPT
  // existence is what makes a match eligible for a tiebreaker prediction
  // (group fixtures: yes; knockouts: no), so we use it to size the
  // "scores predicted" denominator.
  const windowData = await Promise.all(
    (windows ?? []).map(async (w: { id: string; name: string; round_number: number; status: string; deadline: string | null; sporting_stage_id: string | null; prediction_window_number: number | null }) => {
      const { data: events } = await supabase
        .from("events")
        .select("id, lock_time, status, event_prediction_types(prediction_type)")
        .eq("round_id", w.id)
        .order("lock_time", { ascending: true });

      const evs = (events ?? []) as Array<{
        id: string;
        lock_time: string;
        status: string;
        event_prediction_types: { prediction_type: string }[] | null;
      }>;
      const eventCount = evs.length;
      const earliestLock = evs[0]?.lock_time ?? null;
      const allResulted = eventCount > 0 && evs.every((e) => e.status === "resulted");
      const scoreEligibleCount = evs.filter((e) =>
        (e.event_prediction_types ?? []).some((ept) => ept.prediction_type === "exact_score"),
      ).length;

      return {
        ...w,
        eventCount,
        earliestLock,
        allResulted: allResulted ?? false,
        scoreEligibleCount,
      };
    })
  );

  // Get user's prediction rows for this competition. We need the
  // prediction_type so we can split the "winner" count (matches picked) from
  // the "exact_score" count (scores predicted).
  const { data: userPredictions } = await supabase
    .from("predictions")
    .select("event_id, prediction_type, events!inner(round_id)")
    .eq("user_id", user.id)
    .eq("events.competition_id", competition.id);

  // Tally per round, deduping by event_id within each {round, type} bucket so
  // duplicate rows can never inflate either counter.
  const winnerEventsByRound = new Map<string, Set<string>>();
  const scoreEventsByRound = new Map<string, Set<string>>();
  for (const p of userPredictions ?? []) {
    const row = p as unknown as {
      event_id: string;
      prediction_type: string;
      events: { round_id: string };
    };
    const roundId = row.events?.round_id;
    if (!roundId || !row.event_id) continue;
    const target =
      row.prediction_type === "exact_score"
        ? scoreEventsByRound
        : row.prediction_type === "winner"
          ? winnerEventsByRound
          : null;
    if (!target) continue;
    let set = target.get(roundId);
    if (!set) {
      set = new Set<string>();
      target.set(roundId, set);
    }
    set.add(row.event_id);
  }

  const enrichedWindows = windowData.map((w) => ({
    ...w,
    userPredictionCount: winnerEventsByRound.get(w.id)?.size ?? 0,
    userScoreCount: scoreEventsByRound.get(w.id)?.size ?? 0,
  }));

  // The full_bracket classification is a parallel surface that owns
  // tiebreaker scores and best-thirds-ranking — decisions that don't exist
  // anywhere in the matchday flow. We surface it twice here: once as a
  // pinned hero card above the list (loud, hard to miss), and once as a row
  // inside the list (familiar shape, sits alongside the other windows). Both
  // disappear once the bracket is locked.
  const bracket = await getWcBracketSnapshot(supabase, user.id);
  const showBracket = bracket && bracket.status !== "locked";

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">Your Picks</h1>
      <p className="mt-1 text-sm text-ps-text-sec">
        Select a matchday to make your predictions.
      </p>

      {showBracket && (
        <Link
          href={`/wc/bracket/wizard?classificationId=${bracket.classificationId}`}
          className="mt-5 block rounded-xl border-2 border-ps-amber/40 bg-ps-amber/5 p-4 transition-all hover:border-ps-amber/70 hover:bg-ps-amber/10 active:scale-[0.99]"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-amber-deep">
              Your bracket
            </span>
            <span className="font-mono text-[10px] font-bold text-ps-amber-deep">
              {bracket.pct}%
            </span>
          </div>
          <p className="mt-1 text-base font-extrabold text-ps-text">
            {bracket.pct === 0
              ? "Start your bracket"
              : bracket.pct === 100
                ? "Review & submit your bracket"
                : "Continue your bracket"}
          </p>
          <p className="mt-0.5 text-xs text-ps-text-sec">
            {bracket.label} · tiebreakers and best thirds live here, not in matchdays.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ps-chip">
            <div
              className="h-full bg-ps-amber transition-all duration-300"
              style={{ width: `${bracket.pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-ps-amber-deep">
            Open bracket →
          </p>
        </Link>
      )}

      <div className="mt-6">
        <PredictionWindowSelector
          windows={enrichedWindows}
          competitionId={competition.id}
          bracket={showBracket ? bracket : null}
        />
      </div>
    </div>
  );
}
