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

/**
 * StatsCard — mini stats display for the dashboard "At a Glance" row.
 * Rank (narrow) | Points (narrow) | Accuracy (wide, flippable).
 *
 * The accuracy card flips on tap:
 *   Front: your correct outcome %
 *   Back: competition-wide avg points + avg correct outcome %
 */
export function StatsCard({
  classificationId,
  currentUserId,
  competitionId,
}: StatsCardProps) {
  const t = useT();
  const [rank, setRank] = useState<number | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
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
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
              <div className="h-7 w-12 animate-pulse rounded bg-ps-chip" />
              <div className="mt-1 h-3 w-full animate-pulse rounded bg-ps-chip" />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
              <div className="h-7 w-10 animate-pulse rounded bg-ps-chip" />
              <div className="mt-1 h-3 w-16 animate-pulse rounded bg-ps-chip" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rankSuffix =
    rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

  const hasOutcome = accuracy?.user != null;
  const hasScore = accuracy?.userScore != null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Row 1: Rank + Points */}
      <div className="flex gap-1.5">
        <div className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
          <p className="font-display text-2xl font-extrabold tabular-nums text-ps-amber">
            {rank != null ? `${rank}${rankSuffix}` : "—"}
          </p>
          <p className="text-[10px] font-medium text-ps-text-sec">{t('stats.your_rank')}</p>
          <p className="font-mono text-[9px] text-ps-text-ter">
            / {totalPlayers}
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
          <p className="font-display text-2xl font-extrabold tabular-nums text-ps-text">
            {points}
          </p>
          <p className="text-[10px] font-medium text-ps-text-sec">{t('stats.points')}</p>
        </div>
      </div>

      {/* Row 2: Outcome Accuracy + Score Accuracy */}
      <div className="flex gap-1.5">
        <div className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
          {hasOutcome ? (
            <>
              <p className="font-display text-2xl font-extrabold tabular-nums text-ps-green">
                {accuracy.user!.pct}%
              </p>
              <p className="text-[10px] font-medium text-ps-text-sec">
                {t('stats.outcome')}
              </p>
              <p className="font-mono text-[9px] text-ps-text-ter">
                {accuracy.user!.correct}/{accuracy.user!.total}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-extrabold tabular-nums text-ps-green">—</p>
              <p className="text-[10px] font-medium text-ps-text-sec">{t('stats.outcome')}</p>
              <p className="text-[9px] text-ps-text-ter">{t('stats.after_first_results')}</p>
            </>
          )}
        </div>
        <div className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
          {hasScore ? (
            <>
              <p className="font-display text-2xl font-extrabold tabular-nums text-ps-amber">
                {accuracy.userScore!.pct}%
              </p>
              <p className="text-[10px] font-medium text-ps-text-sec">
                {t('stats.exact_score')}
              </p>
              <p className="font-mono text-[9px] text-ps-text-ter">
                {accuracy.userScore!.correct}/{accuracy.userScore!.total}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-extrabold tabular-nums text-ps-amber">—</p>
              <p className="text-[10px] font-medium text-ps-text-sec">{t('stats.exact_score')}</p>
              <p className="text-[9px] text-ps-text-ter">{t('stats.after_first_results')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
