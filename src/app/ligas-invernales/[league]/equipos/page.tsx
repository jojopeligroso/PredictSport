import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/AuthRequired";
import { Bi } from "@/components/ligas/Bi";
import { ligaVars } from "@/components/ligas/theme";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueContext,
  reduceTeamEvents,
  slugifyTeam,
  LIGA_SLUGS,
  type LigaSlug,
} from "@/lib/ligas/teams";

export const dynamic = "force-dynamic";

/**
 * /ligas-invernales/[league]/equipos — every team in the league, with a
 * results-derived record. Serie del Caribe is excluded (no standing roster).
 */

interface EventRow {
  id: string;
  event_name: string;
  start_time: string;
  status: string;
  result_data: Record<string, unknown> | null;
}

export default async function EquiposPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  if (!LIGA_SLUGS.includes(league as LigaSlug)) notFound();
  return (
    <AuthRequired>
      <EquiposContent league={league} />
    </AuthRequired>
  );
}

async function EquiposContent({ league }: { league: string }) {
  const supabase = await createClient();
  const ctx = await getLeagueContext(supabase, league);
  if (!ctx || ctx.teams.length === 0) notFound();

  const { data: eventRows } = await supabase
    .from("events")
    .select("id, event_name, start_time, status, result_data")
    .eq("tournament_id", ctx.tournamentId)
    .limit(2000);
  const events = (eventRows ?? []) as EventRow[];

  const rows = ctx.teams
    .map((team) => {
      const { stats } = reduceTeamEvents(team, events);
      return { team, slug: slugifyTeam(team), stats };
    })
    .sort((a, b) => {
      if (b.stats.played === 0 && a.stats.played === 0)
        return a.team.localeCompare(b.team);
      return b.stats.winPct - a.stats.winPct || b.stats.runDiff - a.stats.runDiff;
    });

  const anyPlayed = rows.some((r) => r.stats.played > 0);

  return (
    <main className="pt-8" style={ligaVars(league)}>
      <header>
        <Link
          href={`/ligas-invernales/${league}`}
          className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga"
        >
          ← {ctx.tournamentName}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
          <Bi es="Equipos" en="Teams" />
        </h1>
        <p className="mt-1 font-mono text-micro text-ps-text-ter">
          {ctx.teams.length} <Bi es="equipos" en="teams" />
          {anyPlayed && (
            <>
              {" · "}
              <Bi es="ordenados por %" en="ranked by win %" />
            </>
          )}
        </p>
      </header>

      <section className="mt-4 space-y-2">
        {rows.map((r, idx) => (
          <Link
            key={r.slug}
            href={`/ligas-invernales/${league}/equipos/${r.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-ps-border bg-ps-surface p-3 transition-colors hover:border-liga"
          >
            {anyPlayed && (
              <span className="w-5 shrink-0 text-center font-mono text-sm font-bold tabular-nums text-ps-text-ter">
                {r.stats.played > 0 ? idx + 1 : "—"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ps-text">
                {r.team}
              </p>
              {r.stats.played > 0 ? (
                <p className="font-mono text-micro text-ps-text-ter">
                  {r.stats.wins}-{r.stats.losses}
                  {" · "}
                  <span
                    className={
                      r.stats.runDiff > 0
                        ? "text-ps-green"
                        : r.stats.runDiff < 0
                          ? "text-ps-red"
                          : ""
                    }
                  >
                    {r.stats.runDiff > 0 ? "+" : ""}
                    {r.stats.runDiff}
                  </span>{" "}
                  <Bi es="dif." en="run diff" />
                </p>
              ) : (
                <p className="font-mono text-micro text-ps-text-ter">
                  <Bi es="Sin juegos aún" en="No games yet" />
                </p>
              )}
            </div>
            {r.stats.played > 0 && (
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-ps-text">
                {(r.stats.winPct * 1000).toFixed(0).padStart(3, "0")}
              </span>
            )}
            <span className="shrink-0 text-ps-text-ter">→</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
