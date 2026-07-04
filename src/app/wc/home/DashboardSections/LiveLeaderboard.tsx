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

interface LivePrediction {
  event_id: string;
  home_score: number;
  away_score: number;
}

interface LiveMatch {
  id: string;
  event_name: string;
  home_score: number;
  away_score: number;
  status: string;
  start_time: string;
}

export interface ScoreboardMatch {
  id: string;
  homeTrigram: string;
  awayTrigram: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
}

interface LiveLeaderboardProps {
  overallClassificationId: string | null;
  formatClassificationId: string | null;
  currentUserId: string | null;
  /** Compact live scoreboard rendered above the table ("As it stands"). */
  scoreboard?: ScoreboardMatch[];
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
  scoreboard,
}: LiveLeaderboardProps) {
  const t = useT();
  // Format is the default lens when available; fall back to Overall.
  const [tab, setTab] = useState<TabKey>(
    formatClassificationId ? "format" : "overall"
  );
  const [rowsByTab, setRowsByTab] = useState<Partial<Record<TabKey, StandingRow[]>>>({});
  const [predsByTab, setPredsByTab] = useState<Partial<Record<TabKey, Record<string, LivePrediction[]>>>>({});
  const [matchesByTab, setMatchesByTab] = useState<Partial<Record<TabKey, LiveMatch[]>>>({});
  const [expanded, setExpanded] = useState(false);
  const [showPicks, setShowPicks] = useState(false);
  const [flippedUserId, setFlippedUserId] = useState<string | null>(null);

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
      const data = (await res.json()) as {
        standings?: StandingRow[];
        livePredictionsByUser?: Record<string, LivePrediction[]>;
        liveMatches?: LiveMatch[];
      };
      if (Array.isArray(data.standings)) {
        setRowsByTab((prev) => ({ ...prev, [which]: data.standings }));
      }
      setPredsByTab((prev) => ({ ...prev, [which]: data.livePredictionsByUser ?? {} }));
      setMatchesByTab((prev) => ({ ...prev, [which]: data.liveMatches ?? [] }));
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
  const predictions = predsByTab[tab] ?? {};
  const liveMatchList = matchesByTab[tab] ?? [];

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
      {/* "As it stands" header + LIVE pill + show picks toggle */}
      <div className="mb-1.5 flex items-center gap-2">
        <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ps-text-ter">
          {t("leaderboard.as_it_stands")}
          <span className="inline-flex items-center gap-1 rounded-full bg-ps-red/90 px-1.5 py-0.5 text-micro font-bold normal-case text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {t("picks.live")}
          </span>
        </p>
        <button
          type="button"
          onClick={() => { setShowPicks((s) => !s); setFlippedUserId(null); }}
          className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-micro font-semibold transition-colors ${
            showPicks
              ? "bg-ps-surface text-ps-text border border-ps-border shadow-sm"
              : "text-ps-text-ter border border-transparent hover:text-ps-text"
          }`}
        >
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            {showPicks ? (
              <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5ZM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M2 2l12 12M6.5 6.5a2.1 2.1 0 0 0 3 3M4 4.5C2.8 5.7 2 8 2 8s2.5 5 6 5c1.2 0 2.3-.4 3.2-1M14 8s-.7-1.5-2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          {t("leaderboard.show_picks")}
        </button>
      </div>

      {/* Compact live scoreboard */}
      {scoreboard && scoreboard.length > 0 && (
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {scoreboard.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-center gap-2 rounded-lg border border-ps-border bg-ps-surface px-2 py-1.5"
            >
              <span className="font-mono text-sm font-bold tabular-nums text-ps-text">
                {m.homeTrigram}{" "}
                {m.homeScore != null && m.awayScore != null
                  ? `${m.homeScore}–${m.awayScore}`
                  : "–"}{" "}
                {m.awayTrigram}
              </span>
              {m.status && (
                <span className="font-mono text-micro font-semibold text-ps-red">
                  {/^\d+$/.test(m.status) ? `${m.status}'` : m.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-2 flex gap-1">
        {tabs.map(({ key, label }) =>
          classificationIds[key] ? (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-3 py-1 text-caption font-semibold transition-colors ${
                tab === key
                  ? "border border-ps-border bg-ps-surface text-ps-text"
                  : "border border-transparent text-ps-text-ter hover:text-ps-text"
              }`}
            >
              {label}
            </button>
          ) : null
        )}
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
              const userPreds = predictions[row.user_id];
              const hasPreds = userPreds && userPreds.length > 0;
              const isFlipped = flippedUserId === row.user_id;
              const canFlip = !showPicks && hasPreds;

              return (
                <div
                  key={row.user_id}
                  className={`border-b border-ps-border/60 last:border-b-0 ${row.eliminated ? "opacity-50" : ""}`}
                  onClick={canFlip ? () => setFlippedUserId(isFlipped ? null : row.user_id) : undefined}
                  style={canFlip ? { cursor: "pointer", WebkitTapHighlightColor: "transparent" } : undefined}
                >
                  <div className="relative" style={{ perspective: "600px" }}>
                    <div
                      className="transition-transform duration-300"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: isFlipped ? "rotateX(180deg)" : "rotateX(0deg)",
                      }}
                    >
                      {/* Front face */}
                      <div
                        className={`flex items-center gap-3 px-3 py-2 ${isMe ? "bg-ps-amber/10" : ""} transition-opacity duration-300 ${isFlipped ? "opacity-0" : "opacity-100"}`}
                        style={{ backfaceVisibility: "hidden" }}
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
                        {/* Inline predictions when showPicks is on */}
                        {showPicks && hasPreds && (
                          <span className="shrink-0 font-mono text-xs font-semibold text-ps-text-sec">
                            {userPreds!.map((p, i) => (
                              <span key={p.event_id}>
                                {i > 0 && <span className="text-ps-text-ter"> · </span>}
                                {p.home_score}–{p.away_score}
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-ps-text">
                          {row.points}
                          <span className="ml-1 text-micro font-semibold text-ps-text-ter">
                            {t("common.pts")}
                          </span>
                        </span>
                      </div>

                      {/* Back face — predictions */}
                      <div
                        className={`absolute inset-0 flex items-center gap-3 px-3 py-2 ${isMe ? "bg-ps-amber/10" : "bg-ps-surface"}`}
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateX(180deg)",
                        }}
                      >
                        <span
                          className={`min-w-0 truncate text-sm ${isMe ? "font-bold text-ps-text" : "font-medium text-ps-text"}`}
                        >
                          {row.display_name}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-sm font-bold tabular-nums text-ps-text-sec">
                          {hasPreds && userPreds!.map((p, i) => {
                            const match = liveMatchList.find((m) => m.id === p.event_id);
                            const trigrams = match?.event_name?.split(" vs ") ?? [];
                            return (
                              <span key={p.event_id} className="inline-flex items-center">
                                {i > 0 && <span className="mx-1 text-ps-text-ter">·</span>}
                                {trigrams[0] && <span className="text-micro font-semibold text-ps-text-ter">{trigrams[0].slice(0, 3).toUpperCase()}</span>}
                                <span className={`mx-0.5 ${isMe ? "text-ps-amber" : "text-ps-text"}`}>{p.home_score}–{p.away_score}</span>
                                {trigrams[1] && <span className="text-micro font-semibold text-ps-text-ter">{trigrams[1].slice(0, 3).toUpperCase()}</span>}
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
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
