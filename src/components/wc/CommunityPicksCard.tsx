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

interface ConfidenceData {
  distribution: number[]; // [level1, level2, level3, level4, level5]
  noVote: number;
  total: number;
}

interface CommunityData {
  fixture: { home: string; away: string; eventId: string } | null;
  sport: string;
  allowDraw: boolean;
  outcomeSplit: OutcomeSplit;
  topScores: TopScore[];
  confidence?: ConfidenceData;
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
 * Card 1: Flip card — front shows vertical bar chart (home / draw / away %),
 *         back shows confidence level distribution.
 * Card 2: Most popular exact score(s)
 *
 * Only renders after pick_reveal_at has passed.
 */
export function CommunityPicksCard({ competitionId, island = false }: CommunityPicksCardProps) {
  const t = useT();
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

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

  const { fixture, allowDraw, outcomeSplit, topScores, confidence } = data;
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
  const hasConfidence = confidence && confidence.total > 0;

  const cards = (
    <div className="flex items-stretch gap-2">
      {/* Card 1: Flip Card — Bar Chart (front) / Confidence (back) */}
      <div
        className="min-w-[100px] flex-1"
        style={{ perspective: 800 }}
      >
        <button
          type="button"
          onClick={() => hasConfidence && setFlipped((f) => !f)}
          className="relative w-full"
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 400ms ease",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
          aria-label={flipped ? "Show pick distribution" : "Show confidence breakdown"}
          disabled={!hasConfidence}
        >
          {/* Front face: Bar Chart */}
          <div
            className="rounded-lg border border-ps-border bg-ps-surface p-3"
            style={{ backfaceVisibility: "hidden" }}
          >
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
            {hasConfidence && <FlipHint />}
          </div>

          {/* Back face: Confidence Breakdown */}
          <div
            className="absolute inset-0 rounded-lg border border-ps-border bg-ps-surface p-3"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {confidence && confidence.total > 0 && (
              <ConfidenceBack
                distribution={confidence.distribution}
                noVote={confidence.noVote}
                total={confidence.total}
              />
            )}
            <FlipHint />
          </div>
        </button>
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
                    {s.home}&ndash;{s.away}
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

/* ── Confidence Back Face ────────────────────────────────────────────── */

const LEVEL_LABELS = ["Hopeful", "Leaning", "Confident", "V. Sure", "Dead Cert"];
const LEVEL_COLORS = [
  "#8b8275", // Hopeful — muted grey
  "#3b82f6", // Leaning — cool blue
  "#f59e0b", // Confident — warm amber
  "#d97706", // Very Sure — deep amber
  "#e23d4f", // Dead Cert — conviction red
];

interface ConfidenceBackProps {
  distribution: number[];
  noVote: number;
  total: number;
}

function ConfidenceBack({ distribution, noVote, total }: ConfidenceBackProps) {
  const maxCount = Math.max(...distribution, 1);

  return (
    <div className="flex h-full flex-col">
      {/* Header row with label and no-vote indicator */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-micro font-semibold uppercase tracking-wider text-ps-text-ter">
          Confidence
        </p>
        {noVote > 0 && (
          <span
            className="font-mono text-micro tabular-nums text-ps-text-ter/60"
            title={`${noVote} picked without setting confidence`}
          >
            {noVote} no vote
          </span>
        )}
      </div>

      {/* Confidence level rows */}
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {distribution.map((count, i) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const barWidth = maxCount > 0 ? Math.max(2, (count / maxCount) * 100) : 2;

          return (
            <div key={i} className="flex items-center gap-1.5">
              {/* Level label */}
              <span className="w-[52px] shrink-0 text-right text-micro font-medium text-ps-text-sec">
                {LEVEL_LABELS[i]}
              </span>

              {/* Bar */}
              <div className="flex flex-1 items-center">
                <div
                  className="h-3 rounded-sm transition-all duration-300"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: LEVEL_COLORS[i],
                    minWidth: count > 0 ? 6 : 2,
                    opacity: count > 0 ? 1 : 0.2,
                  }}
                />
              </div>

              {/* Count + percentage */}
              <span className="w-[38px] shrink-0 text-right font-mono text-micro tabular-nums text-ps-text-sec">
                {count > 0 ? `${count} ${pct}%` : "-"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Flip Hint Icon ──────────────────────────────────────────────────── */

function FlipHint() {
  return (
    <div className="pointer-events-none absolute bottom-1.5 right-1.5">
      <svg
        className="h-3.5 w-3.5 text-ps-text-ter/30"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h5M20 20v-5h-5"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15"
        />
      </svg>
    </div>
  );
}

/* ── Vertical Bar Chart ─────────────────────────────────────────────── */

const MAX_BAR_H = 72;      // px — tallest bar
const SMALL_PCT = 10;       // threshold: below this, text goes above the bar
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
    return Math.max(1, Math.round((pct / maxPct) * MAX_BAR_H));
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
  const textAbove = pct < SMALL_PCT;

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      {/* Label: flag icon or text */}
      {flag ? (
        <CountryFlag name={flag} size={18} shape="pill" />
      ) : label ? (
        <span className="text-micro font-medium text-ps-text-ter/50">{label}</span>
      ) : null}

      {/* Percentage above bar for small values */}
      {textAbove && (
        <span className="font-mono text-micro font-semibold tabular-nums text-ps-text-sec">
          {pct}%
        </span>
      )}

      {/* Bar */}
      <div
        className="relative w-full rounded-t-md transition-all duration-500"
        style={{ height, backgroundColor: color }}
      >
        {!textAbove && (
          <span
            className="absolute inset-0 flex items-center justify-center font-mono text-micro font-semibold tabular-nums"
            style={{ color: textColor }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}
