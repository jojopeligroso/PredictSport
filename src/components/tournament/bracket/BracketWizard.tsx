"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { BracketSubmissionData } from "@/types/tournament";
import {
  WC2026_KNOCKOUT_ROUNDS,
  generateWC2026R32Matchups,
} from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { groupDataToRankings } from "@/lib/tournament/bracket/group-ranking";
import { selectionForResult } from "@/lib/tournament/bracket/adapters/predictions-to-group-data";
import type { GroupData } from "./GroupResultsStepV2";
import GroupStep from "./GroupStep";
import TiebreakersStep from "./TiebreakersStep";
import ThirdPlaceStep from "./ThirdPlaceStep";
import KnockoutStageStep from "./KnockoutStageStep";
import FinalStep from "./FinalStep";
import BracketReviewStep from "./BracketReviewStep";
import { allTiebreakersResolved } from "@/lib/tournament/bracket/group-ranking";

/**
 * WC2026 BracketWizard — bite-sized, 9-step flow.
 *
 * Step list (full mode):
 *   1. Groups               — one-group-at-a-time W/D/L picker
 *   2. Tiebreakers          — resolve any point ties with exact scores
 *   3. Third-place ranking  — auto-ranked best-thirds
 *   4. R32                  — knockout round 1 (one stage = one step)
 *   5. R16
 *   6. QF
 *   7. SF
 *   8. Final + 3rd-place playoff — names the champion
 *   9. Review               — visual summary, edit-back, submit
 *
 * Knockout-only mode skips steps 1-2 and uses pre-filled official R32
 * matchups (passed in by the page).
 *
 * Storage model (per docs/DESIGN-WC-UNIFIED-PREDICTIONS.md, amended 2026-05-23):
 *
 * - Group W/D/L picks and tiebreaker `exact_score` live in the `predictions`
 *   table — the same store the `/picks` matchday flow writes to. The wizard
 *   reads them via `loadGroupDataFromPredictions()` in the parent server
 *   component and receives them as `initialGroups` here. Every tap on a match
 *   button writes through `/api/predictions` immediately; local state is an
 *   optimistic mirror, not the source of truth.
 *
 * - The Bracket classification only needs the *advancing* team per knockout
 *   match. Knockout picks, champion, third-place, and best-third group picks
 *   stay in `bracket_data` because they have no per-event analogue.
 *
 * - `groupRankings` is *never stored* — derived on the fly from the local
 *   `groups` state (which mirrors `predictions`) via `groupDataToRankings`.
 *   Server-side validation rebuilds it the same way.
 */

interface BracketWizardProps {
  classificationId: string;
  competitionId: string;
  mode: "full" | "knockout_only";
  /** Pre-filled R32 matchups from official results (knockout_only mode) */
  officialR32?: Record<string, { home: string; away: string }>;
  /** Existing draft to resume — only knockoutPicks/champion/thirdPlace/bestThirdPicks are used */
  existingData?: BracketSubmissionData;
  /**
   * Initial group state derived from `predictions` rows by the parent server
   * component. The wizard treats this as the source-of-truth snapshot at
   * page-load; subsequent edits write to `/api/predictions` and mirror back
   * into local state optimistically.
   */
  initialGroups: GroupData[];
  /**
   * Map of `{groupId}-m{n}` → `events.id`. Needed so per-tap writes to
   * `/api/predictions` can identify the correct event without a round-trip
   * lookup. Resolved server-side once.
   */
  eventIdByMatchId: Record<string, string>;
}

type Step =
  | "groups"
  | "tiebreakers"
  | "third_place"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "final"
  | "review";

const FULL_STEPS: Step[] = [
  "groups",
  "tiebreakers",
  "third_place",
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
  "review",
];
const KO_STEPS: Step[] = ["r32", "r16", "qf", "sf", "final", "review"];

