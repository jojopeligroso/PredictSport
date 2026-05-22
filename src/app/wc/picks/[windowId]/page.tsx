import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { WindowPickList, type WindowEvent } from "./WindowPickList";
import type { Prediction } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * /wc/picks/[windowId] — Single World Cup matchday window picks page (U2).
 *
 * Server component: handles auth, ensures the user is enrolled in the WC
 * competition, fetches the window's events + the user's existing predictions,
 * then delegates the interactive pick UI to <WindowPickList>.
 */
export default async function WindowPicksPage({
  params,
}: {
  params: Promise<{ windowId: string }>;
}) {
  const { windowId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/wc/picks/${windowId}`);
  }

  // Get the round (window) and its competition.
  const { data: round } = await supabase
    .from("rounds")
    .select("id, name, competition_id, status, sporting_stage_id")
    .eq("id", windowId)
    .single();

  if (!round) {
    notFound();
  }

  // The pick API requires competition membership. A logged-in user who reached
  // this page without going through /wc/join would 403 on every pick — route
  // them through join (idempotent enrollment) and back here.
  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", round.competition_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect(`/wc/join?next=/wc/picks/${windowId}`);
  }

  // round.status ∈ "draft" | "open" | "locked" | "scored" (RoundStatus).
  // 'draft' (knockout windows) — not open for picks yet.
  // 'locked' / 'scored' — the whole window is closed; render read-only even
  // for events whose own lock_time hasn't passed (e.g. an admin override).
  const isDraft = round.status === "draft";
  const isFinalised = round.status === "scored";
  const isWindowLocked = round.status === "locked" || round.status === "scored";

  // Get events in this window with their prediction types.
  const { data: eventsRaw } = await supabase
    .from("events")
    .select(`
      id, event_name, sport, start_time, lock_time, status, result_confirmed,
      event_prediction_types (id, event_id, prediction_type, points, partial_points, config)
    `)
    .eq("round_id", windowId)
    .order("start_time", { ascending: true });

  const events = (eventsRaw ?? []) as WindowEvent[];

  // Get the user's existing predictions for this window's events (display +
  // pre-fill). U2 only reads these; the bracket→windows carry-over is U3/U4.
  const eventIds = events.map((e) => e.id);
  const { data: predictionsRaw } =
    eventIds.length > 0
      ? await supabase
          .from("predictions")
          .select(
            "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at",
          )
          .eq("user_id", user.id)
          .in("event_id", eventIds)
      : { data: [] };

  const predictions = (predictionsRaw ?? []) as Prediction[];

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <Link
        href="/wc/picks"
        className="text-sm font-medium text-ps-text-sec hover:text-ps-text"
      >
        &larr; All windows
      </Link>

      <h1 className="mt-3 text-xl font-extrabold text-ps-text">{round.name}</h1>

      {(isFinalised || (isWindowLocked && !isFinalised)) && (
        <div className="mt-2 inline-block rounded-full bg-ps-amber/20 px-3 py-1 text-xs font-semibold text-ps-amber">
          {isFinalised ? "Finalised" : "Locked"}
        </div>
      )}

      {isDraft ? (
        <p className="mt-6 rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center text-sm text-ps-text-sec">
          This window isn&apos;t open for predictions yet.
        </p>
      ) : (
        <div className="mt-6">
          <WindowPickList
            competitionId={round.competition_id}
            events={events}
            predictions={predictions}
            windowLocked={isWindowLocked}
          />
        </div>
      )}
    </div>
  );
}
