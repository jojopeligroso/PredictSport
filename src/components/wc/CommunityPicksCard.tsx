"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";
import { teamColor, textOnColor } from "@/lib/tournament/team-colors";

interface OutcomeSplit {
  home: number;
  draw: number;
  away: number;
  total: number;
}

interface TopScore {
  home: number;
  away: number;
  count: number;
  pct: number;
}

interface CommunityData {
  fixture: { home: string; away: string; eventId: string } | null;
  sport: string;
  allowDraw: boolean;
  outcomeSplit: OutcomeSplit;
  topScores: TopScore[];
}

interface CommunityPicksCardProps {
  competitionId: string;
  /** When true, suppress outer section wrapper and header — island provides these. */
  island?: boolean;
}

/**
 * CommunityPicksCard — two side-by-side cards showing competition-wide
 * prediction stats for the most recently revealed fixture.
 *
 * Card 1: Vertical bar chart (home / draw / away %)
 * Card 2: Most popular exact score(s)
 *
 * Only renders after pick_reveal_at has passed.
 */
export function CommunityPicksCard({ competitionId, island = false }: CommunityPicksCardProps) {
  const t = useT();
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tournament/community-picks?competitionId=${competitionId}`,
      );
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  // Initial fetch + refetch when PWA regains focus (new fixture may have revealed)
  useEffect(() => {
    fetchData();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchData]);

  if (loading) {
    const skeleton = (
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="min-w-[100px] flex-1 rounded-lg border border-ps-border bg-ps-surface p-3"
          >
            <div className="h-3 w-16 animate-pulse rounded bg-ps-chip" />
            <div className="mt-2 space-y-1.5">
              <div className="h-2 animate-pulse rounded bg-ps-chip" />
              <div className="h-2 w-3/4 animate-pulse rounded bg-ps-chip" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-ps-chip" />
            </div>
          </div>
        ))}
      </div>
    );
    if (island) return skeleton;
    return (
      <section className="mt-3">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-ps-chip" />
        {skeleton}
      </section>
    );
  }

  if (!data?.fixture || data.outcomeSplit.total === 0) return null;

  const { fixture, allowDraw, outcomeSplit, topScores } = data;
  const homeTri =
    fifaTrigram(fixture.home) ?? fixture.home.slice(0, 3).toUpperCase();
  const awayTri =
    fifaTrigram(fixture.away) ?? fixture.away.slice(0, 3).toUpperCase();

  const homePct =
    outcomeSplit.total > 0
      ? Math.round((outcomeSplit.home / outcomeSplit.total) * 100)
      : 0;
  const drawPct =
    outcomeSplit.total > 0
      ? Math.round((outcomeSplit.draw / outcomeSplit.total) * 100)
      : 0;
  const awayPct =
    outcomeSplit.total > 0
      ? Math.round((outcomeSplit.away / outcomeSplit.total) * 100)
      : 0;

  const showDrawBar = allowDraw;

  const cards = (
    <div className="flex items-stretch gap-2">
      {/* Card 1: Vertical Bar Chart */}
      <div className="min-w-[100px] flex-1 rounded-lg border border-ps-border bg-ps-surface p-3">
        <VerticalBarChart
          homeName={fixture.home}
          awayName={fixture.away}
          homeTri={homeTri}
          awayTri={awayTri}
          homePct={homePct}
          drawPct={drawPct}
          awayPct={awayPct}
          showDrawBar={showDrawBar}
        />
      </div>

        {/* Card 2: Popular Score */}
        <div className="min-w-[100px] flex-1 rounded-lg border border-ps-border bg-ps-surface p-3">
          <p className="text-micro font-semibold uppercase tracking-wider text-ps-text-ter">
            {t("community.popular_score")}
          </p>

          {topScores.length > 0 ? (
            <div className="mt-2 space-y-1">
              {topScores.map((s, i) => (
                <div key={`${s.home}-${s.away}`} className="flex items-baseline gap-1.5">
                  <span className="w-3.5 shrink-0 font-mono text-micro tabular-nums text-ps-text-ter">
                    {i + 1}.
                  </span>
                  <span
                    className={[
                      "font-mono tabular-nums",
                      i === 0
                        ? "text-lg font-bold text-ps-text"
                        : "text-body font-semibold text-ps-text-sec",
                    ].join(" ")}
                  >
                    {s.home}–{s.away}
                  </span>
                  <span
                    className={[
                      "font-mono tabular-nums",
                      i === 0
                        ? "text-xs font-semibold text-ps-amber"
                        : "text-micro text-ps-text-ter",
                    ].join(" ")}
                  >
                    {s.pct}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ps-text-ter">
              {t("community.no_scores")}
            </p>
          )}
        </div>
      </div>
  );

  if (island) return cards;

  return (
    <section className="mt-3">
      <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-ps-text-ter">
        {t("dash.the_field")}
      </p>
      {cards}
    </section>
  );
}

/* ── Vertical Bar Chart ─────────────────────────────────────────────── */

const MAX_BAR_H = 72; // px — tallest bar
const MIN_BAR_H = 22; // px — just enough for the percentage text
const DRAW_COLOR = "#6b7280"; // gray-500

interface VerticalBarChartProps {
  homeName: string;
  awayName: string;
  homeTri: string;
  awayTri: string;
  homePct: number;
  drawPct: number;
  awayPct: number;
  showDrawBar: boolean;
}

function VerticalBarChart({
  homeName,
  awayName,
  homePct,
  drawPct,
  awayPct,
  showDrawBar,
}: VerticalBarChartProps) {
  const homeColor = teamColor(homeName);
  const awayColor = teamColor(awayName);

  // Compute bar heights proportional to percentages
  const pcts = showDrawBar
    ? [homePct, drawPct, awayPct]
    : [homePct, awayPct];
  const maxPct = Math.max(...pcts, 1); // avoid div-by-zero

  const barH = (pct: number) => {
    if (pct === 0) return MIN_BAR_H;
    return Math.max(MIN_BAR_H, Math.round((pct / maxPct) * MAX_BAR_H));
  };

  return (
    <div className="flex items-end gap-1.5" style={{ minHeight: MAX_BAR_H + 28 }}>
      {/* Home bar */}
      <BarColumn
        flag={homeName}
        pct={homePct}
        height={barH(homePct)}
        color={homeColor}
      />

      {showDrawBar ? (
        /* Draw bar with "v" label */
        <BarColumn
          label="v"
          pct={drawPct}
          height={barH(drawPct)}
          color={DRAW_COLOR}
        />
      ) : (
        /* No-draw: small "v" separator */
        <div className="flex shrink-0 items-center self-center px-0.5">
          <span className="text-micro font-medium text-ps-text-ter/50">v</span>
        </div>
      )}

      {/* Away bar */}
      <BarColumn
        flag={awayName}
        pct={awayPct}
        height={barH(awayPct)}
        color={awayColor}
      />
    </div>
  );
}

/* ── Single Bar Column ──────────────────────────────────────────────── */

interface BarColumnProps {
  flag?: string;  // country name for flag — omit for draw column
  label?: string; // text label above bar (e.g. "v" for draw)
  pct: number;
  height: number;
  color: string;
}

function BarColumn({ flag, label, pct, height, color }: BarColumnProps) {
  const textColor = textOnColor(color);

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      {/* Label: flag icon or text */}
      {flag ? (
        <CountryFlag name={flag} size={18} shape="pill" />
      ) : label ? (
        <span className="text-micro font-medium text-ps-text-ter/50">{label}</span>
      ) : null}

      {/* Bar */}
      <div
        className="relative w-full rounded-t-md transition-all duration-500"
        style={{ height, backgroundColor: color }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center font-mono text-micro font-semibold tabular-nums"
          style={{ color: textColor }}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