const STEP_NUMBERS: Record<Step, { num: number; label: string }> = {
  groups: { num: 1, label: "Groups" },
  tiebreakers: { num: 2, label: "Tiebreakers" },
  third_place: { num: 3, label: "Best thirds" },
  r32: { num: 4, label: "Round of 32" },
  r16: { num: 5, label: "Round of 16" },
  qf: { num: 6, label: "Quarter-finals" },
  sf: { num: 7, label: "Semi-finals" },
  final: { num: 8, label: "Final" },
  review: { num: 9, label: "Review" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BracketWizard({
  classificationId,
  competitionId,
  mode,
  officialR32,
  existingData,
  initialGroups,
  eventIdByMatchId,
}: BracketWizardProps) {
  const steps = mode === "full" ? FULL_STEPS : KO_STEPS;

  const [stepIndex, setStepIndex] = useState(() =>
    pickResumeStepIndex(steps, existingData, initialGroups),
  );
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [pickWriteError, setPickWriteError] = useState<string | null>(null);

  // Auto-clear pick errors after 6s so a stale banner doesn't sit forever on
  // a page the user has already moved past.
  useEffect(() => {
    if (!pickWriteError) return;
    const t = setTimeout(() => setPickWriteError(null), 6000);
    return () => clearTimeout(t);
  }, [pickWriteError]);

  const [groups, setGroups] = useState<GroupData[]>(initialGroups);
  const [bestThirdPicks, setBestThirdPicks] = useState<string[]>(
    existingData?.bestThirdPicks ?? [],
  );
  const [knockoutPicks, setKnockoutPicks] = useState<
    Record<string, { winner: string }>
  >(existingData?.knockoutPicks ?? {});
  const [champion, setChampion] = useState(existingData?.champion ?? "");
  const [thirdPlace, setThirdPlace] = useState(existingData?.thirdPlace ?? "");

  // Track the latest pick per (event_id, prediction_type) to detect stale
  // responses. If two taps race, we keep only the most recent one's effect.
  const latestPickSeq = useRef<Map<string, number>>(new Map());
  const seqCounter = useRef(0);

  const currentStep = steps[stepIndex];

  const groupRankings = useMemo(() => groupDataToRankings(groups), [groups]);

  const r32Matchups = useMemo(() => {
    if (mode === "knockout_only" && officialR32) return officialR32;
    const allGroupsRanked = Object.keys(groupRankings).length === 12;
    const picksStillValid =
      bestThirdPicks.length === 8 &&
      bestThirdPicks.every((g) => groupRankings[g]?.[2]);
    if (allGroupsRanked && picksStillValid) {
      return generateWC2026R32Matchups(groupRankings, bestThirdPicks);
    }
    return {};
  }, [mode, officialR32, bestThirdPicks, groupRankings]);

  const allMatchups = useMemo(() => {
    return resolveAllKnockoutMatchups(r32Matchups, knockoutPicks);
  }, [r32Matchups, knockoutPicks]);

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const goToStep = (step: Step) => {
    const idx = steps.indexOf(step);
    if (idx !== -1) setStepIndex(idx);
  };

  // -------------------------------------------------------------------------
  // Per-tap write to /api/predictions
  // -------------------------------------------------------------------------

  const writePrediction = useCallback(
    async (args: {
      event_id: string;
      prediction_type: "winner" | "exact_score";
      prediction_data: Record<string, unknown>;
    }) => {
      const key = `${args.event_id}::${args.prediction_type}`;
      const seq = ++seqCounter.current;
      latestPickSeq.current.set(key, seq);

      try {
        const res = await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: args.event_id,
            competition_id: competitionId,
            prediction_type: args.prediction_type,
            prediction_data: args.prediction_data,
          }),
        });
        // Ignore the response if a newer tap on the same (event, type) has
        // since superseded it — its result is the one that should stand.
        if (latestPickSeq.current.get(key) !== seq) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setPickWriteError(
            (body && (body.error as string)) ?? "Couldn't save that pick",
          );
        } else {
          setPickWriteError(null);
        }
      } catch {
        if (latestPickSeq.current.get(key) === seq) {
          setPickWriteError("Network error — pick may not be saved");
        }
      }
    },
    [competitionId],
  );

  // Diff old vs new groups to discover which match changed. GroupStep replaces
  // the whole array on every tap, so the parent does the diff once rather
  // than threading a granular callback through.
  const handleGroupsUpdate = useCallback(
    (next: GroupData[]) => {
      // Apply optimistic update immediately.
      setGroups(next);

      // Find the changed match (at most one per tap in practice).
      for (let gi = 0; gi < next.length; gi++) {
        const before = groups[gi];
        const after = next[gi];
        if (!before || !after) continue;
        for (let mi = 0; mi < after.matches.length; mi++) {
          const bm = before.matches[mi];
          const am = after.matches[mi];
          if (!bm || !am) continue;
          const resultChanged = bm.result !== am.result;
          const scoreChanged =
            JSON.stringify(bm.exact_score ?? null) !==
            JSON.stringify(am.exact_score ?? null);
          if (!resultChanged && !scoreChanged) continue;

          const event_id = eventIdByMatchId[am.match_id];
          if (!event_id) {
            // No event mapping — bracket template and seeded events disagree.
            // Surface but don't block: the optimistic UI still works for the
            // user, but the pick won't survive a reload.
            setPickWriteError(
              `No event found for ${am.match_id} — pick saved locally only`,
            );
            continue;
          }

          if (resultChanged) {
            if (am.result === null) {
              void writePrediction({
                event_id,
                prediction_type: "winner",
                prediction_data: { _clear: true },
              });
            } else {
              void writePrediction({
                event_id,
                prediction_type: "winner",
                prediction_data: {
                  selection: selectionForResult(am.result, am.home_team, am.away_team),
                },
              });
            }
          }
          if (scoreChanged) {
            if (am.exact_score) {
              void writePrediction({
                event_id,
                prediction_type: "exact_score",
                prediction_data: {
                  home_score: am.exact_score.home_score,
                  away_score: am.exact_score.away_score,
                },
              });
            } else {
              void writePrediction({
                event_id,
                prediction_type: "exact_score",
                prediction_data: { _clear: true },
              });
            }
          }
        }
      }
    },
    [groups, eventIdByMatchId, writePrediction],
  );

  // -------------------------------------------------------------------------
  // Bracket-data save (no group fields)
  // -------------------------------------------------------------------------

  const buildBracketData = useCallback(
    (): BracketSubmissionData => ({
      bestThirdPicks,
      knockoutPicks,
      champion,
      thirdPlace: thirdPlace || undefined,
    }),
    [bestThirdPicks, knockoutPicks, champion, thirdPlace],
  );

  const saveDraft = useCallback(async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/tournament/bracket/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classificationId,
          competitionId,
          bracketData: buildBracketData(),
          action: "save_draft",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSubmitError(err.error ?? "Failed to save draft");
      } else {
        setLastSavedAt(Date.now());
      }
    } catch {
      setSubmitError("Network error");
    } finally {
      setSaving(false);
    }
  }, [buildBracketData, classificationId, competitionId]);

  const submitBracket = useCallback(async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/tournament/bracket/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classificationId,
          competitionId,
          bracketData: buildBracketData(),
          action: "submit",
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSubmitError(
          (result.errors as string[] | undefined)?.join("; ") ??
            result.error ??
            "Submission failed",
        );
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitError("Network error");
    } finally {
      setSaving(false);
    }
  }, [buildBracketData, classificationId, competitionId]);

  const pickKnockout = useCallback(
    (slotId: string, winner: string) => {
      setKnockoutPicks((prev) => {
        const next = { ...prev, [slotId]: { winner } };
        clearDownstreamPicks(next, slotId);
        return next;
      });
      if (slotId.startsWith("sf_")) {
        setChampion("");
        setThirdPlace("");
      }
      if (slotId === "final") {
        setChampion(winner);
      }
    },
    [setKnockoutPicks, setChampion, setThirdPlace],
  );

  // ----- Render submitted state -----

  if (submitted) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ps-green/15">
          <svg
            className="h-7 w-7 text-ps-green"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-extrabold text-ps-text">
          Bracket locked in
        </h2>
        <p className="mt-2 text-sm text-ps-text-sec">
          Your World Cup picks are saved. Good luck.
        </p>
        {champion && (
          <p className="mt-4 inline-block rounded-full bg-ps-amber/15 px-3 py-1 text-xs font-bold text-ps-amber">
            Champion pick: {champion}
          </p>
        )}
        <div className="mt-6">
          <Link
            href="/wc"
            className="inline-block rounded-xl bg-ps-amber px-5 py-2.5 text-sm font-extrabold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Go to your dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ----- Default rendering -----

  return (
    <div className="space-y-4">
      <StepHeader
        step={currentStep}
        stepCount={steps.length}
        index={stepIndex}
        saving={saving}
        lastSavedAt={lastSavedAt}
        onSaveDraft={saveDraft}
      />

      {pickWriteError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-ps-red/30 bg-ps-red/5 px-3 py-2 text-xs text-ps-red"
        >
          <span className="flex-1">{pickWriteError}</span>
          <button
            type="button"
            onClick={() => setPickWriteError(null)}
            aria-label="Dismiss"
            className="-mr-1 -mt-0.5 flex h-5 w-5 items-center justify-center rounded text-base leading-none opacity-70 hover:bg-ps-red/10 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {currentStep === "groups" && (
        <GroupStep
          groups={groups}
          onUpdate={handleGroupsUpdate}
          onAllGroupsComplete={() => {
            void saveDraft();
            goNext();
          }}
        />
      )}

      {currentStep === "tiebreakers" && (
        <TiebreakersStep
          groups={groups}
          onUpdateGroups={handleGroupsUpdate}
          onComplete={() => {
            void saveDraft();
            goNext();
          }}
        />
      )}

      {currentStep === "third_place" && (
        <ThirdPlaceStep
          groups={groups}
          onUpdateGroups={handleGroupsUpdate}
          onComplete={(groupIds) => {
            setBestThirdPicks(groupIds);
            void saveDraft();
            goNext();
          }}
        />
      )}

      {(currentStep === "r32" ||
        currentStep === "r16" ||
        currentStep === "qf" ||
        currentStep === "sf") && (
        <KnockoutStageStep
          roundKey={currentStep}
          roundName={STEP_NUMBERS[currentStep].label}
          slotIds={slotIdsFor(currentStep)}
          matchups={allMatchups}
          picks={knockoutPicks}
          nextRoundName={
            currentStep === "sf" ? "the Final" : STEP_NUMBERS[steps[stepIndex + 1]].label
          }
          onPick={pickKnockout}
          onContinue={() => {
            void saveDraft();
            goNext();
          }}
        />
      )}

      {currentStep === "final" && (
        <FinalStep
          finalists={{
            home: knockoutPicks.sf_m1?.winner ?? "",
            away: knockoutPicks.sf_m2?.winner ?? "",
          }}
          sfLosers={{
            home: getSFLoser("sf_m1", knockoutPicks, allMatchups),
            away: getSFLoser("sf_m2", knockoutPicks, allMatchups),
          }}
          champion={champion}
          thirdPlace={thirdPlace}
          onChampionPick={(team) => {
            setChampion(team);
            setKnockoutPicks((prev) => ({ ...prev, final: { winner: team } }));
          }}
          onThirdPlacePick={setThirdPlace}
          onContinue={() => {
            void saveDraft();
            goNext();
          }}
        />
      )}

      {currentStep === "review" && (
        <BracketReviewStep
          groupRankings={groupRankings}
          qualifyingThirds={bestThirdPicks}
          knockoutPicks={knockoutPicks}
          allMatchups={allMatchups}
          champion={champion}
          thirdPlace={thirdPlace}
          onJumpToStep={(step) => goToStep(step)}
        />
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-ps-red/30 bg-ps-red/5 px-3 py-2 text-xs text-ps-red"
        >
          {submitError}
        </div>
      )}

      <NavBar
        stepIndex={stepIndex}
        stepCount={steps.length}
        isReview={currentStep === "review"}
        saving={saving}
        onPrev={goPrev}
        onSubmit={submitBracket}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function StepHeader({
  step,
  stepCount,
  index,
  saving,
  lastSavedAt,
  onSaveDraft,
}: {
  step: Step;
  stepCount: number;
  index: number;
  saving: boolean;
  lastSavedAt: number | null;
  onSaveDraft: () => void;
}) {
  const pct = ((index + 1) / stepCount) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
            Step {STEP_NUMBERS[step].num} of {stepCount}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ps-text-sec">
          {saving ? (
            <span className="animate-pulse">Saving…</span>
          ) : lastSavedAt ? (
            <span className="text-ps-green">✓ Saved</span>
          ) : null}
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="rounded-md border border-ps-border px-2 py-0.5 font-semibold text-ps-text-sec hover:bg-ps-chip disabled:opacity-40"
          >
            Save draft
          </button>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-ps-chip">
        <div
          className="h-full bg-ps-text transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

function NavBar({
  stepIndex,
  stepCount,
  isReview,
  saving,
  onPrev,
  onSubmit,
}: {
  stepIndex: number;
  stepCount: number;
  isReview: boolean;
  saving: boolean;
  onPrev: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-ps-border pt-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={stepIndex === 0}
        className="rounded-md px-3 py-2 text-xs font-semibold text-ps-text-sec transition-colors hover:text-ps-text disabled:opacity-30"
      >
        ← Back
      </button>

      <span className="font-mono text-[10px] text-ps-text-ter">
        {stepIndex + 1} / {stepCount}
      </span>

      {isReview ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-xl bg-ps-amber px-5 py-2.5 text-sm font-extrabold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit bracket 🏆"}
        </button>
      ) : (
        <span className="w-[80px]" aria-hidden />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slotIdsFor(step: Step): string[] {
  switch (step) {
    case "r32":
      return WC2026_KNOCKOUT_ROUNDS[0].slotIds;
    case "r16":
      return WC2026_KNOCKOUT_ROUNDS[1].slotIds;
    case "qf":
      return WC2026_KNOCKOUT_ROUNDS[2].slotIds;
    case "sf":
      return WC2026_KNOCKOUT_ROUNDS[3].slotIds;
    default:
      return [];
  }
}

/**
 * Bracket tree per Articles 12.7-12.11 of the WC 2026 Regulations. Each
 * later-round slot's two feeders are explicit because FIFA's mapping is
 * non-sequential (e.g. R16-1 = W74+W77, not W73+W74). Mechanical
 * `2n-1, 2n` would be wrong here.
 */
const KNOCKOUT_FEEDERS: Record<string, [string, string]> = {
  // R16 (Article 12.7) — M89..M96
  r16_m1: ["r32_m2", "r32_m5"],   // M89 = W74 v W77
  r16_m2: ["r32_m1", "r32_m3"],   // M90 = W73 v W75
  r16_m3: ["r32_m4", "r32_m6"],   // M91 = W76 v W78
  r16_m4: ["r32_m7", "r32_m8"],   // M92 = W79 v W80
  r16_m5: ["r32_m11", "r32_m12"], // M93 = W83 v W84
  r16_m6: ["r32_m9", "r32_m10"],  // M94 = W81 v W82
  r16_m7: ["r32_m14", "r32_m16"], // M95 = W86 v W88
  r16_m8: ["r32_m13", "r32_m15"], // M96 = W85 v W87
  // QF (Article 12.8) — M97..M100
  qf_m1: ["r16_m1", "r16_m2"], // M97 = W89 v W90
  qf_m2: ["r16_m5", "r16_m6"], // M98 = W93 v W94
  qf_m3: ["r16_m3", "r16_m4"], // M99 = W91 v W92
  qf_m4: ["r16_m7", "r16_m8"], // M100 = W95 v W96
  // SF (Article 12.9) — M101..M102
  sf_m1: ["qf_m1", "qf_m2"], // M101 = W97 v W98
  sf_m2: ["qf_m3", "qf_m4"], // M102 = W99 v W100
  // Final (Article 12.11) — M104
  final: ["sf_m1", "sf_m2"],
};

function feedersFor(slotId: string): string[] {
  return KNOCKOUT_FEEDERS[slotId] ?? [];
}

function resolveAllKnockoutMatchups(
  r32: Record<string, { home: string; away: string }>,
  picks: Record<string, { winner: string }>,
): Record<string, { home: string; away: string }> {
  const all: Record<string, { home: string; away: string }> = { ...r32 };

  const laterRounds = [
    WC2026_KNOCKOUT_ROUNDS[1], // r16
    WC2026_KNOCKOUT_ROUNDS[2], // qf
    WC2026_KNOCKOUT_ROUNDS[3], // sf
    WC2026_KNOCKOUT_ROUNDS[4], // final
  ];

  for (const round of laterRounds) {
    for (const slotId of round.slotIds) {
      const [homeFeeder, awayFeeder] = feedersFor(slotId);
      all[slotId] = {
        home: picks[homeFeeder]?.winner ?? "",
        away: picks[awayFeeder]?.winner ?? "",
      };
    }
  }

  return all;
}

function getSFLoser(
  sfSlot: string,
  picks: Record<string, { winner: string }>,
  matchups: Record<string, { home: string; away: string }>,
): string {
  const winner = picks[sfSlot]?.winner;
  if (!winner) return "";
  const matchup = matchups[sfSlot];
  if (!matchup) return "";
  if (matchup.home && winner === matchup.home) return matchup.away;
  if (matchup.away && winner === matchup.away) return matchup.home;
  return "";
}

function clearDownstreamPicks(
  picks: Record<string, { winner: string }>,
  changedSlot: string,
): void {
  const allRounds = WC2026_KNOCKOUT_ROUNDS;
  for (const round of allRounds) {
    for (const slotId of round.slotIds) {
      const feeders = feedersFor(slotId);
      if (!feeders.includes(changedSlot)) continue;
      const existing = picks[slotId]?.winner;
      if (!existing) continue;
      const fw = feeders.map((f) => picks[f]?.winner);
      if (existing !== fw[0] && existing !== fw[1]) {
        delete picks[slotId];
        clearDownstreamPicks(picks, slotId);
      }
    }
  }
}

/**
 * Pick the resume step. Group completeness is determined from the
 * predictions-derived `initialGroups`, not from any stored blob.
 *
 * Resume ladder:
 *   groups → tiebreakers (once all 12 groups have W/D/L picks)
 *   tiebreakers → third_place (once all point ties have exact scores)
 *   third_place → r32 (once 8 best-third groups are chosen)
 *   r32 → r16 → qf → sf → final → review
 */
function pickResumeStepIndex(
  steps: Step[],
  existing: BracketSubmissionData | undefined,
  initialGroups: GroupData[],
): number {
  const groupsDone =
    initialGroups.length === 12 &&
    initialGroups.every((g) => g.matches.every((m) => m.result !== null));
  const tiebreakersDone = groupsDone && allTiebreakersResolved(initialGroups);
  const thirdsDone = (existing?.bestThirdPicks ?? []).length === 8;
  const knockoutPicks = existing?.knockoutPicks ?? {};
  const r32Done = WC2026_KNOCKOUT_ROUNDS[0].slotIds.every(
    (s) => knockoutPicks[s]?.winner,
  );
  const r16Done = WC2026_KNOCKOUT_ROUNDS[1].slotIds.every(
    (s) => knockoutPicks[s]?.winner,
  );
  const qfDone = WC2026_KNOCKOUT_ROUNDS[2].slotIds.every(
    (s) => knockoutPicks[s]?.winner,
  );
  const sfDone = WC2026_KNOCKOUT_ROUNDS[3].slotIds.every(
    (s) => knockoutPicks[s]?.winner,
  );
  const finalDone = Boolean(existing?.champion) && Boolean(existing?.thirdPlace);

  let target: Step = "groups";
  if (groupsDone) target = "tiebreakers";
  if (tiebreakersDone) target = "third_place";
  if (tiebreakersDone && thirdsDone) target = "r32";
  if (r32Done) target = "r16";
  if (r16Done) target = "qf";
  if (qfDone) target = "sf";
  if (sfDone) target = "final";
  if (finalDone) target = "review";

  const idx = steps.indexOf(target);
  return idx === -1 ? 0 : idx;
}
