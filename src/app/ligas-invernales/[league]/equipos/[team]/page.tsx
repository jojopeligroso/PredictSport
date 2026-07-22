import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/AuthRequired";
import { Bi } from "@/components/ligas/Bi";
import { Collapsible } from "@/components/ligas/Collapsible";
import { StatGrid, StatRow, type Stat } from "@/components/ligas/StatGrid";
import { ligaVars } from "@/components/ligas/theme";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueContext,
  reduceTeamEvents,
  slugifyTeam,
  LIGA_SLUGS,
  type LigaSlug,
  type TeamGame,
} from "@/lib/ligas/teams";

export const dynamic = "force-dynamic";

/**
 * /ligas-invernales/[league]/equipos/[team] — a single team's page.
 *
 * Comprehensive and results-derived: record, run production, splits, streaks
 * and head-to-head are all computed from `events`. Box-score-level stats
 * (batting/pitching lines) and lineups have no data feed for these leagues and
 * are shown as pending rather than fabricated.
 */

interface EventRow {
  id: string;
  event_name: string;
  start_time: string;
  status: string;
  result_data: Record<string, unknown> | null;
}

/** Baseball-style win percentage, e.g. .615 / 1.000. */
function pct(winPct: number): string {
  if (winPct >= 1) return "1.000";
  return winPct.toFixed(3).replace(/^0/, "");
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ league: string; team: string }>;
}) {
  const { league, team } = await params;
  if (!LIGA_SLUGS.includes(league as LigaSlug)) notFound();
  return (
    <AuthRequired>
      <TeamContent league={league} teamSlug={team} />
    </AuthRequired>
  );
}

