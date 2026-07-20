import Link from "next/link";
import { hundredVars } from "@/components/hundred/theme";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /hundred — hub for The Hundred 2026. Public (no auth).
 *
 * Two separate real-world competitions (men's and women's), each its own
 * tournament blueprint. Renders season dates, the competitive arc (stages)
 * and the 8 franchises from the blueprints in Supabase.
 */

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  template_key: string;
  config: Record<string, unknown> | null;
  starts_at: string | null;
  ends_at: string | null;
}

interface StageRow {
  id: string;
  name: string;
  stage_order: number;
  stage_type: string;
  config: Record<string, unknown> | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function HundredHubPage() {
  const supabase = await createClient();

  const { data: tournamentRows } = await supabase
    .from("sporting_tournaments")
    .select("id, slug, name, template_key, config, starts_at, ends_at")
    .in("slug", ["the-hundred-mens-2026", "the-hundred-womens-2026"])
    .limit(2);

  const tournaments = (tournamentRows ?? []) as TournamentRow[];
  const mens = tournaments.find((t) => t.slug === "the-hundred-mens-2026");
  const womens = tournaments.find((t) => t.slug === "the-hundred-womens-2026");

  // Both editions share the same stage shape and dates — render from men's.
  const [{ data: stageRows }, { data: bracketTemplate }] = await Promise.all([
    mens
      ? supabase
          .from("sporting_stages")
          .select("id, name, stage_order, stage_type, config")
          .eq("tournament_id", mens.id)
          .order("stage_order", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: null }),
    mens
      ? supabase
          .from("bracket_templates")
          .select("config")
          .eq("template_key", mens.template_key)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const stages = (stageRows ?? []) as StageRow[];
  const teams =
    ((bracketTemplate?.config as Record<string, unknown> | null)?.[
      "leagueTeams"
    ] as string[] | undefined) ?? [];

  const editions = [
    { key: "mens", label: "Men's", tournament: mens },
    { key: "womens", label: "Women's", tournament: womens },
  ].filter((e) => e.tournament);

  return (
    <main className="pt-8" style={hundredVars()}>
      <header>
        <span className="rounded-md bg-liga/15 px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga">
          ENG
        </span>
        <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
          The Hundred 2026
        </h1>
        <p className="mt-1 text-sm font-semibold text-ps-text-sec">
          England &amp; Wales · Cricket · 100-ball
        </p>
      </header>

      {/* Editions */}
      <section className="mt-5 space-y-3">
        {editions.map(({ key, label, tournament }) => (
          <article
            key={key}
            className="rounded-2xl border border-ps-border bg-ps-surface p-4"
          >
            <p className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-liga-deep dark:text-liga">
              {label} competition
            </p>
            <p className="mt-1 font-mono text-sm text-ps-text">
              {formatDate(tournament!.starts_at)} –{" "}
              {formatDate(tournament!.ends_at)}
            </p>
            <Link
              href={`/hundred/${key}/picks`}
              className="mt-3 block rounded-xl bg-liga px-4 py-3 text-center font-display text-sm font-extrabold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:transition-none"
            >
              Make my picks
            </Link>
          </article>
        ))}
      </section>

      {/* Competitive arc (identical shape for both editions) */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-extrabold text-ps-text">
          Format
        </h2>
        <ol className="mt-3 space-y-2">
          {stages.map((stage) => {
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

      {/* Franchises */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-extrabold text-ps-text">
          Teams
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
          <p className="mt-3 text-sm text-ps-text-sec">Teams to be confirmed</p>
        )}
      </section>
    </main>
  );
}
