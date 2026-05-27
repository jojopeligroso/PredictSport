import Link from "next/link";
import { Md1PicksLanding } from "./_landing/Md1PicksLanding";
import { fetchMd1PicksData } from "./_landing/fetchMd1PicksData";

export const dynamic = "force-dynamic";

/**
 * /wc — picks-first World Cup landing (ADR 0014).
 *
 * The page IS the matchday-1 group-stage picker. Anonymous + non-member
 * visitors see a blurred preview with a tap-to-join overlay.
 */
export default async function WorldCupLanding() {
  const data = await fetchMd1PicksData();

  if (!data.ready) return <ComingSoonPanel />;

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
