import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PicksClient } from "./PicksClient";
import { EmbeddedBracketKoEditor } from "./EmbeddedBracketKoEditor";
import { PredictionBanner } from "@/components/wc/PredictionBanner";
import type { WindowEvent } from "./WindowPickList";
import type { Prediction } from "@/types/database";
import type { BracketSubmissionData } from "@/types/tournament";
import { WC2026_STAGE_IDS } from "@/lib/tournament/create-world-cup-competition";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { loadGroupDataFromPredictions } from "@/lib/tournament/bracket/adapters/predictions-to-group-data";
import { groupDataToRankings } from "@/lib/tournament/bracket/group-ranking";

type KoRoundKey = "r32" | "r16" | "qf" | "sf" | "final";

const STAGE_TO_ROUND_KEY: Record<string, KoRoundKey> = {
  [WC2026_STAGE_IDS.R32]: "r32",
  [WC2026_STAGE_IDS.R16]: "r16",
  [WC2026_STAGE_IDS.QF]: "qf",
  [WC2026_STAGE_IDS.SF]: "sf",
  [WC2026_STAGE_IDS.FINAL]: "final",
};

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
      id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_confirmed,
      event_prediction_types (id, event_id, prediction_type, points, partial_points, config)
    `)
    .eq("round_id", windowId)
    .order("start_time", { ascending: true });

  const events = (eventsRaw ?? []) as WindowEvent[];

  // Look up the user's full_bracket classification + submission once. Two
  // places need it: (a) the GM3 celebration handoff that invites the user
  // into the wizard's tiebreakers + best-thirds flow; (b) bracket-edit mode,
  // which swaps the read-only locked KO card for an inline bracket editor
  // when the round is locked for picks but the bracket itself is still open.
  const { data: bracketCls } = await supabase
    .from("classifications")
    .select("id, status")
    .eq("competition_id", round.competition_id)
    .eq("classification_key", "full_bracket")
    .eq("status", "active")
    .maybeSingle();

  type BracketSubmissionRow = {
    bracket_data: BracketSubmissionData | null;
    status: string;
  };
  let bracketSubmission: BracketSubmissionRow | null = null;
  if (bracketCls) {
    const { data: sub } = await supabase
      .from("bracket_prediction_submissions")
      .select("bracket_data, status")
      .eq("competition_id", round.competition_id)
      .eq("classification_id", bracketCls.id)
      .eq("user_id", user.id)
      .neq("status", "superseded")
      .maybeSingle();
    bracketSubmission = (sub as BracketSubmissionRow | null) ?? null;
  }
  const bracketIsLocked = bracketSubmission?.status === "locked";

  const bracketHandoffClassificationId =
    bracketCls && round.sporting_stage_id === WC2026_STAGE_IDS.GM3
      ? bracketCls.id
      : null;

  // Bracket edit mode: this round is a knockout stage AND it's locked for
  // general picks AND the user's bracket submission isn't locked yet. The
  // user can no longer move format/overall leaderboard picks for these
  // events, but the bracket classification still wants their pick — so we
  // render the wizard's KnockoutStageStep inline. Decisions persist to
  // bracket_data.knockoutPicks via /api/tournament/bracket/submit.
  const koRoundKey: KoRoundKey | null = round.sporting_stage_id
    ? (STAGE_TO_ROUND_KEY[round.sporting_stage_id] ?? null)
    : null;
  const showBracketEditMode = Boolean(
    koRoundKey && isWindowLocked && bracketCls && !bracketIsLocked,
  );

  let bracketEditPayload:
    | {
        classificationId: string;
        roundKey: KoRoundKey;
        groupRankings: Record<string, string[]>;
        groupsIncomplete: boolean;
        existingBracketData: BracketSubmissionData | null;
      }
    | null = null;
  if (showBracketEditMode && koRoundKey && bracketCls) {
    const groups = await loadGroupDataFromPredictions(supabase, {
      userId: user.id,
      competitionId: round.competition_id,
      groups: WC2026_GROUPS,
    });
    const groupRankings = groupDataToRankings(groups);
    const groupsIncomplete = Object.keys(groupRankings).length !== 12;
    bracketEditPayload = {
      classificationId: bracketCls.id,
      roundKey: koRoundKey,
      groupRankings,
      groupsIncomplete,
      existingBracketData: bracketSubmission?.bracket_data ?? null,
    };
  }

  const eventIds = events.map((e) => e.id);
  const { data: predictionsRaw } =
    eventIds.length > 0
      ? await supabase
          .from("predictions")
          .select(
            "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at, confidence_level",
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

      <h1 className="mt-3 font-display font-extrabold text-2xl uppercase tracking-tight text-ps-text">{round.name}</h1>

      <div className="mt-3">
        <PredictionBanner events={events} predictions={predictions} />
      </div>

      {(isFinalised || (isWindowLocked && !isFinalised)) && (
        <div className="mt-2 inline-block rounded-full bg-ps-amber/20 px-3 py-1 text-xs font-semibold text-ps-amber">
          {isFinalised ? "Finalised" : "Locked"}
        </div>
      )}

      {isDraft ? (
        <p className="mt-6 rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center text-sm text-ps-text-sec">
          This window isn&apos;t open for predictions yet.
        </p>
      ) : bracketEditPayload ? (
        <div className="mt-6">
          <EmbeddedBracketKoEditor
            classificationId={bracketEditPayload.classificationId}
            competitionId={round.competition_id}
            roundKey={bracketEditPayload.roundKey}
            groupRankings={bracketEditPayload.groupRankings}
            existingBracketData={bracketEditPayload.existingBracketData}
            groupsIncomplete={bracketEditPayload.groupsIncomplete}
          />
        </div>
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
            bracketHandoffClassificationId={bracketHandoffClassificationId}
          />
        </div>
      )}
    </div>
  );
}
