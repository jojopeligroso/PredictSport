"use client";

import { useState, useCallback, useMemo } from "react";
import type { BracketSubmissionData, GroupDataV2 } from "@/types/tournament";
import {
  WC2026_GROUPS,
  WC2026_KNOCKOUT_ROUNDS,
  generateWC2026R32Matchups,
} from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { groupDataToRankings } from "@/lib/tournament/bracket/group-ranking";
import type { GroupData } from "./GroupResultsStepV2";
import GroupStep from "./GroupStep";
import ThirdPlaceStep from "./ThirdPlaceStep";
import KnockoutStageStep from "./KnockoutStageStep";
import FinalStep from "./FinalStep";
import BracketReviewStep from "./BracketReviewStep";
import TiebreakerResolutionPage from "./TiebreakerResolutionPage";

/**
 * WC2026 BracketWizard — bite-sized, 8-step flow.
 *
 * Step list (full mode):
 *   1. Groups               — one-group-at-a-time W/D/L picker
 *   2. Third-place ranking  — auto-ranked best-thirds with inline tiebreakers
 *   3. R32                  — knockout round 1 (one stage = one step)
 *   4. R16
 *   5. QF
 *   6. SF
 *   7. Final + 3rd-place playoff — names the champion
 *   8. Review               — visual summary, edit-back, submit
 *
 * Knockout-only mode skips steps 1-2 and uses pre-filled official R32
 * matchups (passed in by the page).
 *
 * Implementation notes:
 * - The Bracket classification only needs the *advancing* team per knockout
 *   match. The 90+ET result / exact score required by Overall/Format lives in
 *   per-event `predictions` rows and is collected by the windowed pick UI.
 *   See docs/DESIGN-WC-UNIFIED-PREDICTIONS.md §U5.
 * - `bestThirdPicks` is auto-derived from the third-place ranking — the user
 *   no longer picks 8 group letters by hand.
 */

interface BracketWizardProps {
  classificationId: string;
  competitionId: string;
  mode: "full" | "knockout_only";
  /** Pre-filled R32 matchups from official results (knockout_only mode) */
  officialR32?: Record<string, { home: string; away: string }>;
  /** Existing draft to resume */
  existingData?: BracketSubmissionData;
}

type Step =
  | "groups"
  | "third_place"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "final"
  | "review";

const FULL_STEPS: Step[] = [
  "groups",
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
  third_place: { num: 2, label: "Best thirds" },
  r32: { num: 3, label: "Round of 32" },
  r16: { num: 4, label: "Round of 16" },
  qf: { num: 5, label: "Quarter-finals" },
  sf: { num: 6, label: "Semi-finals" },
  final: { num: 7, label: "Final" },
  review: { num: 8, label: "Review" },
};

// ---------------------------------------------------------------------------
// Group state helpers
// ---------------------------------------------------------------------------

function buildGroupMatches(groupId: string, teams: string[]): GroupData["matches"] {
  const matches: GroupData["matches"] = [];
  let n = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      n++;
      matches.push({
        match_id: `${groupId}-m${n}`,
        home_team: teams[i],
        away_team: teams[j],
        result: null,
      });
    }
  }
  return matches;
}

function buildInitialGroups(): GroupData[] {
  return WC2026_GROUPS.map((g) => ({
    group_id: g.groupId,
    group_name: g.name,
    teams: g.teams,
    matches: buildGroupMatches(g.groupId, g.teams),
    has_tiebreaker_scores: false,
  }));
}

