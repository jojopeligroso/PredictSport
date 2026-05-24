import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import JoinCompetitionCard from "@/components/JoinCompetitionCard";
import { OrDivider } from "@/components/OrDivider";
import { PersonalPredictionsLink } from "@/components/PersonalPredictionsLink";

export const dynamic = "force-dynamic";

const WC2026_TOURNAMENT_ID = "a0000000-0000-0000-0000-000000000026";

// ── Landing page (unauthenticated) ──────────────────────────────────────────

function LandingPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4">
      <section className="flex w-full max-w-md flex-col items-center gap-8 pt-16 pb-12 text-center md:pt-24 md:pb-16">
        <BrandMark className="h-20 w-auto md:h-28" />
        <div>
          <h1 className="text-4xl font-extrabold lowercase tracking-tight text-ps-text md:text-5xl">
            sports<span className="text-ps-amber">predict.</span>
          </h1>
          <p className="mt-3 font-serif text-lg italic text-ps-text-sec md:text-xl">
            Call it, then rub it in Gerry Ramos' face.
          </p>
        </div>
        <Link
          href="/login"
          className="w-full max-w-xs rounded-xl bg-ps-text px-6 py-4 text-center text-base font-semibold text-ps-bg transition-all duration-150 hover:opacity-90 active:scale-[0.97] md:text-lg"
        >
          Get started
        </Link>
      </section>

      {/* World Cup 2026 promo */}
      <section className="w-full max-w-md pb-6">
        <Link
          href="/wc"
          className="block rounded-2xl p-5 transition-all active:scale-[0.98]"
          style={{ background: "#0a0f0a", color: "#f1ece2" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#006847" }}
          >
            Coming June 2026
          </p>
          <h2 className="mt-1 text-lg font-extrabold">World Cup</h2>
          <p className="mt-1 text-xs" style={{ color: "#a8a090" }}>
            Predict every match. 5 ways to compete. Bragging rights guaranteed.
          </p>
          <span
            className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "#d4af37", color: "#0a0f0a" }}
          >
            Learn more
          </span>
        </Link>
      </section>

      <section className="w-full max-w-md border-t border-ps-border pt-10 pb-12">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-ps-text-ter">
          How it works
        </h2>
        <div className="mt-8 space-y-8">
          <Step number="1" title="Join a group" description="Your mate sends a link. You're in. No downloads, no sign-up forms — just Google log in and go." />
          <Step number="2" title="Make your picks" description="Each round has a mix of fixtures across sports. Pick your winners before the deadline locks." />
          <Step number="3" title="Climb the table" description="Points land as results come in. See where you stand, who called it, and who got it very wrong." />
        </div>
      </section>

      <section className="w-full max-w-md border-t border-ps-border pt-10 pb-14">
        <div className="rounded-2xl border border-ps-border bg-ps-surface p-6">
          <p className="text-sm font-medium leading-relaxed text-ps-text">
            For friend groups, not sportsbooks.{" "}
            <span className="text-ps-text-sec">
              Just the cold, crisp satisfaction of being right.
            </span>
          </p>
        </div>
      </section>

      <section className="w-full max-w-md pb-16 text-center">
        <Link
          href="/login"
          className="inline-block rounded-xl bg-ps-text px-8 py-3.5 text-sm font-semibold text-ps-bg transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
        >
          Get started
        </Link>
        <p className="mt-4 text-xs text-ps-text-ter">
          Free. No app store required.
        </p>
      </section>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ps-text text-sm font-bold text-ps-bg">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-bold text-ps-text">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ps-text-sec">{description}</p>
      </div>
    </div>
  );
}

// ── Dashboard (authenticated) ───────────────────────────────────────────────

interface CompetitionRow {
  competition_id: string;
  role: string;
  competitions: {
    id: string;
    name: string;
    status: string;
  } | null;
}

interface RoundRow {
  id: string;
  competition_id: string;
  name: string;
  round_number: number;
  status: string;
}

