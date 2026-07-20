import Link from "next/link";
import { Bi } from "@/components/ligas/Bi";

/**
 * /ligas-invernales hub — public, no auth required.
 *
 * Bilingual: LatAm Spanish / English via the locale toggle. Factual copy only.
 */

interface LeagueCard {
  slug: string;
  code: string;
  nameEs: string;
  nameEn?: string;
  countryEs: string;
  countryEn: string;
  teams: string;
  windowEs: string;
  windowEn: string;
}

const CARDS: LeagueCard[] = [
  {
    slug: "lmp",
    code: "MX",
    nameEs: "Liga Mexicana del Pacífico",
    countryEs: "México",
    countryEn: "Mexico",
    teams: "10",
    windowEs: "Oct–Ene",
    windowEn: "Oct–Jan",
  },
  {
    slug: "lvbp",
    code: "VE",
    nameEs: "Liga Venezolana de Béisbol Profesional",
    countryEs: "Venezuela",
    countryEn: "Venezuela",
    teams: "8",
    windowEs: "Oct–Ene",
    windowEn: "Oct–Jan",
  },
  {
    slug: "lidom",
    code: "DO",
    nameEs: "Liga Dominicana de Béisbol",
    countryEs: "República Dominicana",
    countryEn: "Dominican Republic",
    teams: "6",
    windowEs: "Oct–Ene",
    windowEn: "Oct–Jan",
  },
  {
    slug: "lbprc",
    code: "PR",
    nameEs: "Liga Roberto Clemente",
    countryEs: "Puerto Rico",
    countryEn: "Puerto Rico",
    teams: "6",
    windowEs: "Nov–Ene",
    windowEn: "Nov–Jan",
  },
  {
    slug: "sdc",
    code: "SdC",
    nameEs: "Serie del Caribe",
    countryEs: "Caribe",
    countryEn: "Caribbean",
    teams: "6",
    windowEs: "Feb",
    windowEn: "Feb",
  },
  {
    slug: "todas",
    code: "ALL",
    nameEs: "Todas las Ligas",
    nameEn: "All Leagues",
    countryEs: "Vista unificada",
    countryEn: "Unified view",
    teams: "5 ligas",
    windowEs: "Oct–Feb",
    windowEn: "Oct–Feb",
  },
];

export default function LigasInvernalesHub() {
  return (
    <main className="pt-8">
      {/* Hero */}
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ps-text">
          <Bi es="Tu Liga Local" en="Your Local League" />
        </h1>
      </header>

      {/* Intro */}
      <section className="mt-5 space-y-2">
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
        {CARDS.map((card) => (
          <Link
            key={card.slug}
            href={`/ligas-invernales/${card.slug}`}
            className="rounded-2xl border border-ps-border bg-ps-surface p-4 transition-all duration-150 hover:border-ps-amber active:scale-[0.98] motion-reduce:transition-none"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-ps-bg-alt px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-sec">
                {card.code}
              </span>
              <span className="font-mono text-micro text-ps-text-ter">
                <Bi es={card.windowEs} en={card.windowEn} />
              </span>
            </div>
            <h2 className="mt-3 font-display text-base font-extrabold leading-tight text-ps-text">
              <Bi es={card.nameEs} en={card.nameEn ?? card.nameEs} />
            </h2>
            <p className="mt-1 text-xs text-ps-text-ter">
              <Bi es={card.countryEs} en={card.countryEn} />
              {" · "}
              <span className="font-mono">{card.teams}</span>{" "}
              {card.slug === "todas" ? "" : <Bi es="equipos" en="teams" />}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
