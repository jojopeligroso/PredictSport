"use client";

/**
 * KnockoutStageStep — single knockout round predictor (R32/R16/QF/SF).
 *
 * Each round renders as one focused step rather than a 16-match scroll.
 * For R32, slots are paired into "halves of the bracket" so the user
 * sees natural progression. Later rounds derive matchups from the previous
 * round's picks.
 *
 * Picks the *advancing* team — per docs/DESIGN-WC-UNIFIED-PREDICTIONS.md, a
 * knockout match in the Bracket classification is "who progresses", not the
 * 90+ET result. (The 90+ET result is collected separately via per-event
 * `predictions` rows; that side of the model is U5b territory.)
 */

import { useMemo } from "react";
import type { PickColor } from "./bracket-types";

interface KnockoutStageStepProps {
  roundKey: "r32" | "r16" | "qf" | "sf";
  roundName: string;
  slotIds: string[];
  matchups: Record<string, { home: string; away: string }>;
  picks: Record<string, { winner: string }>;
  pickColor?: PickColor;
  nextRoundName?: string;
  onPick: (slotId: string, winner: string) => void;
  onContinue: () => void;
}

export default function KnockoutStageStep({
  roundKey,
  roundName,
  slotIds,
  matchups,
  picks,
  pickColor = "green",
  nextRoundName,
  onPick,
  onContinue,
}: KnockoutStageStepProps) {
  const completed = useMemo(
    () => slotIds.filter((s) => picks[s]?.winner).length,
    [slotIds, picks],
  );
  const total = slotIds.length;
  const allDone = completed === total;
  const allReady = slotIds.every((s) => matchups[s]?.home && matchups[s]?.away);

  // Group R32 picks into bracket halves for visual scanning.
  const halves: { label: string; slots: string[] }[] =
    roundKey === "r32"
      ? [
          { label: "Top half", slots: slotIds.slice(0, 8) },
          { label: "Bottom half", slots: slotIds.slice(8, 16) },
        ]
      : [{ label: roundName, slots: slotIds }];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
          Knockout · {roundKey.toUpperCase()}
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ps-text">{roundName}</h2>
          <span className="font-mono text-xs font-semibold text-ps-text-sec">
            {completed}/{total}
          </span>
        </div>
        <p className="mt-1 text-xs text-ps-text-sec">
          Tap the team you think advances. {roundKey === "sf" ? "Losers play for 3rd place." : "Winners flow into the next round."}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ps-chip">
          <div
            className={`h-full transition-all duration-300 ${
              pickColor === "amber" ? "bg-ps-amber" : "bg-ps-green"
            }`}
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </div>

      {!allReady && (
        <div className="rounded-xl border border-ps-amber/30 bg-ps-amber/5 p-3 text-xs text-ps-text">
          Some matchups are waiting on earlier-round picks. Go back to complete them.
        </div>
      )}

      {halves.map((half) => (
        <div key={half.label} className="space-y-2">
          {halves.length > 1 && (
            <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
              {half.label}
            </h3>
          )}
          <div className="space-y-2">
            {half.slots.map((slotId, idx) => {
              const matchup = matchups[slotId] ?? { home: "", away: "" };
              const winner = picks[slotId]?.winner;
              const matchNumberInRound =
                slotIds.indexOf(slotId) + 1;
              return (
                <KnockoutMatchRow
                  key={slotId}
                  slotId={slotId}
                  matchNumber={matchNumberInRound}
                  home={matchup.home}
                  away={matchup.away}
                  selected={winner}
                  pickColor={pickColor}
                  onPick={(team) => onPick(slotId, team)}
                  showSeparator={idx < half.slots.length - 1}
                />
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onContinue}
        disabled={!allDone}
        className={`w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.99] ${
          allDone
            ? "bg-ps-text text-ps-bg hover:opacity-90"
            : "cursor-not-allowed bg-ps-chip text-ps-text-ter"
        }`}
      >
        {allDone ? (
          <span className="inline-flex items-center justify-center gap-2">
            {nextRoundName ? `Continue to ${nextRoundName}` : "Continue"}
            <span aria-hidden>→</span>
          </span>
        ) : (
          `Pick ${total - completed} more`
        )}
      </button>
    </div>
  );
}

function KnockoutMatchRow({
  slotId,
  matchNumber,
  home,
  away,
  selected,
  pickColor,
  onPick,
  showSeparator,
}: {
  slotId: string;
  matchNumber: number;
  home: string;
  away: string;
  selected?: string;
  pickColor: PickColor;
  onPick: (team: string) => void;
  showSeparator: boolean;
}) {
  const bothReady = Boolean(home && away);
  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] font-bold text-ps-text-ter">
          M{matchNumber}
        </span>
        <span className="text-[10px] text-ps-text-ter" aria-hidden>
          •
        </span>
        <span className="font-mono text-[10px] text-ps-text-ter">{slotId}</span>
      </div>
      {bothReady ? (
        <div className="flex items-center gap-2">
          <TeamPickButton
            team={home}
            isSelected={selected === home}
            onClick={() => onPick(home)}
            pickColor={pickColor}
          />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ps-text-ter">
            vs
          </span>
          <TeamPickButton
            team={away}
            isSelected={selected === away}
            onClick={() => onPick(away)}
            pickColor={pickColor}
          />
        </div>
      ) : (
        <p className="py-2 text-center text-[11px] text-ps-text-ter">
          Waiting for previous-round picks
        </p>
      )}
      {showSeparator && <span className="sr-only">match {matchNumber} complete</span>}
    </div>
  );
}

function TeamPickButton({
  team,
  isSelected,
  onClick,
  pickColor,
}: {
  team: string;
  isSelected: boolean;
  onClick: () => void;
  pickColor: PickColor;
}) {
  const selectedClasses =
    pickColor === "amber"
      ? "border-ps-amber/40 bg-ps-amber/10 text-ps-amber"
      : "border-ps-green/40 bg-ps-green/10 text-ps-green";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`flex min-h-[44px] flex-1 items-center justify-center rounded-md border px-2 py-2 text-sm font-bold transition-all active:scale-[0.98] ${
        isSelected
          ? selectedClasses
          : "border-ps-border bg-ps-bg text-ps-text hover:border-ps-text/30"
      }`}
    >
      {team}
    </button>
  );
}
