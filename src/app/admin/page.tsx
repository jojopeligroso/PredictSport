import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCompetitionForm } from "./components/CreateCompetitionForm";
import { StatusBadge } from "./components/CompetitionStatusBadge";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch competitions where user is admin or co_admin
  const { data: memberships } = await supabase
    .from("competition_members")
    .select(
      "competition_id, role, competitions(id, name, description, type, status, visibility, created_at, invite_code)"
    )
    .eq("user_id", user.id)
    .in("role", ["admin", "co_admin"]);

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

  // Count events and members per competition for summary
  const competitionIds = competitions.map((c) => c.id);

  const { data: eventCounts } = competitionIds.length > 0
    ? await supabase
        .from("events")
        .select("competition_id")
        .in("competition_id", competitionIds)
    : { data: [] };

  const { data: memberCounts } = competitionIds.length > 0
    ? await supabase
        .from("competition_members")
        .select("competition_id")
        .in("competition_id", competitionIds)
    : { data: [] };

  const { data: pendingNominations } = competitionIds.length > 0
    ? await supabase
        .from("event_nominations")
        .select("competition_id")
        .in("competition_id", competitionIds)
        .eq("status", "pending")
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

  const nominationCountMap = new Map<string, number>();
  for (const n of pendingNominations ?? []) {
    nominationCountMap.set(
      n.competition_id,
      (nominationCountMap.get(n.competition_id) ?? 0) + 1
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your competitions, events, results, and participants.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Back to Home
        </Link>
      </div>

      {/* Create Competition */}
      <div className="mb-8">
        <CreateCompetitionForm />
      </div>

      {/* Competition List */}
      {competitions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
            No competitions
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Create your first competition to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitions.map((comp) => {
            const eventCount = eventCountMap.get(comp.id) ?? 0;
            const memberCount = memberCountMap.get(comp.id) ?? 0;
            const pendingCount = nominationCountMap.get(comp.id) ?? 0;

            return (
              <Link
                key={comp.id}
                href={`/admin/competitions/${comp.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                        {comp.name}
                      </h2>
                      <StatusBadge status={comp.status} type="competition" />
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
                        {comp.type}
                      </span>
                    </div>
                    {comp.description && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">
                        {comp.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{eventCount} event{eventCount !== 1 ? "s" : ""}</span>
                      <span>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                      <span className="capitalize">{comp.visibility}</span>
                      <span>
                        Your role:{" "}
                        <span className="font-medium">{comp.role.replace("_", " ")}</span>
                      </span>
                      {pendingCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {pendingCount} pending nomination{pendingCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-600"
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
