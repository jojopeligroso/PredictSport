import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import JoinCompetitionCard from "@/components/JoinCompetitionCard";
import { OrDivider } from "@/components/OrDivider";

function formatLockTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CompetitionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Memberships + competition base data
  const { data: memberships } = await supabase
    .from("competition_members")
    .select(
      "competition_id, role, competitions(id, name, description, type, status, visibility, created_at, invite_code)"
    )
    .eq("user_id", user.id);

  const competitions = (memberships ?? [])
    .map((m) => ({
      ...(m.competitions as unknown as {
        id: string;
        name: string;
        description: string | null;
        type: string;
        status: string;
        visibility: string;
        created_at: string;
        invite_code: string;
      }),
      role: m.role,
    }))
    .filter((c) => c.id)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const competitionIds = competitions.map((c) => c.id);

  // Additional data for richer cards
  const [memberCountsResult, roundDataResult, eventDetailsResult] =
    competitionIds.length > 0
      ? await Promise.all([
          supabase
            .from("competition_members")
            .select("competition_id")
            .in("competition_id", competitionIds),
          supabase
            .from("rounds")
            .select("competition_id, id, round_number, status")
            .in("competition_id", competitionIds)
            .order("round_number", { ascending: false }),
          supabase
            .from("events")
            .select("competition_id, sport, lock_time, status")
            .in("competition_id", competitionIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  // Member counts
  const memberCountMap = new Map<string, number>();
  for (const m of memberCountsResult.data ?? []) {
    memberCountMap.set(
      m.competition_id,
      (memberCountMap.get(m.competition_id) ?? 0) + 1
    );
  }

  // Round counts and latest round number
  const roundCountMap = new Map<string, number>();
  const latestRoundMap = new Map<string, number>();
  for (const r of roundDataResult.data ?? []) {
    const cid = r.competition_id;
    roundCountMap.set(cid, (roundCountMap.get(cid) ?? 0) + 1);
    // rounds are ordered DESC so first occurrence is highest round_number
    if (!latestRoundMap.has(cid)) {
      latestRoundMap.set(cid, r.round_number as number);
    }
  }

  // Next lock time and sports per competition
  const nextLockMap = new Map<string, string | null>();
  const sportsMap = new Map<string, Set<string>>();
  const now = new Date();

  for (const e of eventDetailsResult.data ?? []) {
    const cid = e.competition_id;

    // Sports
    if (!sportsMap.has(cid)) sportsMap.set(cid, new Set());
    if (e.sport) sportsMap.get(cid)!.add(e.sport as string);

    // Next lock — earliest upcoming lock_time
    if (e.status === "upcoming" && e.lock_time) {
      const lockDate = new Date(e.lock_time as string);
      if (lockDate > now) {
        const current = nextLockMap.get(cid);
        if (!current || lockDate < new Date(current)) {
          nextLockMap.set(cid, e.lock_time as string);
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-[480px] md:max-w-2xl lg:max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            Your Competitions
          </p>
          <h1 className="font-display font-extrabold text-2xl uppercase tracking-tight text-ps-text leading-none mt-0.5">
            Competitions
          </h1>
        </div>
        <Link
          href="/competitions/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-3.5 py-2 text-xs font-extrabold text-[#1a1208] transition-opacity hover:opacity-90"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#1a1208" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          New
        </Link>
      </div>

      {/* Personal predictions entry */}
      <Link
        href="/competitions/personal"
        className="mb-4 flex items-center justify-between rounded-2xl border border-ps-border bg-ps-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(40,30,20,0.04)] transition-all hover:border-ps-border-strong active:scale-[0.98]"
      >
        <div>
          <p className="text-[10px] font-extrabold tracking-widest uppercase text-ps-text-ter">
            Personal
          </p>
          <p className="text-sm font-extrabold text-ps-text leading-snug">
            My Personal Predictions
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-ps-text-sec">
            Pick outcomes on any fixture — no competition needed
          </p>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0 text-ps-text-ter"
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      {/* Competition list */}
      {competitions.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-dashed border-ps-border p-8 text-center">
            <h2 className="text-base font-semibold text-ps-text-sec">Nothing here yet</h2>
            <p className="mt-2 text-sm text-ps-text-ter">
              Start one yourself, or join one with an invite link below.
            </p>
            <Link
              href="/competitions/new"
              className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2.5 text-sm font-extrabold text-[#1a1208]"
            >
              Start a Competition
            </Link>
          </div>
          <OrDivider />
          <JoinCompetitionCard />
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
          {competitions.map((comp) => {
            const memberCount = memberCountMap.get(comp.id) ?? 0;
            const roundCount = roundCountMap.get(comp.id) ?? 0;
            const latestRound = latestRoundMap.get(comp.id) ?? 0;
            const nextLock = nextLockMap.get(comp.id) ?? null;
            const sports = sportsMap.get(comp.id) ?? new Set<string>();
            const hasGaa = sports.has("gaa");
            const isDraft = comp.status === "draft";
            const isActive = comp.status === "active";

            return (
              <Link
                key={comp.id}
                href={`/competitions/${comp.id}`}
                className="block rounded-2xl border border-ps-border bg-ps-surface p-4 transition-all duration-150 hover:border-ps-border-strong active:scale-[0.98] shadow-[0_1px_2px_rgba(40,30,20,0.04)]"
              >
                {/* Top row: brand mark + status + member count */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <BrandMark
                      sport={hasGaa ? "gaa" : undefined}
                      className="w-5 h-5"
                    />
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold tracking-wide uppercase ${
                        isActive
                          ? "bg-ps-green-soft text-ps-green"
                          : isDraft
                          ? "bg-ps-chip text-ps-text-ter"
                          : comp.status === "completed"
                          ? "bg-ps-amber-soft text-ps-amber-deep"
                          : "bg-ps-chip text-ps-text-ter"
                      }`}
                    >
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-ps-green" />
                      )}
                      {comp.status}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-ps-text-sec">
                    {memberCount} {memberCount === 1 ? "member" : "members"}
                  </span>
                </div>

                {/* Competition name */}
                <div className="text-base font-extrabold text-ps-text leading-snug">
                  {comp.name}
                </div>

                {/* Body: active vs draft vs other */}
                {isActive && roundCount > 0 ? (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-[11.5px] font-semibold text-ps-text-sec">
                      <span>Round {latestRound}</span>
                      {nextLock && (
                        <>
                          <span className="text-ps-text-ter">·</span>
                          <span>
                            Next round locks{" "}
                            <span className="font-extrabold text-ps-amber-deep">
                              {formatLockTime(nextLock)}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1 rounded-full bg-ps-chip overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706]"
                        style={{ width: `${Math.min(100, (latestRound / Math.max(roundCount, 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10.5px] font-semibold text-ps-text-ter">
                      <span>{roundCount} round{roundCount !== 1 ? "s" : ""} total</span>
                      <span>Round {latestRound} of {roundCount}</span>
                    </div>
                  </div>
                ) : isDraft ? (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-ps-amber bg-ps-amber-soft/60 px-3 py-2.5">
                    <span className="text-xs font-bold text-ps-amber-deep leading-snug flex-1">
                      No rounds yet. Add the first round to send it live.
                    </span>
                    <span className="shrink-0 rounded-lg bg-[#f59e0b] px-2.5 py-1 text-[10px] font-extrabold text-[#1a1208]">
                      Add round
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 text-[11.5px] font-semibold text-ps-text-ter">
                    {roundCount} {roundCount === 1 ? "round" : "rounds"} played
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
