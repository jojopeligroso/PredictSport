import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/AuthRequired";
import { Bi } from "@/components/ligas/Bi";
import { ligaVars } from "@/components/ligas/theme";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /ligas-invernales/[league] — single-league blueprint view. Auth required.
 *
 * Renders the competitive arc (stages), team roster and season dates from the
 * tournament blueprint in Supabase.
 */

const LEAGUES: Record<
  string,
  { countryEs: string; countryEn: string; code: string }
> = {
  lmp: { countryEs: "México", countryEn: "Mexico", code: "MX" },
  lvbp: { countryEs: "Venezuela", countryEn: "Venezuela", code: "VE" },
  lidom: {
    countryEs: "República Dominicana",
    countryEn: "Dominican Republic",
    code: "DO",
  },
  lbprc: { countryEs: "Puerto Rico", countryEn: "Puerto Rico", code: "PR" },
  sdc: { countryEs: "Caribe", countryEn: "Caribbean", code: "SdC" },
};

interface StageRow {
  id: string;
  slug: string;
  name: string;
  stage_order: number;
  stage_type: string;
  config: Record<string, unknown> | null;
}

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  sport: string;
  template_key: string;
  config: Record<string, unknown> | null;
  starts_at: string | null;
  ends_at: string | null;
}

function formatDate(iso: string | null, locale: "es-MX" | "en-US"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function seasonLabel(slug: string): string {
  // "lmp-2025-26" -> "2025-26"; "sdc-2027" -> "2027"
  const match = slug.match(/-(\d{4}(-\d{2})?)$/);
  return match?.[1] ?? "";
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  if (!(league in LEAGUES)) notFound();

  return (
    <AuthRequired>
      <LeagueContent league={league} />
    </AuthRequired>
  );
}

async function LeagueContent({ league }: { league: string }) {
  const meta = LEAGUES[league];
  const supabase = await createClient();

  const { data: tournament } = (await supabase
    .from("sporting_tournaments")
    .select("id, slug, name, sport, template_key, config, starts_at, ends_at")
    .like("slug", `${league}-%`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: TournamentRow | null };

  if (!tournament) notFound();

  const [{ data: stages }, { data: bracketTemplate }] = await Promise.all([
    supabase
      .from("sporting_stages")
      .select("id, slug, name, stage_order, stage_type, config")
      .eq("tournament_id", tournament.id)
      .order("stage_order", { ascending: true })
      .limit(20),
    supabase
      .from("bracket_templates")
      .select("config")
      .eq("template_key", tournament.template_key)
      .limit(1)
      .maybeSingle(),
  ]);

  const stageRows = (stages ?? []) as StageRow[];
  const teams =
    ((bracketTemplate?.config as Record<string, unknown> | null)?.[
      "leagueTeams"
    ] as string[] | undefined) ?? [];
  const teamComposition = tournament.config?.["team_composition"] as
    | string
    | undefined;

  const season = seasonLabel(tournament.slug);

  return (
    <main className="pt-8" style={ligaVars(league)}>
      {/* League header */}
      <header>
        <span className="rounded-md bg-liga/15 px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga">
          {meta.code}
        </span>
        <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
          {tournament.name}
        </h1>
        <p className="mt-1 text-sm font-semibold text-ps-text-sec">
          <Bi es={meta.countryEs} en={meta.countryEn} />
          {" · "}
          <Bi es="Béisbol" en="Baseball" />
        </p>
      </header>

      {/* Caribbean Series — champions-of-champions intro */}
      {league === "sdc" && (
        <section className="mt-5 rounded-2xl border border-liga/40 bg-liga/5 p-4">
          <p className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-liga-deep dark:text-liga">
            <Bi es="La final del Caribe" en="The Caribbean final" />
          </p>
          <p className="mt-2 text-sm text-ps-text-sec">
            <Bi
              es="Los campeones de México, Venezuela, República Dominicana y Puerto Rico se enfrentan en febrero. Los equipos se confirman cuando cada liga corona a su campeón."
              en="The champions of Mexico, Venezuela, the Dominican Republic and Puerto Rico meet in February. Teams are confirmed once each league crowns its winner."
            />
          </p>
        </section>
      )}

      {/* Pre-season state */}
      <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <p className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-liga-deep dark:text-liga">
          <Bi es={`Temporada ${season}`} en={`${season} Season`} />
        </p>
        <p className="mt-1 font-mono text-sm text-ps-text">
          <Bi
            es={`${formatDate(tournament.starts_at, "es-MX")} – ${formatDate(tournament.ends_at, "es-MX")}`}
            en={`${formatDate(tournament.starts_at, "en-US")} – ${formatDate(tournament.ends_at, "en-US")}`}
          />
        </p>
      </section>

      {/* Picks CTA */}
      <Link
        href={`/ligas-invernales/${league}/picks`}
        className="mt-4 block rounded-xl bg-liga px-4 py-3 text-center font-display text-sm font-extrabold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:transition-none"
      >
        <Bi es="Hacer mis picks" en="Make my picks" />
      </Link>

      {/* Competitive arc */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-extrabold text-ps-text">
          <Bi es="Formato" en="Format" />
        </h2>
        <ol className="mt-3 space-y-2">
          {stageRows.map((stage) => {
            const dateRange = stage.config?.["date_range"] as
              | [string, string]
              | undefined;
            return (
              <li
                key={stage.id}
                className="flex items-center gap-3 rounded-xl border border-ps-border bg-ps-surface px-3 py-2.5"
              >
                <span className="w-5 shrink-0 text-center font-mono text-sm font-bold text-ps-text-ter">
                  {stage.stage_order}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ps-text">
                    {stage.name}
                  </p>
                  {dateRange && (
                    <p className="font-mono text-micro text-ps-text-ter">
                      {dateRange[0]} → {dateRange[1]}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.12em] ${
                    stage.stage_type === "group"
                      ? "bg-ps-bg-alt text-ps-text-sec"
                      : "bg-liga/15 text-liga-deep dark:text-liga"
                  }`}
                >
                  {stage.stage_type}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Team roster */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-extrabold text-ps-text">
          <Bi es="Equipos" en="Teams" />
        </h2>
        {teams.length > 0 ? (
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {teams.map((team) => (
              <li
                key={team}
                className="rounded-lg border border-ps-border bg-ps-surface px-3 py-2 text-sm font-semibold text-ps-text"
              >
                {team}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ps-text-sec">
            {teamComposition ?? (
              <Bi es="Equipos por confirmar" en="Teams to be confirmed" />
            )}
          </p>
        )}
      </section>
    </main>
  );
}
