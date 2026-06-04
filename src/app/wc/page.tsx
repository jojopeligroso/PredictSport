import Link from "next/link";
import { fetchMd1PicksData } from "./_landing/fetchMd1PicksData";
import { fetchFixturesResultsData } from "./_landing/fetchFixturesResultsData";
import { WcPicksHub } from "./_landing/WcPicksHub";

export const dynamic = "force-dynamic";

/**
 * /wc — picks-first World Cup hub (ADR 0014).
 *
 * Three tabs: Upcoming (picks), Fixtures (schedule), Results (completed).
 * Anonymous + non-member visitors see a blurred preview with a tap-to-join
 * overlay on the Upcoming tab.
 */
export default async function WorldCupLanding() {
  const [md1Data, fixturesData] = await Promise.all([
    fetchMd1PicksData(),
    fetchFixturesResultsData(),
  ]);

  if (!md1Data.ready) return <ComingSoonPanel />;

  return (
    <WcPicksHub
      md1={{
        competitionId: md1Data.competitionId,
        events: md1Data.events,
        predictions: md1Data.predictions,
        fixtureByEventId: md1Data.fixtureByEventId,
        isMember: md1Data.isMember,
        isAuthenticated: md1Data.isAuthenticated,
        windowLocked: md1Data.windowLocked,
      }}
      fixturesData={fixturesData}
    />
  );
}

function ComingSoonPanel() {
  return (
    <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ps-amber-deep">
        Coming soon
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-ps-text">
        The World Cup is being set up.
      </h1>
      <p className="mt-3 text-sm text-ps-text-sec">
        Drop back closer to June. We&apos;re seeding the fixtures, polishing the
        scoring, and getting the chairs out.
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
