"use client";

/**
 * ThirdPlaceStep — auto-ranked best-thirds qualification UI.
 *
 * Per docs/DESIGN-PROMPT-WC2026-BRACKET.md and FIFA Article 42.3:
 * - The 12 third-placed teams are ranked Points → GD → GS automatically.
 * - The top 8 qualify for R32.
 * - When teams are tied on points, the system shows an inline score-entry
 *   form for that team's 3 matches so GD/GS can be computed.
 *
 * This replaces the legacy "pick 8 group letters" grid — that flow was
 * a poor proxy for the FIFA rule and made the user do work the system
 * already knows how to do.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import type { GroupData, MatchPrediction } from "./GroupResultsStepV2";
import { resolveGroupStandings } from "@/lib/tournament/bracket/group-ranking";

type PickColor = "green" | "amber";

interface ThirdPlaceCandidate {
  team_name: string;
  group_id: string;
  points: number;
  goal_diff: number;
  goals_for: number;
  matches: MatchPrediction[];
  has_all_scores: boolean;
  rank: number;
}

interface ThirdPlaceStepProps {
  groups: GroupData[];
  pickColor?: PickColor;
  onUpdateGroups: (groups: GroupData[]) => void;
  onComplete: (qualifyingGroupIds: string[]) => void;
}

export default function ThirdPlaceStep({
  groups,
  pickColor = "green",
  onUpdateGroups,
  onComplete,
}: ThirdPlaceStepProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const ranked = useMemo(() => rankThirdPlaceTeams(extractThirdPlaceTeams(groups)), [groups]);
  const top8 = ranked.slice(0, 8);
  const blockedTies = useMemo(() => detectBlockingTies(ranked), [ranked]);
  const allResolved = blockedTies.size === 0;

  const updateMatchScore = useCallback(
    (matchId: string, home_score: number, away_score: number) => {
      const next = groups.map((g) => ({
        ...g,
        matches: g.matches.map((m) =>
          m.match_id === matchId ? { ...m, exact_score: { home_score, away_score } } : m,
        ),
        has_tiebreaker_scores: g.has_tiebreaker_scores || true,
      }));
      onUpdateGroups(next);
    },
    [groups, onUpdateGroups],
  );

  function handleContinue() {
    if (!allResolved) return;
    onComplete(top8.map((t) => t.group_id));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Best thirds
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-ps-text">
          Third-place ranking
        </h2>
        <p className="mt-1 text-xs text-ps-text-sec">
          The 12 third-placed teams are ranked by points, then goal difference,
          then goals scored. The top 8 advance to the Round of 32.
        </p>
      </div>

      {!allResolved && (
        <div className="rounded-xl border-2 border-ps-amber/40 bg-ps-amber/5 p-3 text-xs text-ps-text">
          <span className="font-bold text-ps-amber">Cut-line tie.</span>{" "}
          {blockedTies.size === 1 ? "One team sits" : `${blockedTies.size} teams sit`}{" "}
          on the same points across the top-8 boundary. Tap{" "}
          <span className="font-bold">&ldquo;Add scores&rdquo;</span> below to enter
          their match scores so FIFA goal difference and goals scored can rank them.
        </div>
      )}

      <ol className="space-y-2">
        {ranked.map((team) => (
          <ThirdPlaceRow
            key={`${team.group_id}-${team.team_name}`}
            team={team}
            qualifies={team.rank <= 8}
            isCutoff={team.rank === 8}
            blocked={blockedTies.has(team.team_name)}
            expanded={expanded === team.team_name}
            pickColor={pickColor}
            onToggleExpand={() =>
              setExpanded((cur) => (cur === team.team_name ? null : team.team_name))
            }
            onScoreEntry={updateMatchScore}
          />
        ))}
      </ol>

      <div className={`rounded-xl border-2 p-4 ${
        pickColor === "amber"
          ? "border-ps-amber/40 bg-ps-amber/5"
          : "border-ps-green/40 bg-ps-green/5"
      }`}>
        <p className={`text-xs font-bold uppercase tracking-widest ${
          pickColor === "amber" ? "text-ps-amber" : "text-ps-green"
        }`}>
          Qualifying to R32 ({top8.length}/8)
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {top8.map((t) => (
            <span
              key={t.team_name}
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                pickColor === "amber"
                  ? "bg-ps-amber/15 text-ps-amber"
                  : "bg-ps-green/15 text-ps-green"
              }`}
            >
              {t.team_name}{" "}
              <span className="font-mono opacity-70">({t.group_id})</span>
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={!allResolved}
        className={`w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.99] ${
          allResolved
            ? "bg-ps-text text-ps-bg hover:opacity-90"
            : "cursor-not-allowed bg-ps-chip text-ps-text-ter"
        }`}
      >
        {allResolved ? (
          <span className="inline-flex items-center justify-center gap-2">
            Continue to Round of 32
            <span aria-hidden>→</span>
          </span>
        ) : (
          `Enter scores for ${blockedTies.size} tied team${blockedTies.size === 1 ? "" : "s"}`
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function ThirdPlaceRow({
  team,
  qualifies,
  isCutoff,
  blocked,
  expanded,
  pickColor,
  onToggleExpand,
  onScoreEntry,
}: {
  team: ThirdPlaceCandidate;
  qualifies: boolean;
  isCutoff: boolean;
  blocked: boolean;
  expanded: boolean;
  pickColor: PickColor;
  onToggleExpand: () => void;
  onScoreEntry: (matchId: string, home: number, away: number) => void;
}) {
  const accent = pickColor === "amber" ? "text-ps-amber" : "text-ps-green";
  const bg = qualifies
    ? pickColor === "amber"
      ? "bg-ps-amber/5 border-ps-amber/30"
      : "bg-ps-green/5 border-ps-green/30"
    : "bg-ps-surface border-ps-border opacity-70";

  return (
    <>
      <li
        className={`rounded-xl border p-3 transition-all ${bg} ${
          isCutoff ? "shadow-[0_2px_0_0_rgba(245,158,11,0.4)]" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              qualifies
                ? pickColor === "amber"
                  ? "bg-ps-amber text-ps-bg"
                  : "bg-ps-green text-ps-bg"
                : "bg-ps-chip text-ps-text-ter"
            }`}
          >
            {team.rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ps-text">
              {qualifies ? "✓ " : ""}
              {team.team_name}
            </p>
            <p className="font-mono text-[11px] text-ps-text-sec">
              Group {team.group_id} · {team.points} pts
              {team.has_all_scores && (
                <>
                  {" "}
                  · GD {team.goal_diff > 0 ? "+" : ""}
                  {team.goal_diff} · GF {team.goals_for}
                </>
              )}
            </p>
          </div>
          {blocked && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="shrink-0 rounded-md bg-ps-amber/15 px-2.5 py-1 text-[11px] font-bold text-ps-amber"
            >
              {expanded ? "Hide" : "Add scores"}
            </button>
          )}
        </div>

        {expanded && blocked && (
          <div className="mt-3 space-y-2 rounded-lg border border-ps-amber/30 bg-ps-bg p-2.5">
            <p className="text-[11px] font-semibold text-ps-text">
              Enter scores for {team.team_name}&apos;s three group matches:
            </p>
            {team.matches.map((m) => (
              <ScoreEntryRow
                key={m.match_id}
                match={m}
                onSave={(h, a) => onScoreEntry(m.match_id, h, a)}
                accent={accent}
              />
            ))}
          </div>
        )}
      </li>

      {isCutoff && (
        <li
          aria-hidden
          className="flex items-center gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-ps-text-ter"
        >
          <span className="h-px flex-1 bg-ps-border" />
          <span>Cut line — top 8 qualify</span>
          <span className="h-px flex-1 bg-ps-border" />
        </li>
      )}
    </>
  );
}

function ScoreEntryRow({
  match,
  accent,
  onSave,
}: {
  match: MatchPrediction;
  accent: string;
  onSave: (home: number, away: number) => void;
}) {
  const [home, setHome] = useState(match.exact_score?.home_score?.toString() ?? "");
  const [away, setAway] = useState(match.exact_score?.away_score?.toString() ?? "");
  const [err, setErr] = useState<string | null>(null);
  const awayRef = useRef<HTMLInputElement>(null);
  const saved = match.exact_score !== undefined;
  const resultLabel =
    match.result === "home_win"
      ? `${match.home_team} win`
      : match.result === "away_win"
        ? `${match.away_team} win`
        : "Draw";

  function commit() {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setErr("Enter two numbers (0+)");
      return;
    }
    if (!matchesResult(match.result, h, a)) {
      setErr("Score must match your W/D/L pick");
      return;
    }
    setErr(null);
    onSave(h, a);
  }

  return (
    <div className="rounded-md bg-ps-surface p-2">
      <p className="text-[11px] font-semibold text-ps-text">
        {match.home_team} vs {match.away_team}{" "}
        <span className="ml-1 rounded bg-ps-chip px-1.5 py-0.5 font-mono text-[10px] text-ps-text-sec">
          {resultLabel}
        </span>
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={home}
          onChange={(e) => {
            const next = e.target.value;
            setHome(next);
            // Empty → non-empty: auto-advance focus to the away input.
            // The empty-precondition prevents re-firing when the user
            // clicks back to type a second digit (10, 12).
            if (home === "" && next !== "") {
              awayRef.current?.focus();
              awayRef.current?.select();
            }
          }}
          placeholder="0"
          className="w-12 rounded border border-ps-border bg-ps-bg px-1.5 py-1 text-center font-mono text-sm"
          aria-label={`${match.home_team} score`}
        />
        <span className="text-xs text-ps-text-ter">–</span>
        <input
          ref={awayRef}
          type="number"
          inputMode="numeric"
          min={0}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          placeholder="0"
          className="w-12 rounded border border-ps-border bg-ps-bg px-1.5 py-1 text-center font-mono text-sm"
          aria-label={`${match.away_team} score`}
        />
        <button
          type="button"
          onClick={commit}
          className={`ml-auto rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
            saved ? `bg-ps-chip text-ps-text-sec` : `bg-ps-text text-ps-bg hover:opacity-90`
          }`}
        >
          {saved ? "Update" : "Save"}
        </button>
        {saved && !err && <span className={`text-xs ${accent}`}>✓</span>}
      </div>
      {err && <p className="mt-1 text-[11px] text-ps-red">{err}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Identify each group's third-placed team using the full FIFA tiebreaker
 * engine — not a simplified local ranker. This matters because within-group
 * order (who is 3rd vs 4th) can hinge on head-to-head results, which the
 * engine handles and a points-only sort does not.
 *
 * Points are taken from the engine output. GD/GS are only meaningful when
 * every one of that team's three matches has a real exact_score recorded;
 * otherwise we leave them as 0 and let `detectBlockingTies` decide whether
 * to demand scores.
 */