function resumeGroups(saved: GroupDataV2[] | undefined): GroupData[] {
  if (!saved || saved.length === 0) return buildInitialGroups();
  const fresh = buildInitialGroups();
  const savedById = new Map(saved.map((g) => [g.group_id, g]));
  return fresh.map((group) => {
    const prior = savedById.get(group.group_id);
    if (!prior) return group;
    const priorByMatch = new Map(prior.matches.map((m) => [m.match_id, m]));
    return {
      ...group,
      has_tiebreaker_scores: prior.has_tiebreaker_scores,
      matches: group.matches.map((m) => {
        const pm = priorByMatch.get(m.match_id);
        return pm ? { ...m, result: pm.result, exact_score: pm.exact_score } : m;
      }),
    };
  });
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
}: BracketWizardProps) {
  const steps = mode === "full" ? FULL_STEPS : KO_STEPS;

  const [stepIndex, setStepIndex] = useState(() =>
    pickResumeStepIndex(steps, existingData),
  );
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [groups, setGroups] = useState<GroupData[]>(() =>
    resumeGroups(existingData?.groupsV2),
  );
  const [bestThirdPicks, setBestThirdPicks] = useState<string[]>(
    existingData?.bestThirdPicks ?? [],
  );
  const [knockoutPicks, setKnockoutPicks] = useState<
    Record<string, { winner: string }>
  >(existingData?.knockoutPicks ?? {});
  const [champion, setChampion] = useState(existingData?.champion ?? "");
  const [thirdPlace, setThirdPlace] = useState(existingData?.thirdPlace ?? "");

  const [tiebreaker, setTiebreaker] = useState<{
    groupIndex: number;
    teams: string[];
  } | null>(null);

  const currentStep = steps[stepIndex];

  const groupRankings = useMemo(() => groupDataToRankings(groups), [groups]);

  const r32Matchups = useMemo(() => {
    if (mode === "knockout_only" && officialR32) return officialR32;
    // Only generate when every group is fully ranked AND the eight saved third
    // picks still reference groups whose third-place team exists. Otherwise we
    // would project stale group letters onto a freshly edited ranking.
    const allGroupsRanked = Object.keys(groupRankings).length === 12;
    const picksStillValid =
      bestThirdPicks.length === 8 &&
      bestThirdPicks.every((g) => groupRankings[g]?.[2]);
    if (allGroupsRanked && picksStillValid) {
      return generateWC2026R32Matchups(groupRankings, bestThirdPicks);
    }
    return {};
  }, [mode, officialR32, bestThirdPicks, groupRankings]);

  // Derive each later round's matchups from the previous round's picks.
  const allMatchups = useMemo(() => {
    return resolveAllKnockoutMatchups(r32Matchups, knockoutPicks);
  }, [r32Matchups, knockoutPicks]);

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const goToStep = (step: Step) => {
    const idx = steps.indexOf(step);
    if (idx !== -1) setStepIndex(idx);
  };

  const buildBracketData = useCallback(
    (): BracketSubmissionData => ({
      groupRankings,
      groupsV2: groups.map((g) => ({
        group_id: g.group_id,
        group_name: g.group_name,
        teams: g.teams,
        matches: g.matches.map((m) => ({
          match_id: m.match_id,
          home_team: m.home_team,
          away_team: m.away_team,
          result: m.result,
          exact_score: m.exact_score,
        })),
        has_tiebreaker_scores: g.has_tiebreaker_scores,
      })),
      bestThirdPicks,
      knockoutPicks,
      champion,
      thirdPlace: thirdPlace || undefined,
    }),
    [groupRankings, groups, bestThirdPicks, knockoutPicks, champion, thirdPlace],
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
      // If we changed an SF slot, clear champion/thirdPlace if they no longer match.
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
      </div>
    );
  }

  // ----- Render tiebreaker overlay -----

  if (currentStep === "groups" && tiebreaker) {
    return (
      <TiebreakerResolutionPage
        group={groups[tiebreaker.groupIndex]}
        tiedTeams={tiebreaker.teams}
        onResolve={(updatedGroup) => {
          setGroups((prev) => {
            const next = [...prev];
            next[tiebreaker.groupIndex] = {
              ...updatedGroup,
              has_tiebreaker_scores: true,
            };
            return next;
          });
          setTiebreaker(null);
        }}
        onBack={() => setTiebreaker(null)}
      />
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

      {currentStep === "groups" && (
        <GroupStep
          groups={groups}
          onUpdate={setGroups}
          onTiebreakerNeeded={(groupIndex, teams) =>
            setTiebreaker({ groupIndex, teams })
          }
          onAllGroupsComplete={() => {
            // auto-save on big milestone, then advance.
            void saveDraft();
            goNext();
          }}
        />
      )}

      {currentStep === "third_place" && (
        <ThirdPlaceStep
          groups={groups}
          onUpdateGroups={setGroups}
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

function feedersFor(slotId: string): string[] {
  const m = slotId.match(/^(r16|qf|sf|final)_?m?(\d*)$/);
  if (!m) return [];
  const [, round, numStr] = m;
  const num = parseInt(numStr || "1", 10);
  if (round === "r16") return [`r32_m${2 * num - 1}`, `r32_m${2 * num}`];
  if (round === "qf") return [`r16_m${2 * num - 1}`, `r16_m${2 * num}`];
  if (round === "sf") return [`qf_m${2 * num - 1}`, `qf_m${2 * num}`];
  if (round === "final") return ["sf_m1", "sf_m2"];
  return [];
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

function pickResumeStepIndex(
  steps: Step[],
  existing: BracketSubmissionData | undefined,
): number {
  if (!existing) return 0;
  const groupsDone =
    (existing.groupsV2 ?? []).length === 12 &&
    (existing.groupsV2 ?? []).every((g) => g.matches.every((m) => m.result !== null));
  const thirdsDone = (existing.bestThirdPicks ?? []).length === 8;
  const knockoutPicks = existing.knockoutPicks ?? {};
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
  const finalDone = Boolean(existing.champion) && Boolean(existing.thirdPlace);

  let target: Step = "groups";
  if (groupsDone) target = "third_place";
  if (groupsDone && thirdsDone) target = "r32";
  if (r32Done) target = "r16";
  if (r16Done) target = "qf";
  if (qfDone) target = "sf";
  if (sfDone) target = "final";
  if (finalDone) target = "review";

  const idx = steps.indexOf(target);
  return idx === -1 ? 0 : idx;
}