async function TeamContent({
  league,
  teamSlug,
}: {
  league: string;
  teamSlug: string;
}) {
  const supabase = await createClient();
  const ctx = await getLeagueContext(supabase, league);
  if (!ctx) notFound();

  const teamName = ctx.teams.find((t) => slugifyTeam(t) === teamSlug);
  if (!teamName) notFound();

  const { data: eventRows } = await supabase
    .from("events")
    .select("id, event_name, start_time, status, result_data")
    .eq("tournament_id", ctx.tournamentId)
    .limit(2000);

  const { stats, recent, upcoming } = reduceTeamEvents(
    teamName,
    (eventRows ?? []) as EventRow[],
  );

  const teamHref = (opp: string) =>
    `/ligas-invernales/${league}/equipos/${slugifyTeam(opp)}`;

  const commonStats: Stat[] = [
    {
      label: <Bi es="Récord" en="Record" />,
      value: `${stats.wins}-${stats.losses}`,
      sub: stats.played > 0 ? pct(stats.winPct) : undefined,
    },
    {
      label: <Bi es="Dif. carreras" en="Run diff" />,
      value: `${stats.runDiff > 0 ? "+" : ""}${stats.runDiff}`,
      tone: stats.runDiff > 0 ? "good" : stats.runDiff < 0 ? "bad" : "default",
    },
    {
      label: <Bi es="Carreras/juego" en="Runs/game" />,
      value: stats.runsForPerGame.toFixed(1),
      sub: (
        <Bi
          es={`${stats.runsAgainstPerGame.toFixed(1)} en contra`}
          en={`${stats.runsAgainstPerGame.toFixed(1)} allowed`}
        />
      ),
    },
    {
      label: <Bi es="Racha" en="Streak" />,
      value:
        stats.streakType && stats.streakLen > 0
          ? `${stats.streakType}${stats.streakLen}`
          : "—",
      tone:
        stats.streakType === "W"
          ? "good"
          : stats.streakType === "L"
            ? "bad"
            : "default",
    },
  ];

  return (
    <main className="pt-8" style={ligaVars(league)}>
      {/* Header */}
      <header>
        <Link
          href={`/ligas-invernales/${league}/equipos`}
          className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga"
        >
          ← <Bi es="Equipos" en="Teams" />
        </Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
          {teamName}
        </h1>
        <p className="mt-1 text-sm font-semibold text-ps-text-sec">
          {ctx.tournamentName}
        </p>
      </header>

      {stats.played === 0 ? (
        <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
          <p className="text-sm font-semibold text-ps-text-sec">
            <Bi
              es="Aún no hay juegos esta temporada. Vuelve cuando arranque la acción."
              en="No games this season yet. Check back once the action starts."
            />
          </p>
        </section>
      ) : (
        <>
          {/* Common stats */}
          <section className="mt-5">
            <StatGrid stats={commonStats} />
          </section>

          {/* Last 10 */}
          {stats.last10.length > 0 && (
            <section className="mt-4 rounded-2xl border border-ps-border bg-ps-surface p-4">
              <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ps-text-sec">
                <Bi es="Últimos 10" en="Last 10" />
              </p>
              <div className="mt-2 flex gap-1.5">
                {stats.last10.map((r, i) => (
                  <span
                    key={i}
                    className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-xs font-bold ${
                      r === "W"
                        ? "bg-ps-green/15 text-ps-green"
                        : "bg-ps-red/15 text-ps-red"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Recent results */}
      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-extrabold text-ps-text">
            <Bi es="Resultados recientes" en="Recent results" />
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-ps-border bg-ps-surface">
            {recent.slice(0, 15).map((g: TeamGame, idx) => (
              <div
                key={g.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${idx > 0 ? "border-t border-ps-border" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${
                    g.won
                      ? "bg-ps-green/15 text-ps-green"
                      : "bg-ps-red/15 text-ps-red"
                  }`}
                >
                  {g.won ? "W" : "L"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ps-text">
                    <span className="text-ps-text-ter">
                      {g.isHome ? (
                        <Bi es="vs " en="vs " />
                      ) : (
                        <Bi es="en " en="@ " />
                      )}
                    </span>
                    <Link href={teamHref(g.opponent)} className="font-semibold hover:underline">
                      {g.opponent}
                    </Link>
                  </p>
                  <p className="font-mono text-micro text-ps-text-ter">
                    {new Date(g.date).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-ps-text">
                  {g.teamScore}–{g.oppScore}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-extrabold text-ps-text">
          <Bi es="Próximos juegos" en="Upcoming games" />
        </h2>
        {upcoming.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-ps-border bg-ps-surface">
            {upcoming.slice(0, 15).map((g, idx) => (
              <div
                key={g.id}
                className={`flex items-center justify-between px-3 py-2.5 ${idx > 0 ? "border-t border-ps-border" : ""}`}
              >
                <p className="truncate text-sm text-ps-text">
                  <span className="text-ps-text-ter">
                    {g.isHome ? <Bi es="vs " en="vs " /> : <Bi es="en " en="@ " />}
                  </span>
                  <Link href={teamHref(g.opponent)} className="font-semibold hover:underline">
                    {g.opponent}
                  </Link>
                </p>
                <span className="shrink-0 font-mono text-micro text-ps-text-ter">
                  {new Date(g.date).toLocaleString("es-MX", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ps-text-sec">
            <Bi
              es="Calendario por publicar."
              en="Schedule to be announced."
            />
          </p>
        )}
      </section>

      {/* Advanced stats (collapsed) */}
      {stats.played > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ps-text">
            <Bi es="Estadísticas" en="Statistics" />
          </h2>

          <Collapsible
            title={<Bi es="Avanzadas y por situación" en="Advanced & situational" />}
            hint={<Bi es="derivadas de resultados" en="results-derived" />}
          >
            <div className="divide-y divide-ps-border">
              <StatRow
                label={<Bi es="En casa" en="Home" />}
                value={`${stats.homeWins}-${stats.homeLosses}`}
              />
              <StatRow
                label={<Bi es="Visitante" en="Away" />}
                value={`${stats.awayWins}-${stats.awayLosses}`}
              />
              <StatRow
                label={<Bi es="Juegos de 1 carrera" en="1-run games" />}
                value={`${stats.oneRunWins}-${stats.oneRunLosses}`}
              />
              <StatRow
                label={<Bi es="Palizas (5+)" en="Blowouts (5+)" />}
                value={`${stats.blowoutWins}-${stats.blowoutLosses}`}
              />
              <StatRow
                label={<Bi es="Blanqueadas a favor" en="Shutouts for" />}
                value={stats.shutoutsFor}
              />
              <StatRow
                label={<Bi es="Blanqueadas en contra" en="Shutouts against" />}
                value={stats.shutoutsAgainst}
              />
              <StatRow
                label={<Bi es="Racha ganadora más larga" en="Longest win streak" />}
                value={stats.longestWinStreak}
              />
              <StatRow
                label={<Bi es="Racha perdedora más larga" en="Longest losing streak" />}
                value={stats.longestLossStreak}
              />
              <StatRow
                label={<Bi es="Carreras anotadas / permitidas" en="Runs scored / allowed" />}
                value={`${stats.runsFor} / ${stats.runsAgainst}`}
              />
            </div>
          </Collapsible>

          {stats.vsOpponent.length > 0 && (
            <Collapsible title={<Bi es="Cara a cara" en="Head-to-head" />}>
              <div className="divide-y divide-ps-border">
                {stats.vsOpponent.map((o) => (
                  <StatRow
                    key={o.opponent}
                    label={
                      <Link href={teamHref(o.opponent)} className="hover:underline">
                        {o.opponent}
                      </Link>
                    }
                    value={`${o.wins}-${o.losses}`}
                  />
                ))}
              </div>
            </Collapsible>
          )}

          <Collapsible
            title={<Bi es="Alineación y estadísticas de jugadores" en="Lineup & player stats" />}
          >
            <p className="text-sm text-ps-text-sec">
              <Bi
                es="Las ligas invernales no tienen un feed público de alineaciones ni estadísticas por jugador. Récords, carreras y rachas se calculan a partir de los resultados; las líneas de bateo y pitcheo se añadirán cuando conectemos un feed de box scores."
                en="The winter leagues have no public lineup or per-player stats feed. Records, runs and streaks are computed from game results; batting and pitching lines will appear once a box-score feed is connected."
              />
            </p>
          </Collapsible>
        </section>
      )}
    </main>
  );
}