function extractThirdPlaceTeams(groups: GroupData[]): ThirdPlaceCandidate[] {
  const candidates: ThirdPlaceCandidate[] = [];

  for (const group of groups) {
    if (group.matches.some((m) => m.result === null)) continue;
    const standings = resolveGroupStandings(group);
    if (standings.length < 3) continue;
    const third = standings[2];

    const teamMatches = group.matches.filter(
      (m) => m.home_team === third.name || m.away_team === third.name,
    );
    const hasAllScores = teamMatches.every((m) => m.exact_score !== undefined);

    candidates.push({
      team_name: third.name,
      group_id: group.group_id,
      points: third.points,
      goal_diff: hasAllScores ? third.goalDifference ?? 0 : 0,
      goals_for: hasAllScores ? third.goalsFor ?? 0 : 0,
      matches: teamMatches,
      has_all_scores: hasAllScores,
      rank: 0,
    });
  }

  return candidates;
}

function rankThirdPlaceTeams(teams: ThirdPlaceCandidate[]): ThirdPlaceCandidate[] {
  const sorted = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    // Only compare GD/GF when both sides have real scores.
    if (a.has_all_scores && b.has_all_scores) {
      if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    }
    return a.team_name.localeCompare(b.team_name);
  });
  sorted.forEach((t, i) => {
    t.rank = i + 1;
  });
  return sorted;
}

