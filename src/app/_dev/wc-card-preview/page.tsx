/**
 * Scratch preview for the PR2 WindowPickList surface="card" variant.
 *
 * Not a real route — this directory is prefixed with `_dev` so Next.js
 * skips it during routing. To open it locally, temporarily rename the
 * folder to `dev` and visit /dev/wc-card-preview, then rename back before
 * committing. The file ships in the repo as documentation of how to wire
 * the card surface, and as a smoke target if anyone needs to verify
 * rendering without standing up the full /wc landing.
 */
import { WindowPickList } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";

export const dynamic = "force-dynamic";

export default function CardPreviewPage() {
  // Build a synthetic WindowEvent for the first three MD1 fixtures so we can
  // see real host-city colours (Mexico City violet, Guadalajara magenta,
  // Toronto royal blue) under the card treatment.
  const md1 = WC2026_FIXTURES.filter(
    (f) => f.stage === "group" && f.matchday === 1,
  ).slice(0, 6);

  const events: WindowEvent[] = md1.map((f) => ({
    id: f.externalId,
    event_name: `${f.home} v ${f.away}`,
    sport: "soccer",
    start_time: f.kickoffUtc,
    // lock_time 30 minutes before kickoff so canPredict is true.
    lock_time: new Date(
      new Date(f.kickoffUtc).getTime() - 30 * 60_000,
    ).toISOString(),
    status: "upcoming",
    result_confirmed: false,
    event_prediction_types: [
      {
        id: `${f.externalId}-winner`,
        event_id: f.externalId,
        prediction_type: "winner",
        points: 1,
        partial_points: 0,
        config: { options: [f.home, "Draw", f.away], allow_draw: true },
      },
      {
        id: `${f.externalId}-score`,
        event_id: f.externalId,
        prediction_type: "exact_score",
        points: 3,
        partial_points: 0,
        config: {},
      },
      // EventPredictionType fields cast loosely — preview only, never
      // submitted to the API.
    ] as WindowEvent["event_prediction_types"],
  }));

  const fixtureByEventId = new Map<string, WcFixture>();
  for (const f of md1) fixtureByEventId.set(f.externalId, f);

  return (
    <div className="mx-auto max-w-[480px] px-4 py-8">
      <h1 className="mb-3 font-display text-2xl font-extrabold uppercase tracking-tight text-ps-text">
        Card surface preview
      </h1>
      <p className="mb-6 text-sm text-ps-text-sec">
        Smoke-test for PR2 surface=&quot;card&quot;. Not a real route. Picks
        won&apos;t persist (synthetic competitionId).
      </p>
      <WindowPickList
        competitionId="00000000-0000-0000-0000-000000000000"
        events={events}
        predictions={[]}
        windowLocked={false}
        surface="card"
        fixtureByEventId={fixtureByEventId}
      />
    </div>
  );
}
