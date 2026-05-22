"use client";

import { useState, useCallback } from "react";
import type { BracketSubmissionData, GroupDataV2 } from "@/types/tournament";
import { WC2026_GROUPS, WC2026_KNOCKOUT_ROUNDS, generateWC2026R32Matchups } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import GroupResultsStepV2, { type GroupData } from "./GroupResultsStepV2";
import TiebreakerResolutionPage from "./TiebreakerResolutionPage";
import { groupDataToRankings } from "@/lib/tournament/bracket/group-ranking";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BracketWizardProps {
  classificationId: string;
  competitionId: string;
  mode: "full" | "knockout_only";
  /** Pre-filled R32 matchups from official results (knockout_only mode) */
  officialR32?: Record<string, { home: string; away: string }>;
  /** Existing draft to resume */
  existingData?: BracketSubmissionData;
}

type Step = "groups" | "best_thirds" | "review_r32" | "knockout" | "champion" | "review";

const FULL_STEPS: Step[] = ["groups", "best_thirds", "review_r32", "knockout", "champion", "review"];
const KO_STEPS: Step[] = ["knockout", "champion", "review"];

const STEP_LABELS: Record<Step, string> = {
  groups: "Group Results",
  best_thirds: "Best Thirds",
  review_r32: "Review R32",
  knockout: "Knockout Picks",
  champion: "Champion",
  review: "Review & Submit",
};

const GROUP_IDS = WC2026_GROUPS.map((g) => g.groupId);

// ---------------------------------------------------------------------------
// W/D/L group-step helpers
// ---------------------------------------------------------------------------

/** Round-robin match order for a 4-team group: matches 1..6. */
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

/** Fresh, unpredicted W/D/L group set for all 12 WC groups. */
function buildInitialGroupsV2(): GroupData[] {
  return WC2026_GROUPS.map((g) => ({
    group_id: g.groupId,
    group_name: g.name,
    teams: g.teams,
    matches: buildGroupMatches(g.groupId, g.teams),
    has_tiebreaker_scores: false,
  }));
}

/**
 * Resume a saved draft's W/D/L groups. `GroupDataV2` (storable) and `GroupData`
 * (the component type) are structurally identical; this re-bases a draft onto
 * the current group set so a stale draft can't carry dropped groups/teams.
 */
