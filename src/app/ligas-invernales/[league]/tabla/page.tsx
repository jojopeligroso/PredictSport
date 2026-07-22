import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/AuthRequired";
import { Bi } from "@/components/ligas/Bi";
import { ligaVars, LEAGUE_THEMES } from "@/components/ligas/theme";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * /ligas-invernales/[league]/tabla — per-instance leaderboard.
 *
 * Standings are the sum of `points_awarded` across every scored prediction in
 * the league's open instance. Aggregation uses the service client so the total
 * is complete regardless of per-pick RLS visibility — only points, name and
 * rank are surfaced (never other entrants' picks).
 */

interface TournamentRow {
  id: string;
  slug: string;
  name: string;
}

interface StandingRow {
  user_id: string;
  display_name: string;
  points: number;
  correct: number;
  resolved: number;
}

export default async function TablaPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  if (!(league in LEAGUE_THEMES)) notFound();
  return (
    <AuthRequired>
      <TablaContent league={league} />
    </AuthRequired>
  );
}

async function TablaContent({ league }: { league: string }) {
  const supabase = await createClient();

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
        href={`/ligas-invernales/${league}`}
        className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-liga-deep dark:text-liga"
      >
        ← {tournament.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ps-text">
        <Bi es="Tabla" en="Leaderboard" />
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

  // Aggregate standings with the service client (complete totals, points-only).
  const svc = createServiceClient();

  const [{ data: members }, { data: preds }] = await Promise.all([
    svc
      .from("competition_members")
      .select("user_id, users ( display_name )")
      .eq("competition_id", instance.id)
      .limit(500),
    svc
      .from("predictions")
      .select("user_id, points_awarded, is_correct")
      .eq("competition_id", instance.id)
      .limit(20000),
  ]);

  // Seed every member at zero so newcomers appear before their first result.
  const byUser = new Map<string, StandingRow>();
  for (const m of (members ?? []) as Array<{
    user_id: string;
    users: { display_name: string } | { display_name: string }[] | null;
  }>) {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    byUser.set(m.user_id, {
      user_id: m.user_id,
      display_name: u?.display_name ?? "—",
      points: 0,
      correct: 0,
      resolved: 0,
    });
  }

  for (const p of (preds ?? []) as Array<{
    user_id: string;
    points_awarded: number | null;
    is_correct: boolean | null;
  }>) {
    const row = byUser.get(p.user_id);
    if (!row) continue;
    if (p.is_correct === null) continue; // unresolved
    row.resolved += 1;
    row.points += p.points_awarded ?? 0;
    if (p.is_correct) row.correct += 1;
  }

  const standings = Array.from(byUser.values()).sort(
    (a, b) => b.points - a.points || b.correct - a.correct,
  );

  return (
    <main className="pt-8" style={ligaVars(league)}>
      {header}

      <p className="mt-2 font-mono text-micro text-ps-text-ter">
        <Bi
          es={`${standings.length} participantes`}
          en={`${standings.length} entrants`}
        />
      </p>

      {standings.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-ps-border bg-ps-surface p-4">
          <p className="text-sm font-semibold text-ps-text-sec">
            <Bi
              es="Nadie se ha unido todavía. Sé el primero."
              en="No one has joined yet. Be the first."
            />
          </p>
        </section>
      ) : (
        <section className="mt-4 overflow-hidden rounded-2xl border border-ps-border bg-ps-surface">
          {standings.map((row, idx) => {
            const isMe = user?.id === row.user_id;
            return (
              <div
                key={row.user_id}
                className={[
                  "flex items-center gap-3 px-3 py-2.5",
                  idx > 0 ? "border-t border-ps-border" : "",
                  isMe ? "bg-liga/10" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-6 shrink-0 text-center font-mono text-sm font-bold tabular-nums",
                    idx < 3 ? "text-liga-deep dark:text-liga" : "text-ps-text-ter",
                  ].join(" ")}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ps-text">
                    {row.display_name}
                    {isMe && (
                      <span className="ml-1.5 font-mono text-micro text-liga-deep dark:text-liga">
                        <Bi es="tú" en="you" />
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-micro text-ps-text-ter">
                    {row.correct}/{row.resolved}{" "}
                    <Bi es="aciertos" en="correct" />
                  </p>
                </div>
                <span className="shrink-0 font-mono text-base font-bold tabular-nums text-ps-text">
                  {row.points}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
