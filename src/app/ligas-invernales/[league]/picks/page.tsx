import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/AuthRequired";
import { Bi } from "@/components/ligas/Bi";
import { ligaVars } from "@/components/ligas/theme";
import { LigaPicksClient } from "@/components/ligas/LigaPicksClient";
import { createClient } from "@/lib/supabase/server";
import type {
  LigaPicksEvent,
  LigaPicksPrediction,
} from "@/components/ligas/LigaPicksClient";

export const dynamic = "force-dynamic";

/**
 * /ligas-invernales/[league]/picks — picks page for the winter-league open
 * competition instances. Reuses the /wc prediction machinery via
 * POST /api/predictions. Baseball rule: no draw option ever; a tied entered
 * score does not auto-derive a winner — the user must declare it.
 */

const LEAGUE_SLUGS = new Set(["lmp", "lvbp", "lidom", "lbprc", "sdc"]);

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  sport: string;
  starts_at: string | null;
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

export default async function LeaguePicksPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  if (!LEAGUE_SLUGS.has(league)) notFound();

  return (
    <AuthRequired>
      <PicksContent league={league} />
    </AuthRequired>
  );
}

async function PicksContent({ league }: { league: string }) {
  const supabase = await createClient();

  const { data: tournament } = (await supabase
    .from("sporting_tournaments")
    .select("id, slug, name, sport, starts_at")
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

  const header = (
    <header>
      <Link
        href={`/ligas-invernales/${league}`}
        className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga"
      >
        ← {tournament.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
        <Bi es="Picks" en="Picks" />
      </h1>
    </header>
  );

  if (!instance) {
    return (
      <main className="pt-8" style={ligaVars(league)}>
        {header}
        <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
          <p className="text-sm font-semibold text-ps-text-sec">
            <Bi es="Aún no hay competencia" en="No competition yet" />
          </p>
        </section>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from("competition_members")
        .select("id")
        .eq("competition_id", instance.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: eventRows } = await supabase
    .from("events")
    .select(
      "id, event_name, sport, start_time, lock_time, status, event_prediction_types (id, event_id, prediction_type, points, partial_points, config)",
    )
    .eq("competition_id", instance.id)
    .eq("status", "upcoming")
    .order("start_time", { ascending: true })
    .limit(50);

  const events = (eventRows ?? []) as unknown as LigaPicksEvent[];
  const eventIds = events.map((e) => e.id);

  let predictions: LigaPicksPrediction[] = [];
  if (user && eventIds.length > 0) {
    const { data: predictionRows } = await supabase
      .from("predictions")
      .select("id, event_id, prediction_type, prediction_data")
      .eq("user_id", user.id)
      .in("event_id", eventIds)
      .limit(200);
    predictions = (predictionRows ?? []) as LigaPicksPrediction[];
  }

  return (
    <main className="pt-8" style={ligaVars(league)}>
      {header}
      <LigaPicksClient
        competitionId={instance.id}
        instanceMember={Boolean(membership)}
        events={events}
        predictions={predictions}
        seasonStartEs={`La temporada comienza el ${formatDate(tournament.starts_at, "es-MX")}`}
        seasonStartEn={`Season starts ${formatDate(tournament.starts_at, "en-US")}`}
      />
    </main>
  );
}