function resumeGroupsV2(saved: GroupDataV2[] | undefined): GroupData[] {
  if (!saved || saved.length === 0) return buildInitialGroupsV2();
  const fresh = buildInitialGroupsV2();
  const savedById = new Map(saved.map((g) => [g.group_id, g]));
  return fresh.map((group) => {
    const prior = savedById.get(group.group_id);
    if (!prior) return group;
    // Re-map saved results onto fresh matches, keyed by match_id.
    const priorByMatch = new Map(prior.matches.map((m) => [m.match_id, m]));
    return {
      ...group,
      has_tiebreaker_scores: prior.has_tiebreaker_scores,
      matches: group.matches.map((m) => {
        const pm = priorByMatch.get(m.match_id);
        return pm
          ? { ...m, result: pm.result, exact_score: pm.exact_score }
          : m;
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function BracketWizard({
  classificationId,
  competitionId,
  mode,
  officialR32,
  existingData,
}: BracketWizardProps) {
  const steps = mode === "full" ? FULL_STEPS : KO_STEPS;

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Bracket state — groups are captured as W/D/L match predictions; the
  // positional `groupRankings` contract is derived from them at save/submit.
  const [groupsV2, setGroupsV2] = useState<GroupData[]>(
    () => resumeGroupsV2(existingData?.groupsV2)
  );
  const [bestThirdPicks, setBestThirdPicks] = useState<string[]>(
    existingData?.bestThirdPicks ?? []
  );
  const [knockoutPicks, setKnockoutPicks] = useState<Record<string, { winner: string }>>(
    existingData?.knockoutPicks ?? {}
  );
  const [champion, setChampion] = useState(existingData?.champion ?? "");
  const [thirdPlace, setThirdPlace] = useState(existingData?.thirdPlace ?? "");

  // Within the `groups` step, the user may divert to a tiebreaker sub-page.
  const [tiebreaker, setTiebreaker] = useState<{
    groupIndex: number;
    teams: string[];
  } | null>(null);

  const currentStep = steps[stepIndex];

  // Positional finishing order (1st→4th per group), derived from W/D/L picks
  // via the FIFA tiebreaker engine. This is the shape every downstream
  // consumer (scoring, validation, R32 generation) reads.
  const groupRankings = groupDataToRankings(groupsV2);

  // R32 matchups derived from group rankings + best thirds
  const r32Matchups =
    mode === "knockout_only" && officialR32
      ? officialR32
      : bestThirdPicks.length === 8
        ? generateWC2026R32Matchups(groupRankings, bestThirdPicks)
        : {};

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));

  // Whether the current step is complete enough to advance. Gates the Next
  // button so a step's downstream data (R32 matchups, scoring) is never
  // derived from a half-finished group/third-place selection.
  const allGroupsPredicted = groupsV2.every((g) =>
    g.matches.every((m) => m.result !== null)
  );
  const canAdvance = (() => {
    switch (currentStep) {
      case "groups":
        return allGroupsPredicted;
      case "best_thirds":
        return bestThirdPicks.length === 8;
      default:
        return true;
    }
  })();

  // Single source for the submission payload. `groupRankings` is the derived
  // positional contract; `groupsV2` carries the raw W/D/L picks so a resumed
  // draft can rebuild the group step exactly as the user left it.
  const buildBracketData = useCallback(
    (): BracketSubmissionData => ({
      groupRankings,
      groupsV2: groupsV2.map((g) => ({
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
    [groupRankings, groupsV2, bestThirdPicks, knockoutPicks, champion, thirdPlace]
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
          result.errors?.join("; ") ?? result.error ?? "Submission failed"
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

  if (submitted) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ps-green/15">
          <svg className="h-6 w-6 text-ps-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-ps-text">Bracket Submitted</h2>
        <p className="mt-1 text-sm text-ps-text-sec">
          Your bracket has been locked in. Good luck!
        </p>
      </div>
    );
  }

  // The tiebreaker resolution page takes over the whole wizard surface — it
  // carries its own Back / Resolve controls, so the step nav is suppressed.
  if (currentStep === "groups" && tiebreaker) {
    return (
      <TiebreakerResolutionPage
        group={groupsV2[tiebreaker.groupIndex]}
        tiedTeams={tiebreaker.teams}
        onResolve={(updatedGroup) => {
          setGroupsV2((prev) => {
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

  return (
    <div>
      {/* Step indicator */}
      <StepIndicator steps={steps} currentIndex={stepIndex} />

      {/* Step content */}
      <div className="mt-4">
        {currentStep === "groups" && (
          <GroupResultsStepV2
            groups={groupsV2}
            onUpdate={setGroupsV2}
            onGroupComplete={() => {}}
            onTiebreakerNeeded={(groupIndex, teams) =>
              setTiebreaker({ groupIndex, teams })
            }
          />
        )}
        {currentStep === "best_thirds" && (
          <BestThirdsStep
            picks={bestThirdPicks}
            onUpdate={setBestThirdPicks}
          />
        )}
        {currentStep === "review_r32" && (
          <ReviewR32Step matchups={r32Matchups} />
        )}
        {currentStep === "knockout" && (
          <KnockoutPicksStep
            r32Matchups={r32Matchups}
            picks={knockoutPicks}
            onUpdate={setKnockoutPicks}
          />
        )}
        {currentStep === "champion" && (
          <ChampionStep
            picks={knockoutPicks}
            champion={champion}
            thirdPlace={thirdPlace}
            onChampionChange={setChampion}
            onThirdPlaceChange={setThirdPlace}
          />
        )}
        {currentStep === "review" && (
          <ReviewStep
            groupRankings={groupRankings}
            bestThirdPicks={bestThirdPicks}
            knockoutPicks={knockoutPicks}
            champion={champion}
            thirdPlace={thirdPlace}
            mode={mode}
          />
        )}
      </div>

      {/* Error display */}
      {submitError && (
        <div className="mt-3 rounded-lg bg-ps-red/10 px-3 py-2 text-xs text-ps-red">
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={stepIndex === 0}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-ps-text-sec transition-colors hover:text-ps-text disabled:opacity-30"
        >
          Back
        </button>

        <div className="flex items-center gap-2">
          {currentStep !== "review" && (
            <button
              onClick={saveDraft}
              disabled={saving}
              className="rounded-lg border border-ps-border px-3 py-2 text-xs font-semibold text-ps-text-sec transition-colors hover:bg-ps-chip"
            >
              {saving ? "Saving..." : "Save draft"}
            </button>
          )}

          {currentStep === "review" ? (
            <button
              onClick={submitBracket}
              disabled={saving}
              className="rounded-lg bg-ps-text px-6 py-2.5 text-sm font-semibold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit Bracket"}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canAdvance}
              title={
                canAdvance
                  ? undefined
                  : currentStep === "groups"
                    ? "Predict every group match to continue"
                    : "Pick 8 best-third teams to continue"
              }
              className="rounded-lg bg-ps-text px-4 py-2 text-sm font-semibold text-ps-bg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {steps.map((step, i) => (
        <div
          key={step}
          className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            i === currentIndex
              ? "bg-ps-text text-ps-bg"
              : i < currentIndex
                ? "bg-ps-green/15 text-ps-green"
                : "bg-ps-chip text-ps-text-ter"
          }`}
        >
          <span>{i + 1}</span>
          <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Group results — see GroupResultsStepV2 (W/D/L match prediction).
// The legacy drag-to-rank GroupRankingStep was retired here; the W/D/L flow
// is the format mandated by DESIGN-WC-UNIFIED-PREDICTIONS.md.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step 2: Best Thirds
// ---------------------------------------------------------------------------

function BestThirdsStep({
  picks,
  onUpdate,
}: {
  picks: string[];
  onUpdate: (p: string[]) => void;
}) {
  const toggle = (groupId: string) => {
    if (picks.includes(groupId)) {
      onUpdate(picks.filter((id) => id !== groupId));
    } else if (picks.length < 8) {
      onUpdate([...picks, groupId]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ps-text">Pick Best Thirds</h2>
        <span
          className={`font-mono text-xs font-semibold ${
            picks.length === 8 ? "text-ps-green" : "text-ps-amber"
          }`}
        >
          {picks.length}/8
        </span>
      </div>
      <p className="mt-1 text-xs text-ps-text-sec">
        Select 8 groups whose third-place team you think will qualify for the R32.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {GROUP_IDS.map((groupId) => {
          const isSelected = picks.includes(groupId);
          return (
            <button
              key={groupId}
              onClick={() => toggle(groupId)}
              className={`rounded-xl border-2 px-3 py-3 text-center transition-all ${
                isSelected
                  ? "border-ps-green bg-ps-green/10 text-ps-green"
                  : picks.length >= 8
                    ? "border-ps-border bg-ps-surface text-ps-text-ter opacity-50"
                    : "border-ps-border bg-ps-surface text-ps-text hover:border-ps-text/30"
              }`}
            >
              <span className="text-lg font-bold">
                {groupId}
              </span>
              <span className="mt-0.5 block text-[10px]">Group {groupId}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Review R32
// ---------------------------------------------------------------------------

function ReviewR32Step({
  matchups,
}: {
  matchups: Record<string, { home: string; away: string }>;
}) {
  const slots = WC2026_KNOCKOUT_ROUNDS[0].slotIds;

  return (
    <div>
      <h2 className="text-base font-bold text-ps-text">Round of 32 Preview</h2>
      <p className="mt-1 text-xs text-ps-text-sec">
        These matchups are derived from your group rankings and best-third picks.
        Go back to adjust.
      </p>

      <div className="mt-4 space-y-2">
        {slots.map((slotId, i) => {
          const m = matchups[slotId];
          return (
            <div
              key={slotId}
              className="flex items-center justify-between rounded-lg border border-ps-border bg-ps-surface px-3 py-2"
            >
              <span className="font-mono text-xs text-ps-text-ter">M{i + 1}</span>
              <span className="text-sm font-semibold text-ps-text">
                {m?.home || "?"} <span className="text-ps-text-ter">vs</span>{" "}
                {m?.away || "?"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Knockout picks
// ---------------------------------------------------------------------------

function KnockoutPicksStep({
  r32Matchups,
  picks,
  onUpdate,
}: {
  r32Matchups: Record<string, { home: string; away: string }>;
  picks: Record<string, { winner: string }>;
  onUpdate: (p: Record<string, { winner: string }>) => void;
}) {
  // Build matchups for each round, flowing winners forward
  const getMatchup = (slotId: string): { home: string; away: string } => {
    // R32: from r32Matchups
    if (slotId.startsWith("r32_")) {
      return r32Matchups[slotId] ?? { home: "", away: "" };
    }
    // Later rounds: derive from previous round winners
    const feeders = getFeedingSlots(slotId);
    return {
      home: picks[feeders[0]]?.winner ?? "",
      away: picks[feeders[1]]?.winner ?? "",
    };
  };

  const pickWinner = (slotId: string, winner: string) => {
    const updated = { ...picks, [slotId]: { winner } };
    // Clear downstream picks that depended on a different winner
    clearDownstream(updated, slotId);
    onUpdate(updated);
  };

  // Render rounds in order
  const knockoutRounds = WC2026_KNOCKOUT_ROUNDS;
  const totalSlots = knockoutRounds.reduce((sum, r) => sum + r.slotIds.length, 0);
  const pickedCount = knockoutRounds.reduce(
    (sum, r) => sum + r.slotIds.filter((s) => picks[s]?.winner).length,
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ps-text">Knockout Picks</h2>
        <span
          className={`font-mono text-xs font-semibold ${
            pickedCount === totalSlots ? "text-ps-green" : "text-ps-amber"
          }`}
        >
          {pickedCount}/{totalSlots}
        </span>
      </div>
      <p className="mt-1 text-xs text-ps-text-sec">
        Pick the advancing team in each match. Winners flow into the next round.
      </p>

      <div className="mt-4 space-y-6">
        {knockoutRounds.map((round) => (
          <div key={round.roundKey}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-ps-text-ter">
              {round.name}
            </h3>
            <div className="mt-2 space-y-2">
              {round.slotIds.map((slotId) => {
                const matchup = getMatchup(slotId);
                const selected = picks[slotId]?.winner;
                const bothAvailable = matchup.home && matchup.away;

                return (
                  <div
                    key={slotId}
                    className="rounded-lg border border-ps-border bg-ps-surface p-2"
                  >
                    {bothAvailable ? (
                      <div className="flex gap-1">
                        <TeamButton
                          team={matchup.home}
                          isSelected={selected === matchup.home}
                          onClick={() => pickWinner(slotId, matchup.home)}
                        />
                        <TeamButton
                          team={matchup.away}
                          isSelected={selected === matchup.away}
                          onClick={() => pickWinner(slotId, matchup.away)}
                        />
                      </div>
                    ) : (
                      <div className="py-2 text-center text-xs text-ps-text-ter">
                        Waiting for previous round picks...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamButton({
  team,
  isSelected,
  onClick,
}: {
  team: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-all ${
        isSelected
          ? "bg-ps-text text-ps-bg"
          : "bg-ps-bg text-ps-text hover:bg-ps-chip"
      }`}
    >
      {team}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Champion & Third Place
// ---------------------------------------------------------------------------

function ChampionStep({
  picks,
  champion,
  thirdPlace,
  onChampionChange,
  onThirdPlaceChange,
}: {
  picks: Record<string, { winner: string }>;
  champion: string;
  thirdPlace: string;
  onChampionChange: (t: string) => void;
  onThirdPlaceChange: (t: string) => void;
}) {
  // Semi-final winners are the finalists
  const finalist1 = picks["sf_m1"]?.winner ?? "";
  const finalist2 = picks["sf_m2"]?.winner ?? "";
  // Semi-final losers play for third
  const sfLoser1 = getSFLoser("sf_m1", picks);
  const sfLoser2 = getSFLoser("sf_m2", picks);

  return (
    <div>
      <h2 className="text-base font-bold text-ps-text">Pick Your Champion</h2>

      {/* Final */}
      <div className="mt-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-ps-text-ter">
          Final
        </h3>
        {finalist1 && finalist2 ? (
          <div className="mt-2 flex gap-2">
            <TeamButton
              team={finalist1}
              isSelected={champion === finalist1}
              onClick={() => onChampionChange(finalist1)}
            />
            <TeamButton
              team={finalist2}
              isSelected={champion === finalist2}
              onClick={() => onChampionChange(finalist2)}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-ps-text-ter">
            Complete semi-final picks first.
          </p>
        )}
      </div>

      {/* Third place */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-ps-text-ter">
          Third Place Match
        </h3>
        {sfLoser1 && sfLoser2 ? (
          <div className="mt-2 flex gap-2">
            <TeamButton
              team={sfLoser1}
              isSelected={thirdPlace === sfLoser1}
              onClick={() => onThirdPlaceChange(sfLoser1)}
            />
            <TeamButton
              team={sfLoser2}
              isSelected={thirdPlace === sfLoser2}
              onClick={() => onThirdPlaceChange(sfLoser2)}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-ps-text-ter">
            Complete semi-final picks first.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Review & Submit
// ---------------------------------------------------------------------------

function ReviewStep({
  groupRankings,
  bestThirdPicks,
  knockoutPicks,
  champion,
  thirdPlace,
  mode,
}: {
  groupRankings: Record<string, string[]>;
  bestThirdPicks: string[];
  knockoutPicks: Record<string, { winner: string }>;
  champion: string;
  thirdPlace: string;
  mode: "full" | "knockout_only";
}) {
  const totalKO = WC2026_KNOCKOUT_ROUNDS.reduce((s, r) => s + r.slotIds.length, 0);
  const pickedKO = WC2026_KNOCKOUT_ROUNDS.reduce(
    (s, r) => s + r.slotIds.filter((id) => knockoutPicks[id]?.winner).length,
    0
  );

  return (
    <div>
      <h2 className="text-base font-bold text-ps-text">Review Your Bracket</h2>
      <p className="mt-1 text-xs text-ps-text-sec">
        Check everything looks right, then submit. You can edit until the bracket locks.
      </p>

      <div className="mt-4 space-y-3">
        {mode === "full" && (
          <>
            <ReviewItem
              label="Groups Ranked"
              value={`${Object.keys(groupRankings).length}/12`}
              ok={Object.keys(groupRankings).length === 12}
            />
            <ReviewItem
              label="Best Thirds"
              value={`${bestThirdPicks.length}/8`}
              ok={bestThirdPicks.length === 8}
            />
          </>
        )}
        <ReviewItem
          label="Knockout Picks"
          value={`${pickedKO}/${totalKO}`}
          ok={pickedKO === totalKO}
        />
        <ReviewItem
          label="Champion"
          value={champion || "Not picked"}
          ok={!!champion}
        />
        <ReviewItem
          label="Third Place"
          value={thirdPlace || "Not picked"}
          ok={!!thirdPlace}
        />
      </div>

      {champion && (
        <div className="mt-6 rounded-xl border-2 border-ps-amber bg-ps-amber/5 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-ps-amber">
            Your Champion
          </p>
          <p className="mt-1 text-xl font-extrabold text-ps-text">{champion}</p>
        </div>
      )}
    </div>
  );
}

function ReviewItem({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ps-border bg-ps-surface px-3 py-2">
      <span className="text-sm text-ps-text">{label}</span>
      <span
        className={`font-mono text-sm font-semibold ${
          ok ? "text-ps-green" : "text-ps-amber"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the two feeder slot IDs for a given knockout slot */
function getFeedingSlots(slotId: string): [string, string] {
  // R16 matchN fed by R32 match(2N-1) and R32 match(2N)
  const match = slotId.match(/^(r16|qf|sf|final)_?m?(\d*)$/);
  if (!match) return ["", ""];

  const [, round, numStr] = match;
  const num = parseInt(numStr || "1", 10);

  if (round === "r16") return [`r32_m${2 * num - 1}`, `r32_m${2 * num}`];
  if (round === "qf") return [`r16_m${2 * num - 1}`, `r16_m${2 * num}`];
  if (round === "sf") return [`qf_m${2 * num - 1}`, `qf_m${2 * num}`];
  if (round === "final") return ["sf_m1", "sf_m2"];

  return ["", ""];
}

/** Get the loser of a semi-final (the team that wasn't picked as winner) */
function getSFLoser(
  sfSlotId: string,
  picks: Record<string, { winner: string }>
): string {
  const feeders = getFeedingSlots(sfSlotId);
  const home = picks[feeders[0]]?.winner ?? "";
  const away = picks[feeders[1]]?.winner ?? "";
  const winner = picks[sfSlotId]?.winner;

  if (!winner || !home || !away) return "";
  return winner === home ? away : home;
}

/** Clear downstream picks that become invalid when an upstream pick changes */
function clearDownstream(
  picks: Record<string, { winner: string }>,
  changedSlot: string
): void {
  // For each knockout round, check if any slot's feeders include changedSlot
  const allRounds = WC2026_KNOCKOUT_ROUNDS;
  for (const round of allRounds) {
    for (const slotId of round.slotIds) {
      const feeders = getFeedingSlots(slotId);
      if (feeders.includes(changedSlot)) {
        // If the current pick in this slot is no longer valid
        const currentPick = picks[slotId]?.winner;
        if (currentPick) {
          const feederWinner0 = picks[feeders[0]]?.winner;
          const feederWinner1 = picks[feeders[1]]?.winner;
          if (currentPick !== feederWinner0 && currentPick !== feederWinner1) {
            delete picks[slotId];
            // Recursively clear further downstream
            clearDownstream(picks, slotId);
          }
        }
      }
    }
  }
}
