"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

interface GroupMember {
  user_id: string;
  display_name: string;
  points: number;
  predictions_made: number;
  predictions_total: number;
  is_self: boolean;
  status: string;
}

interface GroupData {
  status: "drawn" | "draw_pending" | "draw_error";
  group?: {
    name: string;
    groupNumber: number;
    members: GroupMember[];
  } | null;
  totalMembers?: number;
  drawAt?: string | null;
}

interface GroupMiniTableProps {
  classificationId: string;
  competitionId: string;
}

/**
 * GroupMiniTable — compact 4-player group table for the dashboard.
 *
 * Position coloring on the user's row only:
 *  - Green: safe (top half)
 *  - Orange: cautious (close to elimination)
 *  - Red: danger (bottom, at risk)
 */
export function GroupMiniTable({
  classificationId,
  competitionId,
}: GroupMiniTableProps) {
  const t = useT();
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/tournament/my-group?classificationId=${classificationId}&competitionId=${competitionId}`,
        );
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classificationId, competitionId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-ps-chip" />
        <div className="mt-3 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-ps-chip" />
          ))}
        </div>
      </div>
    );
  }

  if (data?.status === "draw_error") {
    return (
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-ps-text">{t('dash.your_group')}</h3>
        </div>
        <p className="mt-2 text-xs text-ps-red">{t('group.draw_failed')}</p>
      </div>
    );
  }

  if (!data || data.status === "draw_pending") {
    return (
      <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-ps-text">{t('dash.your_group')}</h3>
        </div>
        <p className="mt-2 text-xs text-ps-text-sec">
          {t('dash.groups_drawn_message')}
          {data?.totalMembers != null && (
            <span className="ml-1 text-ps-text-ter">
              {t('common.players_joined', { count: data.totalMembers })}
            </span>
          )}
        </p>
      </div>
    );
  }

  if (!data.group) return null;

  const { members } = data.group;
  const groupSize = members.length;

  /** Position color for user row. Top half = safe, bottom half logic. */
  function positionStyle(rank: number, isSelf: boolean) {
    if (!isSelf) return {};
    // Safe: top half (positions 1 to floor(size/2))
    const safeThreshold = Math.floor(groupSize / 2);
    if (rank <= safeThreshold) {
      return {
        borderLeft: "3px solid #0aa86d",
        background: "rgba(10, 168, 109, 0.06)",
      };
    }
    // Danger: last position
    if (rank === groupSize) {
      return {
        borderLeft: "3px solid var(--ps-red)",
        background: "var(--ps-red-soft)",
      };
    }
    // Caution: in between
    return {
      borderLeft: "3px solid #e8920d",
      background: "rgba(232, 146, 13, 0.06)",
    };
  }

  return (
    <div className="rounded-xl border border-ps-border bg-ps-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-ps-text">{t('dash.your_group')}</h3>
        <Link
          href="/wc/leaderboard"
          className="text-xs font-semibold text-ps-amber transition-colors hover:opacity-80"
        >
          {t('leaderboard.see_full_table')}
        </Link>
      </div>

      {/* Column headers */}
      <div className="mt-3 flex items-center border-b border-ps-border pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ps-text-ter">
        <span className="w-6 text-center">#</span>
        <span className="flex-1 pl-2">{t('leaderboard.player')}</span>
        <span className="w-10 text-right">{t('common.pts')}</span>
      </div>

      {/* Rows */}
      {members.map((m, i) => {
        const rank = i + 1;
        const style = positionStyle(rank, m.is_self);
        return (
          <div
            key={m.user_id}
            className="flex items-center py-2.5"
            style={style}
          >
            <span className="w-6 text-center text-[13px] tabular-nums text-ps-text-ter">
              {rank}
            </span>
            <span
              className={[
                "flex-1 truncate pl-2 text-sm",
                m.is_self ? "font-semibold text-ps-text" : "font-medium text-ps-text-sec",
              ].join(" ")}
            >
              {m.display_name || t('common.anonymous')}
            </span>
            <span
              className={[
                "w-10 text-right text-sm tabular-nums",
                m.is_self ? "font-semibold text-ps-text" : "text-ps-text-sec",
              ].join(" ")}
            >
              {m.points}
            </span>
          </div>
        );
      })}
    </div>
  );
}
