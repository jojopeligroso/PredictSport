import Link from "next/link";
import { Bi } from "@/components/ligas/Bi";
import { LEAGUES } from "@/components/ligas/leagues";
import { LeagueIdentity } from "@/components/ligas/LeagueLogo";
import { ligaVars } from "@/components/ligas/theme";

/**
 * /ligasinvernales hub — public, no auth required.
 *
 * Bilingual: LatAm Spanish / English via the locale toggle. Factual copy only.
 * League metadata comes from the shared leagues module; each card carries the
 * league's own identity (official logo when supplied, else house mark) and
 * national flag, tinted with the league accent.
 */

export default function LigasInvernalesHub() {
  // The four national leagues, the Serie del Caribe, then the unified view.
  const nationalLeagues = LEAGUES.filter((l) => l.slug !== "sdc");
  const serieDelCaribe = LEAGUES.find((l) => l.slug === "sdc")!;

  return (
    <main className="pt-8">
      {/* Hero */}
      <header>
        <p className="font-mono text-micro font-bold uppercase tracking-[0.2em] text-ps-text-ter">
          <Bi es="Béisbol Invernal" en="Winter Baseball" />
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ps-text">
          <Bi es="Tu Liga Local" en="Your Local League" />
        </h1>
      </header>

      {/* Intro */}
      <section className="mt-4 space-y-2">
        <p className="text-sm text-ps-text-sec">
          <Bi
            es="El béisbol invernal del Caribe: las ligas profesionales de México, Venezuela, República Dominicana y Puerto Rico juegan de octubre a enero, y sus campeones se enfrentan en la Serie del Caribe en febrero."
            en="Caribbean winter baseball: the professional leagues of Mexico, Venezuela, the Dominican Republic and Puerto Rico run from October to January, and their champions meet at the Serie del Caribe in February."
          />
        </p>
        <p className="text-sm text-ps-text-sec">
          <Bi
            es="Elige tu liga y predice los resultados."
            en="Pick your league and predict the results."
          />
        </p>
      </section>

      {/* League cards */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {nationalLeagues.map((league) => (
          <Link
            key={league.slug}
            href={`/ligasinvernales/${league.slug}`}
            style={ligaVars(league.slug)}
            className="group rounded-2xl border border-ps-border bg-ps-surface p-4 transition-all duration-150 hover:border-liga hover:shadow-sm active:scale-[0.98] motion-reduce:transition-none"
          >
            <div className="flex items-start justify-between gap-3">
              <LeagueIdentity slug={league.slug} size={48} />
              <span className="font-mono text-micro text-ps-text-ter">
                <Bi es={league.windowEs} en={league.windowEn} />
              </span>
            </div>
            <h2 className="mt-3 font-liga text-lg font-bold uppercase leading-[1.05] tracking-tight text-ps-text">
              <Bi es={league.nameEs} en={league.nameEn} />
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ps-text-ter">
              <span className="rounded bg-liga/15 px-1.5 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.1em] text-liga-deep dark:text-liga">
                {league.code}
              </span>
              <Bi es={league.countryEs} en={league.countryEn} />
              {league.teams != null && (
                <>
                  {" · "}
                  <span className="font-mono">{league.teams}</span>{" "}
                  <Bi es="equipos" en="teams" />
                </>
              )}
            </p>
          </Link>
        ))}
      </section>

      {/* Serie del Caribe — the championship, given its own emphasis */}
      <section className="mt-3">
        <Link
          href={`/ligasinvernales/${serieDelCaribe.slug}`}
          style={ligaVars(serieDelCaribe.slug)}
          className="group flex items-center gap-4 rounded-2xl border border-liga/40 bg-liga/[0.06] p-4 transition-all duration-150 hover:border-liga active:scale-[0.99] motion-reduce:transition-none"
        >
          <LeagueIdentity slug={serieDelCaribe.slug} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-liga-deep dark:text-liga">
              <Bi es="La Final del Caribe" en="The Caribbean Final" />
            </p>
            <h2 className="mt-0.5 font-liga text-2xl font-normal uppercase leading-none tracking-wide text-ps-text">
              <Bi es={serieDelCaribe.nameEs} en={serieDelCaribe.nameEn} />
            </h2>
            <p className="mt-0.5 text-xs text-ps-text-ter">
              <Bi es={serieDelCaribe.countryEs} en={serieDelCaribe.countryEn} />
              {" · "}
              <span className="font-mono">
                <Bi es={serieDelCaribe.windowEs} en={serieDelCaribe.windowEn} />
              </span>
            </p>
          </div>
        </Link>
      </section>

      {/* Unified view */}
      <section className="mt-3">
        <Link
          href="/ligasinvernales/todas"
          className="flex items-center justify-between rounded-2xl border border-dashed border-ps-border bg-ps-surface px-4 py-3 transition-all duration-150 hover:border-ps-text-ter active:scale-[0.99] motion-reduce:transition-none"
        >
          <div>
            <h2 className="font-display text-sm font-extrabold text-ps-text">
              <Bi es="Todas las Ligas" en="All Leagues" />
            </h2>
            <p className="text-xs text-ps-text-ter">
              <Bi es="Vista unificada · Oct–Feb" en="Unified view · Oct–Feb" />
            </p>
          </div>
          <span aria-hidden className="font-mono text-lg text-ps-text-ter">
            →
          </span>
        </Link>
      </section>
    </main>
  );
}
