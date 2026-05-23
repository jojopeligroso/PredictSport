import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PicksClient } from "./PicksClient";
import type { WindowEvent } from "./WindowPickList";
import type { Prediction } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * /wc/picks/[windowId] — Single World Cup matchday window picks page.
 *
 * Server component: handles auth, ensures the user is enrolled in the WC
 * competition, fetches the window's events + the user's existing predictions,
 * resolves the prev/next sibling windows for in-page navigation, then hands
 * the interactive UI to <PicksClient>.
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

  const { data: round } = await supabase
    .from("rounds")
    .select("id, name, competition_id, status, sporting_stage_id, round_number")
    .eq("id", windowId)
    .single();

  if (!round) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", round.competition_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect(`/wc/join?next=/wc/picks/${windowId}`);
  }

  const isDraft = round.status === "draft";
  const isFinalised = round.status === "scored";
  const isWindowLocked = round.status === "locked" || round.status === "scored";

  // Sibling windows for prev/next navigation. Ordered by round_number; we
  // pick the immediate neighbours so the celebration's "Next matchday" CTA
  // and the page's "← Prev" link know where to go.
  const { data: siblings } = await supabase
    .from("rounds")
    .select("id, name, round_number, status")
    .eq("competition_id", round.competition_id)
    .order("round_number", { ascending: true });

  const siblingList = siblings ?? [];
  const idx = siblingList.findIndex((s) => s.id === windowId);
  const prevWindow = idx > 0 ? siblingList[idx - 1] : null;
  const nextWindow =
    idx >= 0 && idx < siblingList.length - 1 ? siblingList[idx + 1] : null;

  const { data: eventsRaw } = await supabase
    .from("events")
    .select(`
      id, event_name, sport, start_time, lock_time, status, result_confirmed,
      event_prediction_types (id, event_id, prediction_type, points, partial_points, config)
    `)
    .eq("round_id", windowId)
    .order("start_time", { ascending: true });

  const events = (eventsRaw ?? []) as WindowEvent[];

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
      <div className="flex items-center justify-between gap-2 text-sm">
        <Link
          href="/wc/picks"
          className="font-medium text-ps-text-sec hover:text-ps-text"
        >
          &larr; All windows
        </Link>
        {prevWindow && (
          <Link
            href={`/wc/picks/${prevWindow.id}`}
            className="font-medium text-ps-text-sec hover:text-ps-text"
            aria-label={`Previous: ${prevWindow.name}`}
          >
            &larr; {prevWindow.name}
          </Link>
        )}
      </div>

      <h1 className="mt-3 font-display text-2xl uppercase tracking-tight text-ps-text">{round.name}</h1>

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
          <PicksClient
            competitionId={round.competition_id}
            events={events}
            predictions={predictions}
            windowLocked={isWindowLocked}
            matchdayName={round.name}
            nextWindowId={nextWindow?.id ?? null}
            nextWindowName={nextWindow?.name ?? null}
          />
        </div>
      )}
    </div>
  );
}
