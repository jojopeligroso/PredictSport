"use client";

import { useState, useMemo } from "react";
import type { EntrantPick } from "./fetchEntrantProfileData";

interface PicksByRoundProps {
  picks: EntrantPick[];
  searchText: string;
}

interface RoundGroup {
  roundNumber: number | null;
  roundName: string;
  picks: EntrantPick[];
}

export function PicksByRound({ picks, searchText }: PicksByRoundProps) {
  // Group picks by round
  const roundGroups = useMemo(() => {
    const filtered = searchText.trim()
      ? picks.filter((p) =>
          p.eventName.toLowerCase().includes(searchText.toLowerCase()),
        )
      : picks;

    const groups = new Map<string, RoundGroup>();
    for (const pick of filtered) {
      const key = pick.roundName ?? "Other";
      if (!groups.has(key)) {
        groups.set(key, {
          roundNumber: pick.roundNumber,
          roundName: pick.roundName ?? "Other",
          picks: [],
        });
      }
      groups.get(key)!.picks.push(pick);
    }

    // Sort rounds by round_number descending (newest first)
    return [...groups.values()].sort(
      (a, b) => (b.roundNumber ?? 0) - (a.roundNumber ?? 0),
    );
  }, [picks, searchText]);

  if (roundGroups.length === 0 && picks.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center text-sm text-ps-text-sec">
        No picks yet
      </div>
    );
  }

  if (roundGroups.length === 0 && searchText.trim()) {
    return (
      <div className="mt-4 rounded-xl border border-ps-border bg-ps-surface px-4 py-8 text-center text-sm text-ps-text-sec">
        No picks matching &ldquo;{searchText}&rdquo;
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {roundGroups.map((group, index) => (
        <RoundSection key={group.roundName} group={group} defaultExpanded={index === 0} />
      ))}
    </div>
  );
}

function RoundSection({ group, defaultExpanded }: { group: RoundGroup; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full min-h-[44px] items-center justify-between px-3 py-2"
      >
        <span className="font-display text-xs font-extrabold uppercase tracking-wider text-ps-text-ter">
          {group.roundName}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-ps-text-ter">
            {group.picks.length} {group.picks.length === 1 ? "pick" : "picks"}
          </span>
          <svg
            className={`h-4 w-4 text-ps-text-ter transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-ps-border border-t border-ps-border">
          {group.picks.map((pick) => (
            <PickRow key={pick.eventId} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}

function PickRow({ pick }: { pick: EntrantPick }) {
  // Extract result scores if available
  let resultHome: number | null = null;
  let resultAway: number | null = null;
  if (pick.resultData) {
    const rd = pick.resultData as Record<string, unknown>;
    const score = rd.score as Record<string, unknown> | undefined;
    if (score) {
      const h = Number(score.home_score ?? score.home);
      const a = Number(score.away_score ?? score.away);
      if (!isNaN(h)) resultHome = h;
      if (!isNaN(a)) resultAway = a;
    } else {
      const h = Number(rd.home_score ?? rd.homeScore);
      const a = Number(rd.away_score ?? rd.awayScore);
      if (!isNaN(h)) resultHome = h;
      if (!isNaN(a)) resultAway = a;
    }
  }

  const totalPoints = pick.winnerPoints + pick.scorePoints + pick.h2hPoints;

  return (
    <div className="px-3 py-2.5">
      {/* Event name */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ps-text truncate">
          {pick.eventName}
        </span>
        {totalPoints > 0 && (
          <span className="ml-2 shrink-0 font-mono text-sm font-bold text-ps-green">
            +{totalPoints}
          </span>
        )}
      </div>

      {/* Prediction details */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-ps-text-sec">
        {/* Winner pick */}
        {pick.winnerPick && (
          <span className="flex items-center gap-1">
            {pick.winnerCorrect === true && (
              <span className="text-ps-green">{"\u2713"}</span>
            )}
            {pick.winnerCorrect === false && (
              <span className="text-ps-red">{"\u2717"}</span>
            )}
            {pick.winnerPick}
          </span>
        )}

        {/* Score pick */}
        {pick.scorePick && (
          <span className="flex items-center gap-1">
            {pick.scoreCorrect === true && (
              <span className="text-ps-green">{"\u2713"}</span>
            )}
            {pick.scoreCorrect === false && (
              <span className="text-ps-red">{"\u2717"}</span>
            )}
            {pick.scorePick.home}-{pick.scorePick.away}
          </span>
        )}

        {/* Actual result */}
        {resultHome !== null && resultAway !== null && (
          <span className="text-ps-text-ter">
            Result: {resultHome}-{resultAway}
          </span>
        )}
      </div>

      {/* No pick indicator */}
      {!pick.winnerPick && !pick.scorePick && (
        <div className="mt-1 text-xs text-ps-text-ter italic">
          No pick
        </div>
      )}
    </div>
  );
}
