import { Md1PicksLanding } from "../_landing/Md1PicksLanding";
import { fetchMd1PicksData } from "../_landing/fetchMd1PicksData";

export const dynamic = "force-dynamic";

/**
 * /wc/picks — MD1 picks-first landing.
 *
 * Renders the same picks-first UI as /wc. Uses a shared data loader
 * so this page is decoupled from /wc and won't change if /wc does.
 */
export default async function PicksPage() {
  const data = await fetchMd1PicksData();

  if (!data.ready) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-ps-text">No active competition</h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          The World Cup prediction game hasn&apos;t started yet.
        </p>
      </div>
    );
  }

  return (
    <Md1PicksLanding
      competitionId={data.competitionId}
      events={data.events}
      predictions={data.predictions}
      fixtureByEventId={data.fixtureByEventId}
      isMember={data.isMember}
      isAuthenticated={data.isAuthenticated}
      windowLocked={data.windowLocked}
    />
  );
}
