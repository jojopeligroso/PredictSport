"use client";

/**
 * FinalStep — predict the Final + the Third-Place Playoff, name the champion.
 *
 * The Final is fed by the two SF winners; the Third-Place Playoff is fed
 * by the two SF losers (per FIFA tournament structure). Picking a finalist
 * is what names the champion — so we collapse the two questions into one
 * tap and pre-fill `champion` from the winner of `final`. The third-place
 * playoff still requires a separate pick because either SF loser can win
 * the playoff.
 */

import type { PickColor } from "./bracket-types";
import { CountryFlag } from "@/components/CountryFlag";

interface FinalStepProps {
  finalists: { home: string; away: string };
  sfLosers: { home: string; away: string };
  champion: string;
  thirdPlace: string;
  pickColor?: PickColor;
  onChampionPick: (team: string) => void;
  onThirdPlacePick: (team: string) => void;
  onContinue: () => void;
}

export default function FinalStep({
  finalists,
  sfLosers,
  champion,
  thirdPlace,
  pickColor = "green",
  onChampionPick,
  onThirdPlacePick,
  onContinue,
}: FinalStepProps) {
  const finalReady = Boolean(finalists.home && finalists.away);
  const thirdReady = Boolean(sfLosers.home && sfLosers.away);
  const championPicked = Boolean(champion);
  const thirdPicked = Boolean(thirdPlace);
  const done = championPicked && thirdPicked;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <p className="font-mono text-micro font-bold uppercase tracking-widest text-ps-text-ter">
          Final round
        </p>
        <h2 className="mt-1 text-section-title font-extrabold text-ps-text">
          The Final &amp; 3rd-Place Playoff
        </h2>
        <p className="mt-1 text-xs text-ps-text-sec">
          Two questions: who lifts the trophy, and who beats whom for bronze.
        </p>
      </div>

      {/* Third-place playoff */}
      <section className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-ps-text-ter">
          Third-place playoff
        </h3>
        <p className="mt-1 text-caption text-ps-text-sec">
          The two semi-final losers play for bronze.
        </p>
        <div className="mt-3">
          {thirdReady ? (
            <div className="flex items-center gap-2">
              <FinalPickButton
                team={sfLosers.home}
                isSelected={thirdPlace === sfLosers.home}
                onClick={() => onThirdPlacePick(sfLosers.home)}
                pickColor={pickColor}
              />
              <span className="shrink-0 font-mono text-micro uppercase tracking-widest text-ps-text-ter">
                vs
              </span>
              <FinalPickButton
                team={sfLosers.away}
                isSelected={thirdPlace === sfLosers.away}
                onClick={() => onThirdPlacePick(sfLosers.away)}
                pickColor={pickColor}
              />
            </div>
          ) : (
            <p className="py-3 text-center text-xs text-ps-text-ter">
              Complete the semi-finals first.
            </p>
          )}
        </div>
      </section>

      {/* Final / Champion */}
      <section className="relative overflow-hidden rounded-xl border-2 border-ps-amber/40 bg-ps-amber/5 p-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-ps-amber/20 blur-2xl"
        />
        <h3 className="text-xs font-bold uppercase tracking-widest text-ps-amber">
          The Final · Pick the champion
        </h3>
        <p className="mt-1 text-caption text-ps-text-sec">
          Whoever wins this match lifts the World Cup.
        </p>
        <div className="mt-3">
          {finalReady ? (
            <div className="flex items-center gap-2">
              <FinalPickButton
                team={finalists.home}
                isSelected={champion === finalists.home}
                onClick={() => onChampionPick(finalists.home)}
                pickColor="amber"
                large
              />
              <span className="shrink-0 font-serif text-sm italic text-ps-amber">
                vs
              </span>
              <FinalPickButton
                team={finalists.away}
                isSelected={champion === finalists.away}
                onClick={() => onChampionPick(finalists.away)}
                pickColor="amber"
                large
              />
            </div>
          ) : (
            <p className="py-3 text-center text-xs text-ps-text-ter">
              Complete the semi-finals first.
            </p>
          )}
        </div>

        {championPicked && (
          <div className="mt-4 rounded-lg bg-ps-amber/10 px-3 py-3 text-center">
            <p className="font-mono text-micro font-bold uppercase tracking-widest text-ps-amber">
              Your champion
            </p>
            <p className="mt-1 font-display text-page-title font-extrabold text-ps-text">
              {champion}
            </p>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={onContinue}
        disabled={!done}
        className={`w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all active:scale-[0.99] ${
          done
            ? "bg-ps-text text-ps-bg hover:opacity-90"
            : "cursor-not-allowed bg-ps-chip text-ps-text-ter"
        }`}
      >
        {done ? (
          <span className="inline-flex items-center justify-center gap-2">
            Review &amp; submit bracket
            <span aria-hidden>→</span>
          </span>
        ) : !championPicked && !thirdPicked ? (
          "Pick the champion and 3rd-place winner"
        ) : !championPicked ? (
          "Pick the champion"
        ) : (
          "Pick the 3rd-place winner"
        )}
      </button>
    </div>
  );
}

function FinalPickButton({
  team,
  isSelected,
  onClick,
  pickColor,
  large = false,
}: {
  team: string;
  isSelected: boolean;
  onClick: () => void;
  pickColor: PickColor;
  large?: boolean;
}) {
  const selectedClasses =
    pickColor === "amber"
      ? "border-ps-amber bg-ps-amber/15 text-ps-amber"
      : "border-ps-green/40 bg-ps-green/10 text-ps-green";
  const sizeClasses = large
    ? "min-h-[56px] text-base"
    : "min-h-[44px] text-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md border-2 px-2 py-2 font-extrabold transition-all active:scale-[0.98] ${sizeClasses} ${
        isSelected
          ? selectedClasses
          : "border-ps-border bg-ps-bg text-ps-text hover:border-ps-text/30"
      }`}
    >
      <CountryFlag shape="pill" name={team} size={large ? 22 : 18} />
      <span className="truncate">{team}</span>
    </button>
  );
}
