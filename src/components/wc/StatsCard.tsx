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

interface StatsCardProps {
  classificationId: string;
  currentUserId: string;
}

/**
 * StatsCard — mini stats display for the dashboard "At a Glance" row.
 * Shows rank, points, and relative position.
 */
export function StatsCard({
  classificationId,
  currentUserId,
}: StatsCardProps) {
  const t = useT();
  const [rank, setRank] = useState<number | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/tournament/standings?classificationId=${classificationId}&provisional=true`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const standings = (data.standings ?? []) as StandingRow[];
        setTotalPlayers(standings.length);
        const self = standings.find((s) => s.user_id === currentUserId);
        if (self) {
          setRank(self.rank);
          setPoints(self.points);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classificationId, currentUserId]);

  if (loading) {
    return (
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex-1 rounded-lg border border-ps-border bg-ps-surface p-3">
            <div className="h-6 w-10 animate-pulse rounded bg-ps-chip" />
            <div className="mt-1 h-3 w-14 animate-pulse rounded bg-ps-chip" />
          </div>
        ))}
      </div>
    );
  }

  const rankSuffix =
    rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

  return (
    <div className="flex gap-2 overflow-x-auto ps-scroll">
      {/* Rank */}
      <div className="min-w-[100px] flex-1 rounded-lg border border-ps-border bg-ps-surface p-3">
        <p className="text-2xl font-bold tabular-nums text-ps-amber">
          {rank != null ? `${rank}${rankSuffix}` : "—"}
        </p>
        <p className="mt-0.5 text-[11px] text-ps-text-sec">{t('stats.your_rank')}</p>
        <p className="text-[10px] text-ps-text-ter">
          {t('stats.of_players', { totalPlayers })}
        </p>
      </div>

      {/* Points */}
      <div className="min-w-[100px] flex-1 rounded-lg border border-ps-border bg-ps-surface p-3">
        <p className="text-2xl font-bold tabular-nums text-ps-text">
          {points}
        </p>
        <p className="mt-0.5 text-[11px] text-ps-text-sec">{t('stats.points')}</p>
      </div>

      {/* Accuracy — placeholder until scoring is live */}
      <div className="min-w-[100px] flex-1 rounded-lg border border-ps-border bg-ps-surface p-3">
        <p className="text-2xl font-bold tabular-nums text-ps-green">
          —
        </p>
        <p className="mt-0.5 text-[11px] text-ps-text-sec">{t('stats.accuracy')}</p>
        <p className="text-[10px] text-ps-text-ter">{t('stats.after_first_results')}</p>
      </div>
    </div>
  );
}
