"use client";

/**
 * TiebreakersStep — dedicated wizard step between Groups and Best Thirds.
 *
 * Why this step exists
 * --------------------
 * Under the old flow tiebreakers were an inline interrupt fired per-group the
 * moment you pressed Continue. That had two problems: (1) you could finish all
 * 12 groups without encountering a tiebreaker prompt if you happened to pick
 * every group cleanly, then hit a surprise block at Third-place ranking; and
 * (2) the interrupt replaced the whole wizard UI, breaking the user's sense of
 * where they were. This step gives tiebreakers a single, predictable home.
 *
 * Layout
 * ------
 * - Zero ties: instant-pass "All clear" confirmation with Continue enabled.
 * - One or more ties: one card per tied group, each listing the matches
 *   that involve tied teams and score inputs. Resolved groups get a green
 *   check. Continue is disabled until every tied group is resolved.
 *
 * Score writes
 * ------------
 * Each score entry flows through `onUpdateGroups` (→ `handleGroupsUpdate` in
 * BracketWizard), so every tap fires a write to /api/predictions — same path
 * as group picks.
 *
 * Validation
 * ----------
 * Scores must be consistent with the predicted W/D/L result. Violations are
 * shown as inline error text (no alert() — that blocks the main thread and
 * breaks automated tests).
 */

import { useState, useMemo, useCallback, useRef } from "react";
import type { GroupData } from "./GroupResultsStepV2";
import type { MatchPrediction } from "./MatchCard";
import {
  tiedTeamsInGroup,
  groupTiebreakerResolved,
  allTiebreakersResolved,
} from "@/lib/tournament/bracket/group-ranking";

interface TiebreakersStepProps {
  groups: GroupData[];
  onUpdateGroups: (groups: GroupData[]) => void;
  onComplete: () => void;
}

export default function TiebreakersStep({
  groups,
  onUpdateGroups,
  onComplete,
}: TiebreakersStepProps) {
  // Only consider fully-predicted groups — partial groups can't have a
  // resolvable tiebreaker yet and don't need to be shown here.
  const predictedGroups = useMemo(
    () => groups.filter((g) => g.matches.every((m) => m.result !== null)),
    [groups],
  );

  const tiedGroups = useMemo(
    () => predictedGroups.filter((g) => tiedTeamsInGroup(g).length > 0),
    [predictedGroups],
  );

  const canContinue = useMemo(
    () => allTiebreakersResolved(groups),
    [groups],
  );

  const handleScoreEntry = useCallback(
    (matchId: string, home_score: number, away_score: number) => {
      const next = groups.map((g) => ({
        ...g,
        matches: g.matches.map((m) =>
          m.match_id === matchId ? { ...m, exact_score: { home_score, away_score } } : m,
        ),
      }));
      onUpdateGroups(next);
    },
    [groups, onUpdateGroups],
  );

  // No ties at all — fast path.
  if (tiedGroups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
            Tiebreakers
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-ps-text">
            No tiebreakers needed
          </h2>
          <p className="mt-1 text-xs text-ps-text-sec">
            Every group has a clear points ranking — no exact scores required.
          </p>
        </div>

        <div className="rounded-xl border border-ps-green/30 bg-ps-green/5 p-4">
          <div className="flex items-center gap-2">
            <span className="text-ps-green text-base">✓</span>
            <p className="text-sm font-semibold text-ps-text">
              All {predictedGroups.length} groups ranked cleanly by points
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="w-full rounded-xl bg-ps-text px-6 py-3.5 text-sm font-semibold text-ps-bg transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <span className="inline-flex items-center justify-center gap-2">
            Continue to third-place ranking
            <span aria-hidden>→</span>
          </span>
        </button>
      </div>
    );
  }

  // One or more groups need tiebreaker scores.
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Tiebreakers
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-ps-text">
          Resolve group ties
        </h2>
        <p className="mt-1 text-xs text-ps-text-sec">
          {tiedGroups.length === 1
            ? "1 group has teams level on points."
            : `${tiedGroups.length} groups have teams level on points.`}{" "}
          Enter exact scores for the relevant matches so FIFA&rsquo;s tiebreaker
          rules (head-to-head first, then goal difference) can rank them.
        </p>
      </div>

      <div className="space-y-3">
        {tiedGroups.map((group) => {
          const groupIndex = groups.findIndex((g) => g.group_id === group.group_id);
          return (
            <TiedGroupCard
              key={group.group_id}
              group={group}
              groupIndex={groupIndex}
              onScoreEntry={handleScoreEntry}
            />
          );
        })}
      </div>

      {/* Summary pill — how many resolved */}
      <ResolvedSummary tiedGroups={tiedGroups} />

      <button
        type="button"
        onClick={onComplete}
        disabled={!canContinue}
        className={`w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.99] ${
          canContinue
            ? "bg-ps-text text-ps-bg hover:opacity-90"
            : "cursor-not-allowed bg-ps-chip text-ps-text-ter"
        }`}
      >
        {canContinue ? (
          <span className="inline-flex items-center justify-center gap-2">
            Continue to third-place ranking
            <span aria-hidden>→</span>
          </span>
        ) : (
          `Resolve ${tiedGroups.filter((g) => !groupTiebreakerResolved(g)).length} remaining tie${tiedGroups.filter((g) => !groupTiebreakerResolved(g)).length === 1 ? "" : "s"}`
        )}
      </button>

      <div className="rounded border border-ps-border bg-ps-bg p-3 text-xs text-ps-text-sec">
        <p className="font-semibold">FIFA tiebreaker order</p>
        <ol className="mt-1.5 list-inside list-decimal space-y-0.5">
          <li>Points in head-to-head matches between the tied teams</li>
          <li>Head-to-head goal difference, then goals scored</li>
          <li>Overall goal difference, then overall goals scored</li>
        </ol>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TiedGroupCard
