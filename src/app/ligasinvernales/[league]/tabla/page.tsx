import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/AuthRequired";
import { Bi } from "@/components/ligas/Bi";
import { isLeagueSlug } from "@/components/ligas/leagues";
import { LeagueIdentity } from "@/components/ligas/LeagueLogo";
import { ligaVars } from "@/components/ligas/theme";
import {
  getClassificationStandings,
  getClassificationsForCompetition,
} from "@/lib/tournament/classification-engine";
import { createClient } from "@/lib/supabase/server";
import type { StandingRow } from "@/types/tournament";

export const dynamic = "force-dynamic";

/**
 * /ligasinvernales/[league]/tabla — participant standings for the league's
 * open prediction instance. Auth required.
 *
 * Reuses the tournament classification engine (same points source as /wc):
 * live-provisional standings summed from scored `predictions`. This is the
 * "rank" end of the predict → score → rank loop.
 */

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
}

export default async function LeagueTablaPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  if (!isLeagueSlug(league)) notFound();

  return (
    <AuthRequired>
      <TablaContent league={league} />
    </AuthRequired>
  );
}

async function TablaContent({ league }: { league: string }) {
  const supabase = await createClient();

  // Same tournament + open-instance resolution the picks page uses.
  const { data: tournament } = (await supabase
    .from("sporting_tournaments")
    .select("id, slug, name")
    .like("slug", `${league}-%`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: TournamentRow | null };

  if (!tournament) notFound();

  const { data: instance } = (await supabase
    .from("competitions")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("type", "open")
    .eq("status", "active")
    .eq("product_mode", "predictsport_full")
    .order("instance_number", { ascending: true })
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const header = (
    <header>
      <Link
        href={`/ligasinvernales/${league}`}
        className="inline-flex items-center gap-1 font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-ter transition-colors hover:text-ps-text-sec"
      >
        <span aria-hidden>←</span> {tournament.name}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <LeagueIdentity slug={league} size={44} />
        <h1 className="font-liga text-3xl font-bold uppercase leading-none tracking-tight text-ps-text">
          <Bi es="Tabla" en="Standings" />
        </h1>
      </div>
    </header>
  );

  // Resolve the "overall" leaderboard classification for this instance.
  let standings: StandingRow[] = [];
  if (instance) {
    const classifications = await getClassificationsForCompetition(
      supabase,
      instance.id,
    );
    const overall =
      classifications.find((c) => c.classification_type === "leaderboard") ??
      classifications.find((c) => c.classification_key === "overall") ??
      classifications[0];

    if (overall) {
      try {
        standings = await getClassificationStandings(supabase, overall.id, {
          provisional: true,
        });
      } catch {
        standings = [];
      }
    }
  }

  return (
    <main className="pt-6" style={ligaVars(league)}>
      {header}

      {standings.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
          <p className="text-sm font-semibold text-ps-text-sec">
            <Bi
              es="La tabla aparecerá cuando se jueguen los primeros partidos."
              en="Standings appear once the first games are played."
            />
          </p>
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-2xl border border-ps-border bg-ps-surface">
          {/* Column header */}
          <div className="flex items-center gap-3 border-b border-ps-border px-4 py-2.5">
            <span className="w-6 text-center font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-ter">
              #
            </span>
            <span className="flex-1 font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-ter">
              <Bi es="Participante" en="Player" />
            </span>
            <span className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ps-text-ter">
              <Bi es="Pts" en="Pts" />
            </span>
          </div>

          <ol>
            {standings.map((row) => {
              const isYou = row.user_id === user?.id;
              return (
                <li
                  key={row.user_id}
                  className={`flex items-center gap-3 border-b border-ps-border px-4 py-3 last:border-b-0 ${
                    isYou ? "bg-liga/10" : ""
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-micro font-bold ${
                      row.rank <= 3
                        ? "bg-liga/20 text-liga-deep dark:text-liga"
                        : "text-ps-text-ter"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ps-text">
                    {row.display_name}
                    {isYou && (
                      <span className="ml-1.5 font-mono text-micro font-bold uppercase tracking-[0.1em] text-liga-deep dark:text-liga">
                        <Bi es="tú" en="you" />
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-ps-text">
                    {row.points}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}
