"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

interface TeaserPrediction {
  userId: string;
  displayName: string;
  winner: string | null;
  exactScore: { home: number; away: number } | null;
  winnerCorrect: boolean | null;
  scoreCorrect: boolean | null;
  totalPoints: number;
}

interface TeaserEvent {
  eventId: string;
  name: string;
  resultConfirmed: boolean;
  resultData: Record<string, unknown> | null;
  externalEventId: string | null;
}

interface TeaserData {
  event: TeaserEvent | null;
  predictions: TeaserPrediction[];
  totalMembers: number;
}

interface Props {
  competitionId: string;
}

export function RivalTeaser({ competitionId }: Props) {
  const t = useT();
  const [data, setData] = useState<TeaserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/tournament/rival-predictions?competitionId=${competitionId}&mode=teaser`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  // Don't render until loaded, and only if there's data
  if (loading || !data?.event || data.predictions.length === 0) return null;

  const { event, predictions, totalMembers } = data;

  // Parse fixture name for subtitle (e.g., "France vs Argentina · Matchday 2")
  const fixtureName = event.name;

  return (
    <div className="overflow-hidden rounded-xl border border-ps-border bg-white shadow-sm dark:bg-ps-surface">
      {/* Header */}
      <div className="border-b border-ps-border/50 px-3.5 py-2.5">
        <p className="text-xs font-bold text-ps-text-sec">
          {t("rivals.group_picks")}
        </p>
        <p className="mt-px truncate text-[11px] text-ps-text-ter">{fixtureName}</p>
      </div>

      {/* Prediction rows — group members only (excluding self) */}
      {predictions.map((row, i) => {
        const noPick = row.winner === null;
        const isExact = row.scoreCorrect === true;
        const isCorrect = !isExact && row.winnerCorrect === true;
        const isWrong = row.winnerCorrect === false;

        let rowClass = "border-l-transparent";
        if (isExact || isCorrect) rowClass = "border-l-ps-green bg-ps-green-soft";
        else if (isWrong) rowClass = "border-l-ps-red bg-ps-red-soft";
        else if (noPick) rowClass = "border-l-ps-border";

        // Display value: exact correct → score, winner correct → team, wrong → team (not score)
        let displayValue: string | null = null;
        let displayMono = false;
        if (noPick) {
          displayValue = null;
        } else if (isExact && row.exactScore) {
          displayValue = `${row.exactScore.home}–${row.exactScore.away}`;
          displayMono = true;
        } else if (isWrong) {
          displayValue = row.winner;
        } else {
          displayValue = row.winner;
        }

        // Points pill
        let pillClass =
          "bg-ps-bg text-ps-text-ter border border-ps-border";
        if (isExact) pillClass = "bg-[#00c87a] text-white";
        else if (isCorrect) pillClass = "bg-ps-green text-white";
        else if (isWrong) pillClass = "bg-ps-red text-white";

        return (
          <div
            key={row.userId}
            className={`flex items-center gap-2 border-l-[3px] px-3.5 py-2 ${rowClass} ${
              i > 0 ? "border-t border-t-ps-border/40" : ""
            }`}
          >
            <span
              className={`flex-1 truncate text-xs font-medium ${
                noPick ? "text-ps-text-ter" : "text-ps-text"
              }`}
            >
              {row.displayName}
            </span>
            {noPick ? (
              <span className="text-[11px] italic text-ps-text-ter">
                {t("rivals.no_prediction")}
              </span>
            ) : (
              <span
                className={`text-xs font-semibold text-ps-text ${
                  displayMono ? "font-mono" : ""
                }`}
              >
                {displayValue}
              </span>
            )}
            <div
              className={`flex h-5 min-w-[26px] items-center justify-center rounded-[10px] px-1.5 text-[11px] font-bold ${pillClass}`}
            >
              {row.totalPoints}
            </div>
          </div>
        );
      })}

      {/* Footer link */}
      <div className="border-t border-ps-border/50 px-3.5 py-2.5">
        <Link
          href={`/wc/leaderboard?tab=rivals&eventId=${event.eventId}`}
          className="flex items-center gap-1 text-[13px] font-semibold text-ps-amber"
        >
          {t("rivals.see_all_predictions", { count: totalMembers })}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