async function Dashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  // Fetch competitions
  const { data: memberships } = await supabase
    .from("competition_members")
    .select("competition_id, role, competitions(id, name, status)")
    .eq("user_id", userId);

  const comps = ((memberships ?? []) as unknown as CompetitionRow[])
    .map((m) => m.competitions)
    .filter((c): c is NonNullable<typeof c> => c !== null && c.status === "active");

  // Check for visible WC competition
  const { data: wcComp } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("tournament_id", WC2026_TOURNAMENT_ID)
    .is("hidden_at", null)
    .limit(1)
    .maybeSingle();

  const showWcCard = !!wcComp;

  // Fetch active rounds for all competitions
  const compIds = comps.map((c) => c.id);
  let rounds: RoundRow[] = [];
  if (compIds.length > 0) {
    const { data } = await supabase
      .from("rounds")
      .select("id, competition_id, name, round_number, status")
      .in("competition_id", compIds)
      .in("status", ["open", "locked"])
      .order("round_number", { ascending: false });
    rounds = (data ?? []) as RoundRow[];
  }

  // Fetch event counts and user's pick counts per round
  const roundIds = rounds.map((r) => r.id);
  let eventCounts: Record<string, number> = {};
  let pickCounts: Record<string, number> = {};

  if (roundIds.length > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("id, round_id")
      .in("round_id", roundIds);

    const evts = events ?? [];
    for (const e of evts) {
      if (e.round_id) eventCounts[e.round_id] = (eventCounts[e.round_id] ?? 0) + 1;
    }

    const eventIds = evts.map((e) => e.id);
    if (eventIds.length > 0) {
      const { data: preds } = await supabase
        .from("predictions")
        .select("event_id, events!inner(round_id)")
        .eq("user_id", userId)
        .in("event_id", eventIds);

      // Dedupe by event_id per round — a single event can hold multiple
      // prediction rows (winner + exact_score for group fixtures), but the
      // card shows "matches picked", not "rows written".
      const eventsByRound = new Map<string, Set<string>>();
      for (const p of (preds ?? []) as Array<{ event_id: string; events: { round_id: string | null }[] }>) {
        const rid = p.events?.[0]?.round_id;
        if (!rid || !p.event_id) continue;
        let set = eventsByRound.get(rid);
        if (!set) {
          set = new Set<string>();
          eventsByRound.set(rid, set);
        }
        set.add(p.event_id);
      }
      for (const [rid, set] of eventsByRound) {
        pickCounts[rid] = set.size;
      }
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-6">
      {/* Greeting */}
      <div className="flex items-center gap-3 mb-6">
        <BrandMark className="h-9 w-auto shrink-0" />
        <h1 className="text-lg font-extrabold text-ps-text">Home</h1>
      </div>

      {/* World Cup 2026 promo card */}
      {showWcCard && (
        <Link
          href="/wc"
          className="mb-4 block rounded-2xl p-5 transition-all active:scale-[0.98]"
          style={{ background: "#0a0f0a", color: "#f1ece2" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#006847" }}
              >
                World Cup
              </p>
              <h2 className="mt-1 text-lg font-extrabold">Make your picks</h2>
              <p className="mt-1 text-xs" style={{ color: "#a8a090" }}>
                48 teams. 5 ways to play. Free entry.
              </p>
            </div>
            <span
              className="text-3xl font-extrabold"
              style={{ color: "#d4af37" }}
            >
              26
            </span>
          </div>
        </Link>
      )}

      {comps.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-dashed border-ps-border bg-ps-surface p-6 text-center">
            <p className="text-sm font-medium text-ps-text-sec">
              No active competitions yet.
            </p>
            <p className="mt-2 text-xs text-ps-text-ter">
              Start your own, or join one with an invite link below.
            </p>
            <Link
              href="/competitions/new"
              className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2.5 text-sm font-semibold text-ps-text"
            >
              Create Competition
            </Link>
          </div>
          <OrDivider />
          <JoinCompetitionCard />
        </div>
      ) : (
        <div className="space-y-4">
          {comps.map((comp) => {
            const activeRound = rounds.find((r) => r.competition_id === comp.id);
            const evtCount = activeRound ? (eventCounts[activeRound.id] ?? 0) : 0;
            const pickCount = activeRound ? (pickCounts[activeRound.id] ?? 0) : 0;

            return (
              <Link
                key={comp.id}
                href={`/predictions?competition=${comp.id}`}
                className="block rounded-2xl border border-ps-border bg-ps-surface p-4 transition-all duration-150 active:scale-[0.98]"
              >
                {/* Competition name */}
                <h2 className="text-base font-extrabold text-ps-text">
                  {comp.name}
                </h2>

                {/* Active round */}
                {activeRound ? (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ps-amber-deep">
                      {activeRound.name ?? `Round ${activeRound.round_number}`}
                      {activeRound.status === "locked" && " — locked"}
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold ${
                        evtCount > 0 && pickCount >= evtCount
                          ? "text-ps-green"
                          : pickCount > 0
                            ? "text-ps-amber-deep"
                            : "text-ps-text-ter"
                      }`}
                    >
                      {pickCount}/{evtCount} picked
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ps-text-ter">
                    No active round
                  </p>
                )}

                {/* Pick progress bar */}
                {activeRound && evtCount > 0 && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-ps-chip">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((pickCount / evtCount) * 100)}%`,
                        background: "linear-gradient(90deg, var(--ps-amber), var(--ps-amber-deep))",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick links */}
      <div className="mt-6 flex gap-3">
        <Link
          href="/predictions"
          className="flex-1 rounded-xl bg-ps-text py-3 text-center text-sm font-semibold text-ps-bg transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
        >
          Predictions
        </Link>
        <Link
          href="/leaderboard"
          className="flex-1 rounded-xl border border-ps-border bg-ps-surface py-3 text-center text-sm font-semibold text-ps-text transition-all duration-150 active:scale-[0.97]"
        >
          Leaderboard
        </Link>
      </div>
      <PersonalPredictionsLink className="mt-3" />
    </div>
  );
}

// ── Page entry point ────────────────────────────────────────────────────────

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  return <Dashboard userId={user.id} />;
}
