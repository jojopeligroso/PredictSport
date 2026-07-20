import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/AuthRequired";
import { hundredVars } from "@/components/hundred/theme";
import { HundredPicksClient } from "@/components/hundred/HundredPicksClient";
import { createClient } from "@/lib/supabase/server";
import type {
  HundredPicksEvent,
  HundredPicksPrediction,
} from "@/components/hundred/HundredPicksClient";

export const dynamic = "force-dynamic";

/**
 * /hundred/[edition]/picks — picks page for The Hundred open competition
 * instances (edition: mens | womens — two separate blueprints). Reuses the
 * /wc prediction machinery via POST /api/predictions. Winner-only picks —
 * The Hundred has no draws (super over decides).
 */

const EDITION_SLUGS: Record<string, string> = {
  mens: "the-hundred-mens-2026",
  womens: "the-hundred-womens-2026",
};

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  starts_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function EditionPicksPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  if (!(edition in EDITION_SLUGS)) notFound();

  return (
    <AuthRequired>
      <PicksContent edition={edition} />
    </AuthRequired>
  );
}

async function PicksContent({ edition }: { edition: string }) {
  const supabase = await createClient();

  const { data: tournament } = (await supabase
    .from("sporting_tournaments")
    .select("id, slug, name, starts_at")
    .eq("slug", EDITION_SLUGS[edition])
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
        href="/hundred"
        className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga"
      >
        ← {tournament.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
        Picks
      </h1>
    </header>
  );

  if (!instance) {
    return (
      <main className="pt-8" style={hundredVars()}>
        {header}
        <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
          <p className="text-sm font-semibold text-ps-text-sec">
            No competition yet
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

  const events = (eventRows ?? []) as unknown as HundredPicksEvent[];
  const eventIds = events.map((e) => e.id);

  let predictions: HundredPicksPrediction[] = [];
  if (user && eventIds.length > 0) {
    const { data: predictionRows } = await supabase
      .from("predictions")
      .select("id, event_id, prediction_type, prediction_data")
      .eq("user_id", user.id)
      .in("event_id", eventIds)
      .limit(200);
    predictions = (predictionRows ?? []) as HundredPicksPrediction[];
  }

  return (
    <main className="pt-8" style={hundredVars()}>
      {header}
      <HundredPicksClient
        competitionId={instance.id}
        instanceMember={Boolean(membership)}
        events={events}
        predictions={predictions}
        seasonStart={`Season starts ${formatDate(tournament.starts_at)}`}
      />
    </main>
  );
}
