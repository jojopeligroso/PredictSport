"use client";

/**
 * GroupStep — single-group focused W/D/L predictor.
 *
 * Bite-sized: only the current group's 6 matches are shown. A compact
 * "groups overview" strip lets the user jump between groups, but the
 * focus is always one group at a time. Live standings and the
 * Continue/tiebreaker affordance match docs/DESIGN-PROMPT-WC2026-BRACKET.md
 * and docs/DESIGN-WC-H1-FULL-BRACKET.md.
 */

import { useState, useCallback, useMemo } from "react";
import MatchCard, { type MatchResult, type MatchPrediction } from "./MatchCard";
import type { GroupData } from "./GroupResultsStepV2";
import { CountryFlag } from "@/components/CountryFlag";

type PickColor = "green" | "amber";

interface TeamStanding {
  name: string;
  played: number;
  points: number;
  goal_diff: number;
  goals_for: number;
  position: number;
}

interface GroupStepProps {
  groups: GroupData[];
  pickColor?: PickColor;
  onUpdate: (groups: GroupData[]) => void;
  onAllGroupsComplete: () => void;
}

export default function GroupStep({
  groups,
  pickColor = "green",
  onUpdate,
  onAllGroupsComplete,
}: GroupStepProps) {
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    // Resume at first incomplete group; if all complete, stay at the last.
    const i = groups.findIndex((g) => g.matches.some((m) => m.result === null));
    return i === -1 ? 0 : i;
  });

  const currentGroup = groups[activeIndex];
  const completedCount = useMemo(
    () => groups.filter((g) => g.matches.every((m) => m.result !== null)).length,
    [groups],
  );

  const standings = useMemo(() => calculateLiveStandings(currentGroup), [currentGroup]);
  const currentGroupComplete = currentGroup.matches.every((m) => m.result !== null);

  const updateMatch = useCallback(
    (matchId: string, patch: Partial<MatchPrediction>) => {
      const next = groups.map((g, gi) => {
        if (gi !== activeIndex) return g;
        return {
          ...g,
          matches: g.matches.map((m) => (m.match_id === matchId ? { ...m, ...patch } : m)),
        };
      });
      onUpdate(next);
    },
    [groups, activeIndex, onUpdate],
  );

  const handleResultChange = useCallback(
    (matchId: string, newResult: MatchResult) => {
      const match = currentGroup.matches.find((m) => m.match_id === matchId);
      if (!match) return;
      // Clear stale exact_score when the result type changes.
      const clearScore = match.result !== newResult && match.exact_score !== undefined;
      updateMatch(matchId, {
        result: newResult,
        ...(clearScore ? { exact_score: undefined } : {}),
      });
    },
    [currentGroup.matches, updateMatch],
  );

  const handleScoreEntry = useCallback(
    (matchId: string, homeScore: number, awayScore: number) => {
      // Derive result from the score and update both atomically in a single
      // updateMatch call. This avoids the stale-closure race that occurs when
      // MatchCard fires onResultChange + onScoreEntry as two sequential calls
      // against the same pre-update groups snapshot.
      const inferred: MatchResult =
        homeScore > awayScore ? 'home_win' : awayScore > homeScore ? 'away_win' : 'draw';
      updateMatch(matchId, {
        result: inferred,
        exact_score: { home_score: homeScore, away_score: awayScore },
      });
    },
    [updateMatch],
  );

  function handleContinue() {
    if (!currentGroupComplete) return;
    // Move to next incomplete group, else signal completion.
    const nextIncomplete = groups.findIndex(
      (g, i) => i > activeIndex && g.matches.some((m) => m.result === null),
    );
    if (nextIncomplete !== -1) {
      setActiveIndex(nextIncomplete);
      return;
    }
    // No incomplete after this — find any incomplete (could be earlier).
    const anyIncomplete = groups.findIndex((g) => g.matches.some((m) => m.result === null));
    if (anyIncomplete !== -1) {
      setActiveIndex(anyIncomplete);
      return;
    }
    onAllGroupsComplete();
  }

  return (
    <div className="space-y-4">
      <GroupProgress
        completed={completedCount}
        total={groups.length}
        pickColor={pickColor}
      />

      <GroupOverviewStrip
        groups={groups}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        pickColor={pickColor}
      />

      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-mono text-micro font-bold uppercase tracking-widest text-ps-text-ter">
              Group {activeIndex + 1} of {groups.length}
            </p>
            <h2 className="mt-1 text-section-title font-extrabold text-ps-text">
              {currentGroup.group_name}
            </h2>
          </div>
          <p className="font-mono text-xs text-ps-text-sec">
            {currentGroup.matches.filter((m) => m.result !== null).length}/6
          </p>
        </div>
        <p className="mt-1 text-xs text-ps-text-sec">
          Pick every result. Exact scores are optional.
        </p>
      </div>

      <div className="space-y-2.5">
        {currentGroup.matches.map((match) => (
          <MatchCard
            key={match.match_id}
            match={match}
            pickColor={pickColor}
            onResultChange={(result) => handleResultChange(match.match_id, result)}
            onScoreEntry={(home, away) => handleScoreEntry(match.match_id, home, away)}
          />
        ))}
      </div>

      {currentGroupComplete && (
        <LiveStandingsTable standings={standings} pickColor={pickColor} />
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!currentGroupComplete}
        className={`w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.99] ${
          !currentGroupComplete
            ? "cursor-not-allowed bg-ps-chip text-ps-text-ter"
            : "bg-ps-text text-ps-bg hover:opacity-90"
        }`}
      >
        {!currentGroupComplete ? (
          `${6 - currentGroup.matches.filter((m) => m.result !== null).length} left to call`
        ) : completedCount === groups.length ? (
          <span className="inline-flex items-center justify-center gap-2">
            Continue to tiebreakers
            <span aria-hidden>→</span>
          </span>
        ) : (
          <span className="inline-flex items-center justify-center gap-2">
            Continue to {nextGroupLabel(groups, activeIndex)}
            <span aria-hidden>→</span>
          </span>
        )}
      </button>
    </div>
  );
}

