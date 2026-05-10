import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/app/admin/components/CompetitionStatusBadge";

export default async function CompetitionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all competitions where user is a member (any role)
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

  // Count events and members per competition
  const competitionIds = competitions.map((c) => c.id);

  const { data: eventCounts } =
    competitionIds.length > 0
      ? await supabase
          .from("events")
          .select("competition_id")
          .in("competition_id", competitionIds)
      : { data: [] };

  const { data: memberCounts } =
    competitionIds.length > 0
      ? await supabase
          .from("competition_members")
          .select("competition_id")
          .in("competition_id", competitionIds)
      : { data: [] };

  const eventCountMap = new Map<string, number>();
  for (const e of eventCounts ?? []) {
    eventCountMap.set(
      e.competition_id,
      (eventCountMap.get(e.competition_id) ?? 0) + 1
    );
  }

  const memberCountMap = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    memberCountMap.set(
      m.competition_id,
      (memberCountMap.get(m.competition_id) ?? 0) + 1
    );
  }

  return (
    <div className="mx-auto max-w-[480px] md:max-w-2xl lg:max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display font-extrabold text-xl uppercase tracking-tight text-ps-text">
            Competitions
          </h1>
          <p className="mt-1 text-sm text-ps-text-sec">
            Your competitions and leagues.
          </p>
        </div>
        <Link
          href="/competitions/new"
          className="shrink-0 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2.5 text-sm font-semibold text-ps-text"
        >
          Create Competition
        </Link>
      </div>

      {/* Competition list */}
      {competitions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ps-border p-12 text-center">
          <h2 className="text-lg font-medium text-ps-text-sec">
            No competitions yet
          </h2>
          <p className="mt-2 text-sm text-ps-text-ter">
            Create your first competition or ask a mate for an invite link.
          </p>
          <Link
            href="/competitions/new"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-4 py-2.5 text-sm font-semibold text-ps-text"
          >
            Create Competition
          </Link>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {competitions.map((comp) => {
            const eventCount = eventCountMap.get(comp.id) ?? 0;
            const memberCount = memberCountMap.get(comp.id) ?? 0;

            return (
              <Link
                key={comp.id}
                href={`/competitions/${comp.id}`}
                className="block rounded-2xl border border-ps-border bg-ps-surface p-4 transition-all duration-150 active:scale-[0.98]"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-ps-text truncate">
                        {comp.name}
                      </h2>
                      <StatusBadge status={comp.status} type="competition" />
                    </div>
                    {comp.description && (
                      <p className="mt-1 text-sm text-ps-text-ter line-clamp-1">
                        {comp.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ps-text-ter">
                      <span>
                        {eventCount} event{eventCount !== 1 ? "s" : ""}
                      </span>
                      <span>
                        {memberCount} member{memberCount !== 1 ? "s" : ""}
                      </span>
                      <span className="capitalize">
                        {comp.role.replace("_", " ")}
                      </span>
                      <span className="capitalize">{comp.visibility}</span>
                    </div>
                  </div>
                  <svg
                    className="h-5 w-5 shrink-0 text-ps-text-ter"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