// ---------------------------------------------------------------------------

function TiedGroupCard({
  group,
  onScoreEntry,
}: {
  group: GroupData;
  groupIndex: number;
  onScoreEntry: (matchId: string, home: number, away: number) => void;
}) {
  const tiedTeams = tiedTeamsInGroup(group);
  const resolved = groupTiebreakerResolved(group);

  // Only show matches that involve at least one tied team — these are the
  // matches the ranking engine needs real scores for.
  const relevantMatches = group.matches.filter(
    (m) => tiedTeams.includes(m.home_team) || tiedTeams.includes(m.away_team),
  );

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-colors ${
        resolved
          ? "border-ps-green/30 bg-ps-green/5"
          : "border-ps-amber/40 bg-ps-amber/5"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
            {group.group_id}
          </p>
          <h3 className="text-sm font-extrabold text-ps-text">
            {group.group_name}
          </h3>
          <p className="mt-0.5 text-xs text-ps-text-sec">
            Tied: {tiedTeams.join(", ")}
          </p>
        </div>
        {resolved && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ps-green/15 text-sm text-ps-green">
            ✓
          </span>
        )}
      </div>

      {/* Match score cards */}
      <div className="space-y-2">
        {relevantMatches.map((match) => (
          <TiebreakerMatchRow
            key={match.match_id}
            match={match}
            onScoreEntry={(home, away) => onScoreEntry(match.match_id, home, away)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TiebreakerMatchRow — inline score entry per match
// ---------------------------------------------------------------------------

function TiebreakerMatchRow({
  match,
  onScoreEntry,
}: {
  match: MatchPrediction;
  onScoreEntry: (home: number, away: number) => void;
}) {
  const [homeVal, setHomeVal] = useState(
    match.exact_score?.home_score?.toString() ?? "",
  );
  const [awayVal, setAwayVal] = useState(
    match.exact_score?.away_score?.toString() ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const awayRef = useRef<HTMLInputElement>(null);

  const hasScore = match.exact_score !== undefined;

  const resultLabel =
    match.result === "home_win"
      ? `${match.home_team} win`
      : match.result === "away_win"
        ? `${match.away_team} win`
        : "Draw";

  function handleSave() {
    const home = parseInt(homeVal, 10);
    const away = parseInt(awayVal, 10);

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setError("Enter valid scores (0 or higher)");
      return;
    }

    if (!scoreMatchesResult(match.result, home, away)) {
      setError(`Score must match predicted result: ${resultLabel}`);
      return;
    }

    setError(null);
    onScoreEntry(home, away);
  }

  return (
    <div
      className={`rounded-lg border p-3 ${
        hasScore
          ? "border-ps-green/25 bg-ps-green/5"
          : "border-ps-border bg-ps-surface"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ps-text">
          {match.home_team} vs {match.away_team}
        </span>
        <span className="rounded bg-ps-chip px-2 py-0.5 font-mono text-[10px] text-ps-text-sec">
          {resultLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={homeVal}
          onChange={(e) => {
            const next = e.target.value;
            setHomeVal(next);
            setError(null);
            // Empty → non-empty transition: auto-advance to away. The
            // empty-precondition means typing a second digit (10, 12) does
            // NOT re-fire after the user clicks back into this field.
            if (homeVal === "" && next !== "") {
              awayRef.current?.focus();
              awayRef.current?.select();
            }
          }}
          placeholder="0"
          aria-label={`${match.home_team} score`}
          className="w-14 rounded border border-ps-border bg-ps-bg px-2 py-1.5 text-center font-mono text-sm focus:border-ps-text focus:outline-none"
        />
        <span className="font-mono text-xs text-ps-text-ter">–</span>
        <input
          ref={awayRef}
          type="number"
          inputMode="numeric"
          min="0"
          value={awayVal}
          onChange={(e) => { setAwayVal(e.target.value); setError(null); }}
          placeholder="0"
          aria-label={`${match.away_team} score`}
          className="w-14 rounded border border-ps-border bg-ps-bg px-2 py-1.5 text-center font-mono text-sm focus:border-ps-text focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          className="ml-auto rounded-md bg-ps-text px-3 py-1.5 text-xs font-semibold text-ps-bg hover:opacity-90 active:scale-[0.98]"
        >
          {hasScore ? "Update" : "Save"}
        </button>
      </div>

      {error && (
        <p className="mt-1.5 text-[11px] text-ps-red">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResolvedSummary
// ---------------------------------------------------------------------------

function ResolvedSummary({ tiedGroups }: { tiedGroups: GroupData[] }) {
  const resolvedCount = tiedGroups.filter(groupTiebreakerResolved).length;
  const total = tiedGroups.length;

  return (
    <div className="flex items-center justify-between rounded-xl border border-ps-border bg-ps-surface px-4 py-2.5">
      <span className="text-xs font-semibold text-ps-text-sec">
        Tiebreakers resolved
      </span>
      <span
        className={`font-mono text-sm font-bold ${
          resolvedCount === total ? "text-ps-green" : "text-ps-amber"
        }`}
      >
        {resolvedCount}/{total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function scoreMatchesResult(
  result: MatchPrediction["result"],
  home: number,
  away: number,
): boolean {
  if (!result) return true;
  if (result === "home_win") return home > away;
  if (result === "away_win") return away > home;
  if (result === "draw") return home === away;
  return false;
}
