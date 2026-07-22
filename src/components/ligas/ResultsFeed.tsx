"use client";

import Link from "next/link";
import { Bi } from "@/components/ligas/Bi";
import { useLocale } from "@/lib/i18n";

/**
 * ResultsFeed — the winter-league live / recent scoreboard.
 *
 * Server-rendered from `events`: any in-progress games surface at the top with
 * a LIVE marker; recently resulted games follow with their finals. When a
 * season has no games yet it renders nothing (the caller decides the empty
 * state). True auto-refreshing realtime can later be layered on
 * /api/results/live without changing this presentation.
 */

export interface FeedGame {
  id: string;
  date: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "live" | "resulted";
  /** Optional deep link (e.g. a team page). */
  homeHref?: string;
  awayHref?: string;
}

function TeamLine({
  name,
  score,
  href,
  winner,
}: {
  name: string;
  score: number | null;
  href?: string;
  winner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      {href ? (
        <Link
          href={href}
          className={`truncate text-sm hover:underline ${winner ? "font-bold text-ps-text" : "font-medium text-ps-text-sec"}`}
        >
          {name}
        </Link>
      ) : (
        <span
          className={`truncate text-sm ${winner ? "font-bold text-ps-text" : "font-medium text-ps-text-sec"}`}
        >
          {name}
        </span>
      )}
      <span
        className={`shrink-0 font-mono text-sm tabular-nums ${winner ? "font-bold text-ps-text" : "text-ps-text-sec"}`}
      >
        {score ?? "—"}
      </span>
    </div>
  );
}

export function ResultsFeed({ games }: { games: FeedGame[] }) {
  const { locale } = useLocale();
  if (games.length === 0) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
      day: "numeric",
      month: "short",
    });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {games.map((g) => {
        const homeWon = (g.homeScore ?? 0) > (g.awayScore ?? 0);
        const awayWon = (g.awayScore ?? 0) > (g.homeScore ?? 0);
        const live = g.status === "live";
        return (
          <article
            key={g.id}
            className="rounded-xl border border-ps-border bg-ps-surface p-3"
          >
            <div className="mb-1.5 flex items-center justify-between">
              {live ? (
                <span className="inline-flex items-center gap-1 font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-red">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ps-red" />
                  <Bi es="En vivo" en="Live" />
                </span>
              ) : (
                <span className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-ter">
                  <Bi es="Final" en="Final" />
                </span>
              )}
              <span className="font-mono text-micro text-ps-text-ter">
                {fmt(g.date)}
              </span>
            </div>
            <div className="space-y-1">
              <TeamLine
                name={g.home}
                score={g.homeScore}
                href={g.homeHref}
                winner={!live && homeWon}
              />
              <TeamLine
                name={g.away}
                score={g.awayScore}
                href={g.awayHref}
                winner={!live && awayWon}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
