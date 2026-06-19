"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import type { BracketSubmissionData } from "@/types/tournament";
import {
  WC2026_KNOCKOUT_ROUNDS,
  generateWC2026R32Matchups,
} from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { groupDataToRankings } from "@/lib/tournament/bracket/group-ranking";
import {
  clearDownstreamPicks,
  getSFLoser,
  resolveAllKnockoutMatchups,
  slotIdsForRound,
} from "@/lib/tournament/bracket/wc2026-knockout-tree";
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

function stepLabel(step: Step, t: (key: string) => string): string {
  const keys: Record<Step, string> = {
    groups: "bracket.step_groups",
    tiebreakers: "bracket.step_tiebreakers",
    third_place: "bracket.step_best_thirds",
    r32: "bracket.step_r32",
    r16: "bracket.step_r16",
    qf: "bracket.step_qf",
    sf: "bracket.step_sf",
    final: "bracket.step_final",
    review: "bracket.step_review",
  };
  return t(keys[step]);
}

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
  const t = useT();
  const steps = mode === "full" ? FULL_STEPS : KO_STEPS;

  const [stepIndex, setStepIndex] = useState(() =>
    pickResumeStepIndex(steps, existingData, initialGroups),
  );
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [pickWriteError, setPickWriteError] = useState<string | null>(null);

  // High-water mark: the furthest step the user has reached. Dots beyond
  // this index are greyed out and not navigable.
  const [highWaterMark, setHighWaterMark] = useState(() =>
    pickResumeStepIndex(steps, existingData, initialGroups),
  );

  // Dirty flag for bracket data (knockout picks, best thirds, champion,
  // third place). Group picks write per-tap to /api/predictions and don't
  // need this flag. Saves only fire when dirty, preventing version inflation.
  const isDirty = useRef(false);

  // Stable ref to the latest saveDraft so navigation callbacks don't need
  // saveDraft in their dependency arrays (avoids declaration-order issues).
  const saveDraftRef = useRef<() => Promise<void>>(async () => {});

  // Pending group-change confirmation dialog state. Stores the previous
  // groups snapshot so we can revert on cancel.
  const [pendingGroupConfirm, setPendingGroupConfirm] = useState<
    GroupData[] | null
  >(null);

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
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  /** Navigate to any reachable step via dot click. Saves if dirty. */
  const navigateToStep = useCallback(
    (targetIndex: number) => {
      if (targetIndex === stepIndex) return;
      if (targetIndex < 0 || targetIndex >= steps.length) return;
      if (targetIndex > highWaterMark) return;
      if (isDirty.current) {
        void saveDraftRef.current();
      }
      setStepIndex(targetIndex);
    },
    [stepIndex, steps.length, highWaterMark],
  );

  /**
   * Called when a step auto-completes (all groups filled, tiebreakers
   * resolved, etc.). On first pass, extends the high-water mark and
   * auto-advances. On revisit, stays put.
   */
  const completeStep = useCallback(() => {
    if (isDirty.current) {
      void saveDraftRef.current();
    }
    if (stepIndex >= highWaterMark) {
      const next = Math.min(stepIndex + 1, steps.length - 1);
      setHighWaterMark(next);
      setStepIndex(next);
    }
  }, [stepIndex, highWaterMark, steps.length]);

  /**
   * Called when the user explicitly clicks a "Continue" button (knockout
   * and final steps). Always advances regardless of first-pass/revisit.
   */
  const continueToNext = useCallback(() => {
    if (isDirty.current) {
      void saveDraftRef.current();
    }
    const next = Math.min(stepIndex + 1, steps.length - 1);
    if (next > highWaterMark) {
      setHighWaterMark(next);
    }
    setStepIndex(next);
  }, [stepIndex, highWaterMark, steps.length]);

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

  // -------------------------------------------------------------------------
  // Group diff + write helpers
  // -------------------------------------------------------------------------

  /** Diff two group snapshots and write changed picks to /api/predictions. */
  const writeGroupDiffs = useCallback(
    (prev: GroupData[], next: GroupData[]) => {
      for (let gi = 0; gi < next.length; gi++) {
        const before = prev[gi];
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
                  selection: selectionForResult(
                    am.result,
                    am.home_team,
                    am.away_team,
                  ),
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
    [eventIdByMatchId, writePrediction],
  );

  /**
   * Handle group data updates from GroupStep / TiebreakersStep / ThirdPlaceStep.
   *
   * If the user has progressed past the current step (highWaterMark > stepIndex),
   * we apply the change optimistically but hold the API write behind a
   * confirmation dialog. Cancel reverts to the previous snapshot.
   */
  const handleGroupsUpdate = useCallback(
    (next: GroupData[]) => {
      const isPastStep = highWaterMark > stepIndex;

      if (isPastStep) {
        // Apply optimistically so the UI reflects the tap immediately.
        // Store previous groups for potential revert.
        setPendingGroupConfirm(groups);
        setGroups(next);
        return;
      }

      // Normal flow — apply and write immediately.
      setGroups(next);
      writeGroupDiffs(groups, next);
    },
    [groups, stepIndex, highWaterMark, writeGroupDiffs],
  );

  const confirmGroupChange = useCallback(() => {
    if (!pendingGroupConfirm) return;
    writeGroupDiffs(pendingGroupConfirm, groups);
    setPendingGroupConfirm(null);
  }, [pendingGroupConfirm, groups, writeGroupDiffs]);

  const cancelGroupChange = useCallback(() => {
    if (!pendingGroupConfirm) return;
    setGroups(pendingGroupConfirm);
    setPendingGroupConfirm(null);
  }, [pendingGroupConfirm]);

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
        isDirty.current = false;
      }
    } catch {
      setSubmitError("Network error");
    } finally {
      setSaving(false);
    }
  }, [buildBracketData, classificationId, competitionId]);

  // Keep the ref in sync so navigation callbacks always use the latest saveDraft.
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

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
      isDirty.current = true;
    },
    [setKnockoutPicks, setChampion, setThirdPlace],
  );

  // True when there are any knockout picks worth resetting.
  const hasKnockoutPicks =
    Object.keys(knockoutPicks).length > 0 ||
    bestThirdPicks.length > 0 ||
    champion !== "" ||
    thirdPlace !== "";

  // -------------------------------------------------------------------------
  // Bracket reset
  // -------------------------------------------------------------------------

  const resetBracket = useCallback(async () => {
    setKnockoutPicks({});
    setChampion("");
    setThirdPlace("");
    setBestThirdPicks([]);
    isDirty.current = true;

    // Compute where the wizard should resume given groups-only state.
    // Pass undefined for existing data since bracket picks are now empty.
    const resumeIdx = pickResumeStepIndex(steps, undefined, groups);
    setHighWaterMark(resumeIdx);
    setStepIndex(resumeIdx);
    setShowResetConfirm(false);

    // Persist the empty bracket to DB immediately.
    // We can't call saveDraft() directly here because the state setters
    // above haven't flushed yet. Build the payload inline instead.
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/tournament/bracket/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classificationId,
          competitionId,
          bracketData: {
            bestThirdPicks: [],
            knockoutPicks: {},
            champion: "",
            thirdPlace: undefined,
          } satisfies BracketSubmissionData,
          action: "save_draft",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSubmitError(err.error ?? "Failed to save reset");
      } else {
        setLastSavedAt(Date.now());
        isDirty.current = false;
      }
    } catch {
      setSubmitError("Network error");
    } finally {
      setSaving(false);
    }
  }, [steps, groups, classificationId, competitionId]);

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
      <StepNav
        steps={steps}
        stepIndex={stepIndex}
        highWaterMark={highWaterMark}
        saving={saving}
        lastSavedAt={lastSavedAt}
        onSaveDraft={saveDraft}
        onNavigate={navigateToStep}
        showReset={hasKnockoutPicks}
        onReset={() => setShowResetConfirm(true)}
      />

      {pendingGroupConfirm && (
        <ConfirmDialog
          message="Changing this may affect your knockout picks. Change anyway?"
          onConfirm={confirmGroupChange}
          onCancel={cancelGroupChange}
        />
      )}

      {showResetConfirm && (
        <ConfirmDialog
          message="This will clear all knockout picks, champion, and third-place selections. Your group predictions will be kept."
          onConfirm={resetBracket}
          onCancel={() => setShowResetConfirm(false)}
          confirmLabel="Reset"
          destructive
        />
      )}

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
          onAllGroupsComplete={completeStep}
        />
      )}

      {currentStep === "tiebreakers" && (
        <TiebreakersStep
          groups={groups}
          onUpdateGroups={handleGroupsUpdate}
          onComplete={completeStep}
        />
      )}

      {currentStep === "third_place" && (
        <ThirdPlaceStep
          groups={groups}
          onUpdateGroups={handleGroupsUpdate}
          onComplete={(groupIds) => {
            setBestThirdPicks(groupIds);
            isDirty.current = true;
            completeStep();
          }}
        />
      )}

      {(currentStep === "r32" ||
        currentStep === "r16" ||
        currentStep === "qf" ||
        currentStep === "sf") && (
        <KnockoutStageStep
          roundKey={currentStep}
          roundName={stepLabel(currentStep, t)}
          slotIds={slotIdsFor(currentStep)}
          matchups={allMatchups}
          picks={knockoutPicks}
          nextRoundName={
            currentStep === "sf"
              ? stepLabel("final", t)
              : stepLabel(steps[stepIndex + 1], t)
          }
          onPick={pickKnockout}
          onContinue={continueToNext}
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
            isDirty.current = true;
          }}
          onThirdPlacePick={(team) => {
            setThirdPlace(team);
            isDirty.current = true;
          }}
          onContinue={continueToNext}
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
          onJumpToStep={(step) => navigateToStep(steps.indexOf(step))}
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

      {currentStep === "review" && (
        <div className="flex justify-end border-t border-ps-border pt-3">
          <button
            type="button"
            onClick={submitBracket}
            disabled={saving}
            className="rounded-xl bg-ps-amber px-5 py-2.5 text-sm font-extrabold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit bracket"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step navigation dots
// ---------------------------------------------------------------------------

function StepNav({
  steps,
  stepIndex,
  highWaterMark,
  saving,
  lastSavedAt,
  onSaveDraft,
  onNavigate,
  showReset,
  onReset,
}: {
  steps: Step[];
  stepIndex: number;
  highWaterMark: number;
  saving: boolean;
  lastSavedAt: number | null;
  onSaveDraft: () => void;
  onNavigate: (index: number) => void;
  showReset: boolean;
  onReset: () => void;
}) {
  const t = useT();
  const step = steps[stepIndex];
  return (
    <div className="space-y-2">
      {/* Numbered dots — current + neighbors are large, rest are small */}
      <div className="flex items-center justify-center gap-1.5">
        {steps.map((s, i) => {
          const isCurrent = i === stepIndex;
          const isNeighbor = Math.abs(i - stepIndex) === 1;
          const isReachable = i <= highWaterMark;
          const isLarge = isCurrent || isNeighbor;

          return (
            <button
              key={s}
              type="button"
              disabled={!isReachable || isCurrent}
              onClick={() => onNavigate(i)}
              className={[
                "flex items-center justify-center rounded-full font-mono font-bold transition-all duration-200",
                isLarge ? "h-8 w-8 text-xs" : "h-5 w-5 text-[9px]",
                isCurrent
                  ? "bg-ps-text text-ps-bg"
                  : isReachable
                    ? "bg-ps-chip text-ps-text-sec hover:bg-ps-text/20"
                    : "bg-ps-chip/40 text-ps-text-ter/30",
              ].join(" ")}
              aria-label={`Step ${i + 1}: ${stepLabel(s, t)}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Step label + save status */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          {stepLabel(step, t)}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-ps-text-sec">
          {showReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={saving}
              className="text-ps-text-ter hover:text-ps-text disabled:opacity-40"
            >
              Reset bracket
            </button>
          )}
          {saving ? (
            <span className="animate-pulse">Saving...</span>
          ) : lastSavedAt ? (
            <span className="text-ps-green">Saved</span>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Change",
  destructive = false,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-ps-border bg-ps-bg p-5 shadow-xl">
        <p className="text-sm text-ps-text">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-ps-text-sec hover:bg-ps-chip"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? "rounded-lg bg-ps-red px-4 py-2 text-sm font-extrabold text-white hover:opacity-90"
                : "rounded-lg bg-ps-amber px-4 py-2 text-sm font-extrabold text-ps-bg hover:opacity-90"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Step → slot ids for that knockout round. Wraps the shared helper so the
 * wizard's "review" step type (which isn't a knockout round) maps to [].
 */
function slotIdsFor(step: Step): string[] {
  if (step === "r32" || step === "r16" || step === "qf" || step === "sf") {
    return slotIdsForRound(step);
  }
  return [];
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
  const finalDone =
    Boolean(existing?.champion) && Boolean(existing?.thirdPlace);

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