/**
 * Returns the set of team names whose finishing position blocks the wizard
 * from advancing — i.e., teams in a points-cluster that straddles the rank-8
 * cut line and are missing the exact scores needed for FIFA Article 42.3
 * cross-group ranking (points → GD → GS).
 *
 * Why only the cut-line cluster matters
 * -------------------------------------
 * Article 12.6 (Annex C) slot allocation keys off the *set* of 8 group
 * letters whose third-placed team qualified — not their ordinal rank among
 * the 12. So a points-tie that sits entirely inside the top 8 (e.g., ranks
 * 3-4-5) or entirely outside (e.g., ranks 10-11) doesn't change which 8
 * groups qualify, even if we can't order the tied teams. Only a tie that
 * crosses the rank-8/rank-9 boundary actually affects qualification.
 *
 * What "blocking" requires
 * ------------------------
 * If such a straddling tie exists AND any team in that cluster is missing
 * exact scores for all three of its group matches, the engine can't compare
 * overall GD/GS and the cluster's split across the cut line is ambiguous.
 * The teams in the cluster that are missing scores are reported as blocked
 * so the UI surfaces an "Add scores" affordance on exactly those rows.
 *
 * If every team in the straddling cluster already has full scores, GD/GS can
 * resolve them (or fall through to the random tiebreaker). That's not
 * blocking — the wizard can advance.
 */
function detectBlockingTies(ranked: ThirdPlaceCandidate[]): Set<string> {
  const blocked = new Set<string>();
  if (ranked.length < 9) return blocked;

  // The cut line sits between ranked[7] (rank 8, last qualifier) and
  // ranked[8] (rank 9, first non-qualifier). If they share a points total,
  // the entire cluster on that points value straddles the line.
  const cutA = ranked[7];
  const cutB = ranked[8];
  if (cutA.points !== cutB.points) return blocked;

  const tiedAtCut = ranked.filter((t) => t.points === cutA.points);
  const anyMissing = tiedAtCut.some((t) => !t.has_all_scores);
  if (!anyMissing) return blocked;

  for (const t of tiedAtCut) {
    if (!t.has_all_scores) blocked.add(t.team_name);
  }
  return blocked;
}

function matchesResult(result: MatchPrediction["result"], home: number, away: number): boolean {
  if (result === "home_win") return home > away;
  if (result === "away_win") return away > home;
  if (result === "draw") return home === away;
  return false;
}
