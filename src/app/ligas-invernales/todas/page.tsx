import Link from "next/link";
import { AuthRequired } from "@/components/AuthRequired";
import { Bi } from "@/components/ligas/Bi";
import { LEAGUE_BY_SLUG } from "@/components/ligas/leagues";
import { LeagueIdentity } from "@/components/ligas/LeagueLogo";
import { ligaVars } from "@/components/ligas/theme";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /ligas-invernales/todas — unified superfan view. Auth required.
 *
 * All 5 winter-league blueprints in one combined view with an Oct→Feb
 * activity timeline. League metadata comes from the shared leagues module.
 */

const MONTHS: { es: string; en: string }[] = [
  { es: "Oct", en: "Oct" },
  { es: "Nov", en: "Nov" },
  { es: "Dic", en: "Dec" },
  { es: "Ene", en: "Jan" },
  { es: "Feb", en: "Feb" },
];

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
}

/** Map a date to a column index on the Oct→Feb timeline (0..4). */
function monthIndex(iso: string | null, fallback: number): number {
  if (!iso) return fallback;
  const m = new Date(iso).getUTCMonth() + 1; // 1..12
  const map: Record<number, number> = { 10: 0, 11: 1, 12: 2, 1: 3, 2: 4 };
  return map[m] ?? fallback;
}

function leaguePrefix(slug: string): string {
  return slug.split("-")[0];
}

function formatWindow(
  starts: string | null,
  ends: string | null,
  locale: "es-MX" | "en-US"
): string {
  if (!starts || !ends) return "—";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: "short", year: "numeric" });
  return `${fmt(starts)} – ${fmt(ends)}`;
}

export default function TodasPage() {
  return (
    <AuthRequired>
      <TodasContent />
    </AuthRequired>
  );
}

async function TodasContent() {
  const supabase = await createClient();

  const { data: tournaments } = (await supabase
    .from("sporting_tournaments")
    .select("id, slug, name, starts_at, ends_at")
    .or(
      "slug.like.lmp-%,slug.like.lvbp-%,slug.like.lidom-%,slug.like.lbprc-%,slug.like.sdc-%"
    )
    .order("starts_at", { ascending: true })
    .limit(10)) as { data: TournamentRow[] | null };

  const rows = tournaments ?? [];
  const ids = rows.map((t) => t.id);

  const { data: stages } = await supabase
    .from("sporting_stages")
    .select("id, tournament_id")
    .in("tournament_id", ids)
    .limit(100);

  const stageCounts = new Map<string, number>();
  for (const s of stages ?? []) {
    stageCounts.set(
      s.tournament_id,
      (stageCounts.get(s.tournament_id) ?? 0) + 1
    );
  }

  return (
    <main className="pt-6">
      {/* Back link */}
      <Link
        href="/ligas-invernales"
        className="inline-flex items-center gap-1 font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-ter transition-colors hover:text-ps-text-sec"
      >
        <span aria-hidden>←</span>
        <Bi es="Ligas" en="Leagues" />
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ps-text">
          <Bi es="Todas las Ligas" en="All Leagues" />
        </h1>
      </header>

      {/* Combined timeline */}
      <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
        <h2 className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-ps-text-sec">
          <Bi es="Calendario Oct → Feb" en="Oct → Feb Calendar" />
        </h2>
        <div className="mt-3 grid grid-cols-5 gap-y-2">
          {MONTHS.map((m) => (
            <span
              key={m.es}
              className="text-center font-mono text-micro font-bold uppercase text-ps-text-ter"
            >
              <Bi es={m.es} en={m.en} />
            </span>
          ))}
          {rows.map((t) => {
            const prefix = leaguePrefix(t.slug);
            const meta = LEAGUE_BY_SLUG[prefix];
            const start = monthIndex(t.starts_at, 0);
            const end = monthIndex(t.ends_at, 4);
            return (
              <div
                key={t.id}
                className="col-span-5 grid grid-cols-5"
                style={ligaVars(prefix)}
              >
                <div
                  className="flex h-6 items-center justify-center rounded-md bg-liga/20"
                  style={{
                    gridColumnStart: start + 1,
                    gridColumnEnd: end + 2,
                  }}
                >
                  <span className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga">
                    {meta?.code ?? prefix}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* League rows */}
      <section className="mt-5 space-y-3">
        {rows.map((t) => {
          const prefix = leaguePrefix(t.slug);
          const meta = LEAGUE_BY_SLUG[prefix];
          return (
            <Link
              key={t.id}
              href={`/ligas-invernales/${prefix}`}
              style={ligaVars(prefix)}
              className="flex items-center gap-3 rounded-2xl border border-ps-border bg-ps-surface p-4 transition-all duration-150 hover:border-liga active:scale-[0.98] motion-reduce:transition-none"
            >
              <LeagueIdentity slug={prefix} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-liga/15 px-1.5 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.1em] text-liga-deep dark:text-liga">
                    {meta?.code ?? prefix}
                  </span>
                  <span className="ml-auto font-mono text-micro text-ps-text-ter">
                    {stageCounts.get(t.id) ?? 0} <Bi es="etapas" en="stages" />
                  </span>
                </div>
                <h3 className="mt-1.5 truncate font-display text-base font-extrabold leading-tight text-ps-text">
                  {t.name}
                </h3>
                <p className="mt-0.5 truncate text-xs text-ps-text-ter">
                  {meta && <Bi es={meta.countryEs} en={meta.countryEn} />}
                  {" · "}
                  <span className="font-mono">
                    <Bi
                      es={formatWindow(t.starts_at, t.ends_at, "es-MX")}
                      en={formatWindow(t.starts_at, t.ends_at, "en-US")}
                    />
                  </span>
                </p>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <p className="text-sm text-ps-text-sec">
            <Bi
              es="No hay ligas disponibles todavía."
              en="No leagues available yet."
            />
          </p>
        )}
      </section>
    </main>
  );
}
