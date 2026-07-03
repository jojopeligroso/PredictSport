"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

interface StandingRow {
  rank: number;
  user_id: string;
  display_name: string;
  points: number;
  eliminated?: boolean;
}

interface LiveLeaderboardProps {
  overallClassificationId: string | null;
  formatClassificationId: string | null;
  currentUserId: string | null;
}

type TabKey = "overall" | "format";

const POLL_MS = 60_000;
const WINDOW = 3; // entrants shown above and below the user

/**
 * LiveLeaderboard — windowed provisional standings for the live view.
 *
 * Shows the user ±3 rows (strict window, no pinned top), Overall/Format tabs
 * only, refreshed every 60s from the provisional standings endpoint
 * (`?provisional=true&live=true`, which scores live events in memory).
 * Expandable to the full table — but only within the live view.
 */
export function LiveLeaderboard({
  overallClassificationId,
  formatClassificationId,
  currentUserId,
}: LiveLeaderboardProps) {
  const t = useT();
  const [tab, setTab] = useState<TabKey>("overall");
  const [rowsByTab, setRowsByTab] = useState<Partial<Record<TabKey, StandingRow[]>>>({});
  const [expanded, setExpanded] = useState(false);

  const classificationIds: Record<TabKey, string | null> = {
    overall: overallClassificationId,
    format: formatClassificationId,
  };

  const fetchStandings = useCallback(async (which: TabKey) => {
    const id =
      which === "overall" ? overallClassificationId : formatClassificationId;
    if (!id) return;
    try {
      const res = await fetch(
        `/api/tournament/standings?classificationId=${encodeURIComponent(id)}&provisional=true&live=true`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { standings?: StandingRow[] };
      if (Array.isArray(data.standings)) {
        setRowsByTab((prev) => ({ ...prev, [which]: data.standings }));
      }
    } catch {
      /* transient network error — keep last known standings */
    }
  }, [overallClassificationId, formatClassificationId]);

  // Fetch on tab activation + poll the active tab every 60s (visibility-paused).
  // The effect re-runs on tab change, so the interval always polls the active tab.
  useEffect(() => {
    void fetchStandings(tab);

    const interval = setInterval(() => {
      if (!document.hidden) void fetchStandings(tab);
    }, POLL_MS);

    const onVisibility = () => {
      if (!document.hidden) void fetchStandings(tab);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tab, fetchStandings]);

  const rows = rowsByTab[tab];

  // Strict ±3 window around the user; spectators (not in table) see the top.
  let visible: StandingRow[] = [];
  let hiddenAbove = 0;
  let hiddenBelow = 0;
  if (rows && rows.length > 0) {
    if (expanded) {
      visible = rows;
    } else {
      const meIdx = currentUserId
        ? rows.findIndex((r) => r.user_id === currentUserId)
        : -1;
      const from = meIdx === -1 ? 0 : Math.max(0, meIdx - WINDOW);
      const to = meIdx === -1 ? WINDOW * 2 + 1 : meIdx + WINDOW + 1;
      visible = rows.slice(from, to);
      hiddenAbove = from;
      hiddenBelow = Math.max(0, rows.length - to);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overall", label: t("classification.overall_label") },
    { key: "format", label: t("classification.format_label") },
  ];

  return (
    <section className="ps-island mt-5">
      {/* Header: tabs + LIVE pill */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {tabs.map(({ key, label }) =>
            classificationIds[key] ? (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 text-caption font-semibold transition-colors ${
                  tab === key
                    ? "bg-ps-text text-ps-bg"
                    : "text-ps-text-ter hover:text-ps-text"
                }`}
              >
                {label}
              </button>
            ) : null
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-2 py-0.5 text-micro font-bold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {t("picks.live")}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-ps-border bg-ps-surface">
        {rows === undefined ? (
          /* Loading skeleton */
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-ps-bg-alt" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-ps-text-ter">
            {t("leaderboard.no_competition")}
          </p>
        ) : (
          <>
            {hiddenAbove > 0 && <EllipsisRow count={hiddenAbove} />}
            {visible.map((row) => {
              const isMe = currentUserId != null && row.user_id === currentUserId;
              return (
                <div
                  key={row.user_id}
                  className={`flex items-center gap-3 border-b border-ps-border/60 px-3 py-2 last:border-b-0 ${
                    isMe ? "bg-ps-amber/10" : ""
                  } ${row.eliminated ? "opacity-50" : ""}`}
                >
                  <span className="w-7 shrink-0 font-mono text-sm font-semibold tabular-nums text-ps-text-ter">
                    {row.rank}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      isMe ? "font-bold text-ps-text" : "font-medium text-ps-text"
                    }`}
                  >
                    {row.display_name}
                    {isMe && (
                      <span className="ml-1.5 rounded bg-ps-amber px-1 py-px text-micro font-bold text-ps-bg align-middle">
                        {t("classification.you_label")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-ps-text">
                    {row.points}
                    <span className="ml-1 text-micro font-semibold text-ps-text-ter">
                      {t("common.pts")}
                    </span>
                  </span>
                </div>
              );
            })}
            {hiddenBelow > 0 && <EllipsisRow count={hiddenBelow} />}
          </>
        )}
      </div>

      {/* Expand / collapse — full table available only inside the live view */}
      {rows && !expanded && (hiddenAbove > 0 || hiddenBelow > 0) && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 w-full py-1.5 text-center text-caption font-semibold text-ps-text-sec"
        >
          {t("leaderboard.see_full_table")}
        </button>
      )}
      {rows && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 w-full py-1.5 text-center text-caption font-semibold text-ps-text-ter"
        >
          {t("common.collapse")}
        </button>
      )}
    </section>
  );
}

function EllipsisRow({ count }: { count: number }) {
  return (
    <div
      aria-label={`${count} more`}
      className="border-b border-ps-border/60 px-3 py-1 text-center font-mono text-xs text-ps-text-ter last:border-b-0"
    >
      ⋯
    </div>
  );
}
