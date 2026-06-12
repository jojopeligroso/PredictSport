"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

interface StandingRow {
  rank: number;
  user_id: string;
  display_name: string;
  points: number;
  status: string;
  eliminated: boolean;
}

interface AccuracyData {
  user: { correct: number; total: number; pct: number } | null;
  userScore: { correct: number; total: number; pct: number } | null;
  competition: { avgPoints: number; avgCorrectPct: number } | null;
}

interface StatsCardProps {
  classificationId: string;
  currentUserId: string;
  competitionId: string;
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  const mod10 = n % 10;
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

const CARD_BASE =
  "rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2.5";

export function StatsCard({
  classificationId,
  currentUserId,
  competitionId,
}: StatsCardProps) {
  const t = useT();
  const [rank, setRank] = useState<number | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [standingsRes, accuracyRes] = await Promise.all([
          fetch(
            `/api/tournament/standings?classificationId=${classificationId}&provisional=true`,
          ),
          fetch(
            `/api/tournament/accuracy?competitionId=${competitionId}`,
          ),
        ]);

        if (standingsRes.ok) {
          const data = await standingsRes.json();
          const standings = (data.standings ?? []) as StandingRow[];
          setTotalPlayers(standings.length);
          setAvailablePoints(data.availablePoints ?? 0);
          const self = standings.find((s) => s.user_id === currentUserId);
          if (self) {
            setRank(self.rank);
            setPoints(self.points);
          }
        }

        if (accuracyRes.ok) {
          const data = await accuracyRes.json();
          setAccuracy(data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classificationId, currentUserId, competitionId]);

  if (loading) {
    return (
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div key={i} className={`w-[88px] shrink-0 ${CARD_BASE}`}>
            <div className="h-7 w-12 animate-pulse rounded bg-ps-chip" />
            <div className="mt-1.5 h-3.5 w-full animate-pulse rounded bg-ps-chip" />
            <div className="mt-1 h-3 w-10 animate-pulse rounded bg-ps-chip" />
          </div>
        ))}
        <div className={`min-w-0 flex-1 ${CARD_BASE}`}>
          <div className="h-7 w-16 animate-pulse rounded bg-ps-chip" />
          <div className="mt-1.5 h-3.5 w-20 animate-pulse rounded bg-ps-chip" />
          <div className="mt-1 h-3 w-10 animate-pulse rounded bg-ps-chip" />
        </div>
      </div>
    );
  }

  const hasOutcome = accuracy?.user != null;
  const hasScore = accuracy?.userScore != null;
  const canFlip = hasOutcome || hasScore;

  return (
    <div className="flex gap-2">
      {/* Rank */}
      <div className={`w-[88px] shrink-0 ${CARD_BASE}`}>
        <p className="font-display text-2xl font-extrabold tabular-nums leading-none text-ps-amber">
          {rank != null ? `${rank}${ordinalSuffix(rank)}` : "\u2014"}
        </p>
        <p className="mt-1 text-xs font-medium text-ps-text-sec">{t('stats.your_rank')}</p>
        <p className="font-mono text-xs text-ps-text-ter">/ {totalPlayers}</p>
      </div>

      {/* Points */}
      <div className={`w-[88px] shrink-0 ${CARD_BASE}`}>
        <p className="font-display text-2xl font-extrabold tabular-nums leading-none text-ps-text">
          {points}
        </p>
        <p className="mt-1 text-xs font-medium text-ps-text-sec">{t('stats.points')}</p>
        <p className="font-mono text-xs text-ps-text-ter">
          {availablePoints > 0 ? `/ ${availablePoints}` : "\u00A0"}
        </p>
      </div>

      {/* Accuracy — flippable */}
      <button
        type="button"
        onClick={canFlip ? () => setFlipped((f) => !f) : undefined}
        aria-label={
          flipped ? t('stats.exact_score') : t('stats.outcome')
        }
        className={`min-w-0 flex-1 ${CARD_BASE} text-left transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ps-amber focus-visible:ring-offset-1 ${
          canFlip
            ? "cursor-pointer active:scale-[0.97] active:bg-ps-chip"
            : "cursor-default"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            {!flipped ? (
              /* Front: Outcome accuracy */
              <>
                <p className="font-display text-2xl font-extrabold tabular-nums leading-none text-ps-green">
                  {hasOutcome ? `${accuracy.user!.pct}%` : "\u2014"}
                </p>
                <p className="mt-1 text-xs font-medium text-ps-text-sec">
                  {t('stats.outcome')}
                </p>
                <p className="font-mono text-xs text-ps-text-ter">
                  {hasOutcome
                    ? `${accuracy.user!.correct}/${accuracy.user!.total}`
                    : t('stats.after_first_results')}
                </p>
              </>
            ) : (
              /* Back: Exact score accuracy */
              <>
                <p className="font-display text-2xl font-extrabold tabular-nums leading-none text-ps-amber">
                  {hasScore ? `${accuracy.userScore!.pct}%` : "\u2014"}
                </p>
                <p className="mt-1 text-xs font-medium text-ps-text-sec">
                  {t('stats.exact_score')}
                </p>
                <p className="font-mono text-xs text-ps-text-ter">
                  {hasScore
                    ? `${accuracy.userScore!.correct}/${accuracy.userScore!.total}`
                    : t('stats.after_first_results')}
                </p>
              </>
            )}
          </div>
          {canFlip && (
            <svg
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-ps-text-ter transition-transform duration-200 ${
                flipped ? "rotate-180" : ""
              }`}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 6.5h8M4 9.5h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      </button>
    </div>
  );
}
