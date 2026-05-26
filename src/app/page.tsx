import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import JoinCompetitionCard from "@/components/JoinCompetitionCard";
import { OrDivider } from "@/components/OrDivider";
import { computePickCounts, findActiveRound } from "@/lib/dashboard-helpers";

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
    tournament_id: string | null;
    type: string | null;
  } | null;
}

interface RoundRow {
  id: string;
  competition_id: string;
  name: string;
  round_number: number;
  status: string;
}

// ── Icons ───────────────────────────────────────────────────────────────────

function CrosshairIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function PodiumIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="5" height="11" rx="1" /><rect x="10" y="3" width="5" height="18" rx="1" /><rect x="16" y="7" width="5" height="14" rx="1" />
    </svg>
  );
}

function UserCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" />
      <path d="M6.168 18.849A4 4 0 0110 16h4a4 4 0 013.834 2.855" />
    </svg>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────

async function Dashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  // Fetch user profile for avatar
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const displayName = profile?.display_name ?? "You";
  const initial = displayName.charAt(0).toUpperCase();

  // Fetch competitions
  const { data: memberships } = await supabase
    .from("competition_members")
    .select("competition_id, role, competitions(id, name, status, tournament_id, type)")
    .eq("user_id", userId);

  const comps = ((memberships ?? []) as unknown as CompetitionRow[])
    .map((m) => m.competitions ? { ...m.competitions, role: m.role } : null)
    .filter((c): c is NonNullable<typeof c> & { role: string } => c !== null && c.status === "active");

  // Check for visible WC competition (for non-members)
  const { data: wcComp } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("tournament_id", WC2026_TOURNAMENT_ID)
    .is("hidden_at", null)
    .limit(1)
    .maybeSingle();

  // Split: WC hero vs secondary cards
  const wcUserComp = comps.find((c) => c.tournament_id === WC2026_TOURNAMENT_ID);
  const otherComps = comps.filter(
    (c) => c.tournament_id !== WC2026_TOURNAMENT_ID && c.type !== "personal",
  );
  const showWcPromo = !!wcComp && !wcUserComp;

  // Fetch active rounds for all competitions
  const compIds = comps.map((c) => c.id);
  let rounds: RoundRow[] = [];
  const memberCounts: Record<string, number> = {};
  if (compIds.length > 0) {
    const [roundsRes, membersRes] = await Promise.all([
      supabase
        .from("rounds")
        .select("id, competition_id, name, round_number, status")
        .in("competition_id", compIds)
        .in("status", ["open", "locked"])
        .order("round_number", { ascending: true }),
      supabase
        .from("competition_members")
        .select("competition_id")
        .in("competition_id", compIds),
    ]);
    rounds = (roundsRes.data ?? []) as RoundRow[];
    for (const m of membersRes.data ?? []) {
      memberCounts[m.competition_id] = (memberCounts[m.competition_id] ?? 0) + 1;
    }
  }

  // Fetch event counts, pick counts, and deadlines
  const roundIds = rounds.map((r) => r.id);
  const eventCounts: Record<string, number> = {};
  let pickCounts: Record<string, number> = {};
  const roundDeadlines: Record<string, string> = {};

  if (roundIds.length > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("id, round_id, lock_time")
      .in("round_id", roundIds);

    const evts = events ?? [];
    for (const e of evts) {
      if (e.round_id) {
        eventCounts[e.round_id] = (eventCounts[e.round_id] ?? 0) + 1;
        if (e.lock_time) {
          if (!roundDeadlines[e.round_id] || e.lock_time < roundDeadlines[e.round_id]) {
            roundDeadlines[e.round_id] = e.lock_time;
          }
        }
      }
    }

    const eventIds = evts.map((e) => e.id);
    if (eventIds.length > 0) {
      const { data: preds } = await supabase
        .from("predictions")
        .select("event_id, events!inner(round_id)")
        .eq("user_id", userId)
        .in("event_id", eventIds);

      const predsTyped = (preds ?? []) as unknown as Array<{
        event_id: string;
        events: { round_id: string | null };
      }>;
      pickCounts = computePickCounts(predsTyped);
    }
  }

  // Hero card data (WC or first comp with active round)
  const heroComp = wcUserComp ?? null;
  const heroRound = heroComp ? findActiveRound(rounds, heroComp.id) : null;
  const heroEvtCount = heroRound ? (eventCounts[heroRound.id] ?? 0) : 0;
  const heroPickCount = heroRound ? (pickCounts[heroRound.id] ?? 0) : 0;
  const heroDeadline = heroRound ? roundDeadlines[heroRound.id] : null;
  const heroProgress = heroEvtCount > 0 ? heroPickCount / heroEvtCount : 0;
  const RING_C = 263.89; // 2πr where r=42
  const ringOffset = RING_C * (1 - heroProgress);
  const heroHref = wcUserComp ? "/wc" : "/predictions";

  let daysLeft: number | null = null;
  let deadlineLabel = "";
  if (heroDeadline) {
    const d = new Date(heroDeadline);
    const now = new Date();
    daysLeft = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86_400_000));
    deadlineLabel =
      d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" }) +
      " \u00b7 " +
      d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-6">
      {/* ── Wordmark + avatar ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[17px] font-extrabold leading-none tracking-tight">
          <span className="text-ps-text">sports</span>
          <span className="text-ps-amber">predict.</span>
        </span>
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ps-text text-sm font-extrabold text-ps-amber">
          {initial}
        </div>
      </div>

      {/* ── Hero card (WC member) ──────────────────────────────── */}
      {heroComp && heroRound ? (
        <Link
          href={heroHref}
          className="mt-2 block rounded-3xl p-6 pb-5 transition-all active:scale-[0.98]"
          style={{
            background: "#0a0f0a",
            color: "#f1ece2",
            backgroundImage:
              "radial-gradient(ellipse at 70% 20%, rgba(212,175,55,0.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(10,168,109,0.05) 0%, transparent 50%)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "rgba(212,175,55,0.6)" }}
          >
            Now open &mdash; make your move
          </p>
          <p className="mt-1 text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
            <span style={{ color: "rgba(255,255,255,0.85)" }}>{heroComp.name}</span>
            {memberCounts[heroComp.id] ? (
              <span className="ml-2 font-mono text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {memberCounts[heroComp.id]} players
              </span>
            ) : null}
          </p>

          <div className="mt-5 flex items-center gap-5">
            {/* Progress ring */}
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 96 96" className="h-24 w-24" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="5" />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={ringOffset}
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-[22px] font-bold leading-none" style={{ color: "#d4af37" }}>
                  {heroPickCount}
                </span>
                <span
                  className="mt-0.5 font-mono text-[11px] font-medium leading-none"
                  style={{ color: "rgba(212,175,55,0.5)" }}
                >
                  /{heroEvtCount}
                </span>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-[22px] font-extrabold leading-tight text-white">
                {heroRound.name ?? `Round ${heroRound.round_number}`}
              </h2>
              <p className="mt-1 text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                {heroPickCount} of {heroEvtCount} picks made
              </p>
              {daysLeft !== null && (
                <div
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                  style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#d4af37" }} />
                  <span className="font-mono text-xs font-semibold" style={{ color: "#d4af37" }}>
                    {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                  </span>
                </div>
              )}
            </div>
          </div>

          <div
            className="mt-5 rounded-[14px] py-3.5 text-center text-[15px] font-extrabold"
            style={{ background: "#f59e0b", color: "#0a0f0a", boxShadow: "0 4px 16px rgba(212,175,55,0.35)" }}
          >
            Make your picks &rarr;
          </div>
          {deadlineLabel && (
            <p className="mt-2 text-center text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
              Deadline: {deadlineLabel}
            </p>
          )}
        </Link>
      ) : showWcPromo ? (
        /* WC promo for non-members */
        <Link
          href="/wc"
          className="mt-2 block rounded-3xl p-6 transition-all active:scale-[0.98]"
          style={{ background: "#0a0f0a", color: "#f1ece2" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#006847" }}>
            World Cup 2026
          </p>
          <h2 className="mt-1 text-lg font-extrabold">Make your picks</h2>
          <p className="mt-1 text-xs" style={{ color: "#a8a090" }}>
            48 teams. 5 ways to play. Free entry.
          </p>
          <span
            className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "#d4af37", color: "#0a0f0a" }}
          >
            Get started
          </span>
        </Link>
      ) : null}

      {/* ── Empty state ────────────────────────────────────────── */}
      {comps.length === 0 ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-dashed border-ps-border bg-ps-surface p-6 text-center">
            <p className="text-sm font-medium text-ps-text-sec">No active competitions yet.</p>
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
        /* ── Secondary cards ─────────────────────────────────── */
        <div className="mt-3.5 flex flex-col gap-2.5">
          {/* Personal Predictions */}
          <Link
            href="/competitions/personal"
            className="flex items-center gap-3 rounded-2xl border border-ps-border bg-ps-surface p-3.5 transition-all duration-150 active:scale-[0.98]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#c48a12]" style={{ background: "rgba(245,158,11,0.08)" }}>
              <CrosshairIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ps-text">Personal Predictions</div>
              <div className="mt-0.5 text-[11px] font-medium text-ps-text-ter">Your private pick tracker</div>
            </div>
            <span className="rounded-full bg-ps-chip px-2 py-0.5 text-[10px] font-bold text-ps-text-ter">
              Open &rarr;
            </span>
          </Link>

          {/* Leaderboard */}
          <Link
            href="/leaderboard"
            className="flex items-center gap-3 rounded-2xl border border-ps-border bg-ps-surface p-3.5 transition-all duration-150 active:scale-[0.98]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#c48a12]" style={{ background: "rgba(245,158,11,0.08)" }}>
              <PodiumIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ps-text">Leaderboard</div>
              <div className="mt-0.5 text-[11px] font-medium text-ps-text-ter">See how you stack up</div>
            </div>
            <span className="rounded-full bg-ps-chip px-2 py-0.5 text-[10px] font-bold text-ps-text-ter">
              View &rarr;
            </span>
          </Link>

          {/* Other competitions */}
          {otherComps.map((comp) => {
            const activeRound = findActiveRound(rounds, comp.id);
            const evtCount = activeRound ? (eventCounts[activeRound.id] ?? 0) : 0;
            const pickCount = activeRound ? (pickCounts[activeRound.id] ?? 0) : 0;
            const count = memberCounts[comp.id] ?? 0;
            const isCompAdmin = comp.role === "admin" || comp.role === "co_admin";

            return (
              <Link
                key={comp.id}
                href={`/predictions?competition=${comp.id}`}
                className="flex items-center gap-3 rounded-2xl border border-ps-border bg-ps-surface p-3.5 transition-all duration-150 active:scale-[0.98]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#c48a12]" style={{ background: "rgba(245,158,11,0.08)" }}>
                  <UserCircleIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-ps-text">{comp.name}</span>
                    {isCompAdmin && (
                      <Link
                        href={`/competitions/${comp.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-ps-text-ter hover:text-ps-text transition-colors"
                        aria-label={`Manage ${comp.name}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </Link>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-ps-text-ter">
                    <span>
                      {activeRound
                        ? (activeRound.name ?? `Round ${activeRound.round_number}`)
                        : "No active round"}
                    </span>
                    {count > 0 && (
                      <>
                        <span>&middot;</span>
                        <span className="font-mono text-xs">{count} players</span>
                      </>
                    )}
                  </div>
                </div>
                {activeRound ? (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      evtCount > 0 && pickCount >= evtCount
                        ? "bg-[rgba(10,168,109,0.1)] text-ps-green"
                        : pickCount > 0
                          ? "bg-[rgba(245,158,11,0.1)] text-ps-amber-deep"
                          : "bg-ps-chip text-ps-text-ter"
                    }`}
                  >
                    {pickCount}/{evtCount}
                  </span>
                ) : (
                  <span className="rounded-full bg-[rgba(245,158,11,0.1)] px-2 py-0.5 text-[10px] font-bold text-[#b8741f]">
                    Idle
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
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
