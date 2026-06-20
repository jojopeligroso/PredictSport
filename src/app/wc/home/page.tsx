import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchDashboardData } from "./fetchDashboardData";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

/**
 * /wc/home — World Cup Dashboard ("Home" tab).
 *
 * The user's command centre: next picks, group table, results, stats,
 * invite, and bracket progress. Server component fetches all data,
 * passes to the client shell.
 */
export default async function WcHomePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const params = await searchParams;
  const onboarding = params.onboarding === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await fetchDashboardData();

  if (!data.ready) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-ps-amber-deep">
          Coming soon
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-ps-text">
          Dashboard is being set up.
        </h1>
        <p className="mt-3 text-sm text-ps-text-sec">
          Drop back closer to June.
        </p>
        <Link
          href="/wc/rules"
          className="mt-6 inline-block text-xs text-ps-text-sec underline-offset-2 hover:text-ps-text hover:underline"
        >
          See the rules →
        </Link>
      </div>
    );
  }

  return (
    <DashboardClient
      competitionId={data.competitionId}
      nextEvents={data.nextEvents}
      pillDateEvents={data.pillDateEvents}
      predictions={data.predictions}
      fixtureByEventId={data.fixtureByEventId}
      recentResults={data.recentResults}
      classificationId={data.classificationId}
      todayGroups={data.todayGroups}
      todayGroupEvents={data.todayGroupEvents}
      inviteCode={data.inviteCode}
      entryClosesAt={data.entryClosesAt}
      memberCount={data.memberCount}
      isMember={data.isMember}
      isAuthenticated={data.isAuthenticated}
      windowLocked={data.windowLocked}
      currentUserId={user?.id ?? null}
      bracketProgress={data.bracketProgress}
      groupStandings={data.groupStandings}
      datePills={data.datePills}
      chatEnabled={data.chatEnabled}
      isCompetitionAdmin={data.isCompetitionAdmin}
      memberRole={data.memberRole}
      lastChatMessage={data.lastChatMessage}
      onboarding={onboarding}
    />
  );
}
