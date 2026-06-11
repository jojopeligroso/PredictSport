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
        <div className="w-[72px] shrink-0 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
          <div className="h-7 w-12 animate-pulse rounded bg-ps-chip" />
          <div className="mt-1 h-3 w-full animate-pulse rounded bg-ps-chip" />
        </div>
        <div className="w-[72px] shrink-0 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
          <div className="h-7 w-8 animate-pulse rounded bg-ps-chip" />
          <div className="mt-1 h-3 w-10 animate-pulse rounded bg-ps-chip" />
        </div>
        <div className="flex-1 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
          <div className="h-7 w-12 animate-pulse rounded bg-ps-chip" />
          <div className="mt-1 h-3 w-20 animate-pulse rounded bg-ps-chip" />
        </div>
      </div>
    );
  }

  const rankSuffix =
    rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

  const hasAccuracy = accuracy?.user != null;
  const hasCompetition = accuracy?.competition != null;

  return (
    <div className="flex gap-2">
      {/* Rank — narrow */}
      <div className="w-[72px] shrink-0 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
        <p className="font-display text-2xl font-extrabold tabular-nums text-ps-amber">
          {rank != null ? `${rank}${rankSuffix}` : "—"}
        </p>
        <p className="text-[10px] font-medium text-ps-text-sec">{t('stats.your_rank')}</p>
        <p className="font-mono text-[9px] text-ps-text-ter">
          / {totalPlayers}
        </p>
      </div>

      {/* Points — narrow */}
      <div className="w-[72px] shrink-0 rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2">
        <p className="font-display text-2xl font-extrabold tabular-nums text-ps-text">
          {points}
        </p>
        <p className="text-[10px] font-medium text-ps-text-sec">{t('stats.points')}</p>
      </div>

      {/* Accuracy — wide, flippable */}
      <button
        type="button"
        onClick={() => hasCompetition && setFlipped((f) => !f)}
        className="relative flex-1 overflow-hidden rounded-lg border border-ps-border bg-ps-surface px-2.5 py-2 text-left"
        style={{ perspective: "600px" }}
        aria-label={flipped ? t('stats.tap_for_yours') : t('stats.tap_for_field')}
      >
        <div
          className="transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front — your accuracy */}
          <div
            className="flex flex-col"
            style={{ backfaceVisibility: "hidden" }}
          >
            {hasAccuracy ? (
              <>
                <p className="font-display text-2xl font-extrabold tabular-nums text-ps-green">
                  {accuracy.user!.pct}%
                </p>
                <p className="text-[10px] font-medium text-ps-text-sec">
                  {t('stats.your_accuracy')}
                </p>
                <p className="font-mono text-[9px] text-ps-text-ter">
                  {accuracy.user!.correct}/{accuracy.user!.total}
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl font-extrabold tabular-nums text-ps-green">
                  —
                </p>
                <p className="text-[10px] font-medium text-ps-text-sec">{t('stats.accuracy')}</p>
                <p className="text-[9px] text-ps-text-ter">{t('stats.after_first_results')}</p>
              </>
            )}
            {hasCompetition && (
              <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-ps-text-ter/50">
                {t('stats.tap_for_field')}
              </p>
            )}
          </div>

          {/* Back — competition averages */}
          <div
            className="absolute inset-0 flex flex-col px-2.5 py-2"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {hasCompetition && (
              <>
                <div className="flex items-baseline gap-1.5">
                  <p className="font-display text-2xl font-extrabold tabular-nums text-ps-text">
                    {accuracy.competition!.avgPoints}
                  </p>
                  <p className="text-[10px] font-medium text-ps-text-sec">
                    {t('stats.avg_points')}
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="font-mono text-base font-bold tabular-nums text-ps-text-sec">
                    {accuracy.competition!.avgCorrectPct}%
                  </p>
                  <p className="text-[9px] text-ps-text-ter">
                    {t('stats.avg_correct')}
                  </p>
                </div>
                <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-ps-text-ter/50">
                  {t('stats.tap_for_yours')}
                </p>
              </>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