function nextGroupLabel(groups: GroupData[], currentIndex: number): string {
  const next = groups.findIndex(
    (g, i) => i > currentIndex && g.matches.some((m) => m.result === null),
  );
  const fallback = groups.findIndex((g) => g.matches.some((m) => m.result === null));
  const target = next !== -1 ? next : fallback;
  if (target === -1) return "Group";
  return `Group ${groups[target].group_id}`;
}

function GroupProgress({
  completed,
  total,
  pickColor,
}: {
  completed: number;
  total: number;
  pickColor: PickColor;
}) {
  const pct = (completed / total) * 100;
  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ps-text">Groups</span>
        <span className="font-mono font-semibold text-ps-text-sec">
          {completed}/{total}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ps-chip">
        <div
          className={`h-full transition-all duration-300 ${
            pickColor === "amber" ? "bg-ps-amber" : "bg-ps-green"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GroupOverviewStrip({
  groups,
  activeIndex,
  onSelect,
  pickColor,
}: {
  groups: GroupData[];
  activeIndex: number;
  onSelect: (index: number) => void;
  pickColor: PickColor;
}) {
  return (
    <div className="px-1">
      <div className="flex flex-wrap gap-1.5 pb-1">
        {groups.map((group, i) => {
          const complete = group.matches.every((m) => m.result !== null);
          const inProgress = !complete && group.matches.some((m) => m.result !== null);
          const isActive = i === activeIndex;
          return (
            <button
              key={group.group_id}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={isActive}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                isActive
                  ? "bg-ps-text text-ps-bg"
                  : complete
                    ? pickColor === "amber"
                      ? "bg-ps-amber/15 text-ps-amber"
                      : "bg-ps-green/15 text-ps-green"
                    : inProgress
                      ? "border border-ps-amber/40 bg-ps-amber/5 text-ps-amber"
                      : "border border-ps-border bg-ps-bg text-ps-text-sec"
              }`}
            >
              {group.group_id}
              {complete ? " ✓" : inProgress ? " •" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LiveStandingsTable({
  standings,
  pickColor,
}: {
  standings: TeamStanding[];
  pickColor: PickColor;
}) {
  const accent = pickColor === "amber" ? "text-ps-amber" : "text-ps-green";
  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-ps-text-ter">
        Your table
      </h3>
      <div className="overflow-hidden rounded-lg border border-ps-border">
        <table className="w-full text-xs">
          <thead className="bg-ps-bg">
            <tr className="text-ps-text-ter">
              <th className="px-2 py-1.5 text-left font-semibold">#</th>
              <th className="px-2 py-1.5 text-left font-semibold">Team</th>
              <th className="px-2 py-1.5 text-right font-mono font-semibold">P</th>
              <th className="px-2 py-1.5 text-right font-mono font-semibold">GD</th>
              <th className="px-2 py-1.5 text-right font-mono font-semibold">GS</th>
              <th className="px-2 py-1.5 text-right font-mono font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ps-border bg-ps-surface">
            {standings.map((team) => {
              const qualifies = team.position <= 2;
              const playoff = team.position === 3;
              return (
                <tr key={team.name}>
                  <td
                    className={`px-2 py-1.5 font-mono font-semibold ${
                      qualifies ? accent : playoff ? "text-ps-amber" : "text-ps-text-ter"
                    }`}
                  >
                    {team.position}
                  </td>
                  <td className="px-2 py-1.5 font-semibold text-ps-text">
                    <span className="inline-flex items-center gap-1.5">
                      <CountryFlag shape="pill" name={team.name} size={16} />
                      <span>{team.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-ps-text-sec">
                    {team.played}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-ps-text-sec">
                    {team.goal_diff > 0 ? "+" : ""}
                    {team.goal_diff}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-ps-text-sec">
                    {team.goals_for}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold text-ps-text">
                    {team.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-micro text-ps-text-ter">
        Top 2 through · 3rd plays for a lifeline
      </p>
    </div>
  );
}

function calculateLiveStandings(group: GroupData): TeamStanding[] {
  const stats: Record<string, { played: number; pts: number; gf: number; ga: number }> = {};
  group.teams.forEach((t) => {
    stats[t] = { played: 0, pts: 0, gf: 0, ga: 0 };
  });

  group.matches.forEach((m) => {
    if (!m.result) return;
    stats[m.home_team].played += 1;
    stats[m.away_team].played += 1;

    // Use exact score where available, otherwise synthesise from W/D/L.
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
  });

  const sorted = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      played: s.played,
      points: s.pts,
      goal_diff: s.gf - s.ga,
      goals_for: s.gf,
      position: 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.name.localeCompare(b.name);
    });

  sorted.forEach((t, i) => {
    t.position = i + 1;
  });
  return sorted;
}

