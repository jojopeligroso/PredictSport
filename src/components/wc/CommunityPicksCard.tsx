"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { CountryFlag } from "@/components/CountryFlag";
import { fifaTrigram } from "@/lib/tournament/fifa-codes";

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
 * Card 1: Outcome split (home / draw / away %)
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

  const { fixture, outcomeSplit, topScores } = data;
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

  const cards = (
    <div className="flex items-stretch gap-2">
      {/* Card 1: Outcome Split */}
      <div className="min-w-[100px] flex-1 rounded-lg border border-ps-border bg-ps-surface p-3">
          <div className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wider text-ps-text-ter">
            <CountryFlag name={fixture.home} size={14} shape="pill" />
            <span>{homeTri}</span>
            <span className="text-ps-text-ter/40">v</span>
            <span>{awayTri}</span>
            <CountryFlag name={fixture.away} size={14} shape="pill" />
          </div>

          <div className="mt-2 space-y-1.5">
            <OutcomeBar
              label={homeTri}
              pct={homePct}
              color="bg-ps-amber"
            />
            <OutcomeBar
              label={t("community.draw")}
              pct={drawPct}
              color="bg-ps-text-ter"
            />
            <OutcomeBar
              label={awayTri}
              pct={awayPct}
              color="bg-ps-text-sec"
            />
          </div>
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

/** Single outcome bar (home/draw/away). */
function OutcomeBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 text-micro font-semibold text-ps-text-sec">
        {label}
      </span>
      <div className="flex-1 overflow-hidden rounded-full bg-ps-chip" style={{ height: 6 }}>
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 shrink-0 text-right font-mono text-micro tabular-nums text-ps-text-ter">
        {pct}%
      </span>
    </div>
  );
}
