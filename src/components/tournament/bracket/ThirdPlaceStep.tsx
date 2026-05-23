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

import { useState, useMemo, useCallback } from "react";
import type { GroupData, MatchPrediction } from "./GroupResultsStepV2";

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
          <span className="font-bold text-ps-amber">Tiebreaker needed.</span>{" "}
          {blockedTies.size === 1 ? "One team is" : `${blockedTies.size} teams are`} tied
          on points. Tap{" "}
          <span className="font-bold">&ldquo;Add scores&rdquo;</span> below to enter
          their match scores so we can rank them by goal difference.
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
          onChange={(e) => setHome(e.target.value)}
          placeholder="0"
          className="w-12 rounded border border-ps-border bg-ps-bg px-1.5 py-1 text-center font-mono text-sm"
          aria-label={`${match.home_team} score`}
        />
        <span className="text-xs text-ps-text-ter">–</span>
        <input
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

function extractThirdPlaceTeams(groups: GroupData[]): ThirdPlaceCandidate[] {
  const candidates: ThirdPlaceCandidate[] = [];

  for (const group of groups) {
    if (group.matches.some((m) => m.result === null)) continue;
    const ranking = rankWithinGroup(group);
    if (ranking.length < 3) continue;
    const third = ranking[2];

    const teamMatches = group.matches.filter(
      (m) => m.home_team === third.name || m.away_team === third.name,
    );
    const hasAllScores = teamMatches.every((m) => m.exact_score !== undefined);
    const stats = hasAllScores ? aggregate(teamMatches, third.name) : null;

    candidates.push({
      team_name: third.name,
      group_id: group.group_id,
      points: third.points,
      goal_diff: stats?.gd ?? 0,
      goals_for: stats?.gf ?? 0,
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
 * Returns the set of team names whose finishing position can't be settled
 * without exact scores: teams on the same points as a neighbour where
 * either side is missing scores. Includes both sides of the tie.
 */
function detectBlockingTies(ranked: ThirdPlaceCandidate[]): Set<string> {
  const blocked = new Set<string>();
  for (let i = 0; i < ranked.length - 1; i++) {
    const a = ranked[i];
    const b = ranked[i + 1];
    if (a.points !== b.points) continue;
    if (!a.has_all_scores) blocked.add(a.team_name);
    if (!b.has_all_scores) blocked.add(b.team_name);
  }
  // If two teams are tied on points AND both have full scores AND straddle the
  // cut line, that's resolvable by GD/GS — not blocking.
  return blocked;
}

function rankWithinGroup(
  group: GroupData,
): Array<{ name: string; points: number; gd: number; gf: number; position: number }> {
  const stats: Record<string, { pts: number; gf: number; ga: number }> = {};
  group.teams.forEach((t) => {
    stats[t] = { pts: 0, gf: 0, ga: 0 };
  });
  for (const m of group.matches) {
    if (!m.result) continue;
    const [hs, as] = m.exact_score
      ? [m.exact_score.home_score, m.exact_score.away_score]
      : m.result === "home_win"
        ? [1, 0]
        : m.result === "away_win"
          ? [0, 1]
          : [0, 0];
    stats[m.home_team].gf += hs;
    stats[m.home_team].ga += as;
    stats[m.away_team].gf += as;
    stats[m.away_team].ga += hs;
    if (m.result === "home_win") stats[m.home_team].pts += 3;
    else if (m.result === "away_win") stats[m.away_team].pts += 3;
    else {
      stats[m.home_team].pts += 1;
      stats[m.away_team].pts += 1;
    }
  }
  const sorted = Object.entries(stats)
    .map(([name, s]) => ({ name, points: s.pts, gd: s.gf - s.ga, gf: s.gf, position: 0 }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
  sorted.forEach((t, i) => {
    t.position = i + 1;
  });
  return sorted;
}

function aggregate(matches: MatchPrediction[], teamName: string): { gd: number; gf: number } {
  let gf = 0;
  let ga = 0;
  for (const m of matches) {
    if (!m.exact_score) continue;
    if (m.home_team === teamName) {
      gf += m.exact_score.home_score;
      ga += m.exact_score.away_score;
    } else if (m.away_team === teamName) {
      gf += m.exact_score.away_score;
      ga += m.exact_score.home_score;
    }
  }
  return { gd: gf - ga, gf };
}

function matchesResult(result: MatchPrediction["result"], home: number, away: number): boolean {
  if (result === "home_win") return home > away;
  if (result === "away_win") return away > home;
  if (result === "draw") return home === away;
  return false;
}
