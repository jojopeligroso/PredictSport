"use client";

import type { BracketSubmissionData } from "@/types/tournament";
import type { OfficialBracketResults } from "@/lib/bracket/types";
import { WC2026_KNOCKOUT_ROUNDS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { CountryFlag } from "@/components/CountryFlag";

interface BracketTreeProps {
  submission: BracketSubmissionData;
  officialResults?: OfficialBracketResults;
  displayName: string;
  isLive: boolean;
  deadAtRound?: string;
}

/**
 * Read-only bracket tree visualization showing a user's picks
 * against official results (if available).
 */
export function BracketTree({
  submission,
  officialResults,
  displayName,
  isLive,
  deadAtRound,
}: BracketTreeProps) {
  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        isLive
          ? "border-ps-green bg-ps-surface"
          : "border-ps-border bg-ps-surface opacity-75"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ps-text">{displayName}</h3>
        {isLive ? (
          <span className="rounded-full bg-ps-green/15 px-2 py-0.5 text-xs font-semibold text-ps-green">
            Alive
          </span>
        ) : (
          <span className="rounded-full bg-ps-red/15 px-2 py-0.5 text-xs font-semibold text-ps-red">
            Dead{deadAtRound ? ` at ${deadAtRound}` : ""}
          </span>
        )}
      </div>

      {/* Champion pick */}
      <div className="mt-3 rounded-lg bg-ps-amber/5 border border-ps-amber/20 px-3 py-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ps-amber">
          Champion
        </span>
        <p className="flex items-center justify-center gap-2 text-base font-extrabold text-ps-text">
          {submission.champion && (
            <CountryFlag shape="pill" name={submission.champion} size={24} />
          )}
          <span>{submission.champion || "?"}</span>
        </p>
      </div>

      {/* Knockout rounds */}
      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-3" style={{ minWidth: `${WC2026_KNOCKOUT_ROUNDS.length * 140}px` }}>
          {WC2026_KNOCKOUT_ROUNDS.map((round) => (
            <div key={round.roundKey} className="flex-1 min-w-[120px]">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-ps-text-ter">
                {round.name}
              </h4>
              <div className="mt-1 space-y-1">
                {round.slotIds.map((slotId) => {
                  const pick = submission.knockoutPicks[slotId]?.winner;
                  const official = officialResults?.knockoutResults?.[slotId]?.winner;
                  const resolved = official !== undefined;
                  const correct = resolved && pick === official;
                  const wrong = resolved && pick !== official;

                  return (
                    <div
                      key={slotId}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
                        correct
                          ? "bg-ps-green/10 text-ps-green"
                          : wrong
                            ? "bg-ps-red/10 text-ps-red line-through"
                            : "bg-ps-bg text-ps-text"
                      }`}
                    >
                      {pick && <CountryFlag shape="pill" name={pick} size={14} />}
                      <span className="truncate">
                        {pick || "?"}
                        {correct && " \u2713"}
                        {wrong && ` \u2717 (${official})`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Third place */}
      {submission.thirdPlace && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ps-text-sec">
          3rd Place:
          <CountryFlag shape="pill" name={submission.thirdPlace} size={14} />
          <span className="font-semibold text-ps-text">{submission.thirdPlace}</span>
        </div>
      )}
    </div>
  );
}
