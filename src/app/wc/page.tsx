import Link from "next/link";
import { fetchMd1PicksData } from "./_landing/fetchMd1PicksData";
import { fetchFixturesResultsData } from "./_landing/fetchFixturesResultsData";
import { fetchGroupsData } from "./_landing/fetchGroupsData";
import { WcPicksHub } from "./_landing/WcPicksHub";
import { getServerT } from "@/lib/i18n/server";
import { isWorldCupArchive } from "@/lib/product-mode";
import { getReadClient } from "@/lib/wc/archive-client";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";
import { fixtureFilter } from "@/lib/tournament/shared-fixtures";

export const dynamic = "force-dynamic";

/**
 * /wc — picks-first World Cup hub (ADR 0014).
 *
 * Three tabs: Upcoming (picks), Fixtures (schedule), Results (completed).
 * Anonymous + non-member visitors see a blurred preview with a tap-to-join
 * overlay on the Upcoming tab.
 */
export default async function WorldCupLanding() {
  const t = await getServerT();
  const [md1Data, fixturesData, groupsData] = await Promise.all([
    fetchMd1PicksData(),
    fetchFixturesResultsData(),
    fetchGroupsData(),
  ]);

  if (!md1Data.ready) return <ComingSoonPanel t={t} />;

  // On the display site, fetch all rounds so visitors can browse every stage.
  let allRounds: Array<{ id: string; name: string; round_number: number; status: string }> = [];
  if (isWorldCupArchive()) {
    const { competition } = await resolveWcCompetition();
    if (competition) {
      const supabase = await getReadClient();
      const ff = fixtureFilter(competition);
      const { data } = await supabase
        .from("rounds")
        .select("id, name, round_number, status")
        .eq(ff.key, ff.value)
        .order("round_number", { ascending: true });
      allRounds = data ?? [];
    }
  }

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
      groupsData={groupsData}
      allRounds={allRounds}
    />
  );
}

function ComingSoonPanel({ t }: { t: (key: string, vars?: Record<string, string | number>) => string }) {
  return (
    <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
      <p className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-ps-amber-deep">
        {t('common.coming_soon')}
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-ps-text">
        {t('landing.coming_soon_heading')}
      </h1>
      <p className="mt-3 text-sm text-ps-text-sec">
        {t('landing.coming_soon_desc')}
      </p>
      <Link
        href="/wc/rules"
        className="mt-6 inline-block text-xs text-ps-text-sec underline-offset-2 hover:text-ps-text hover:underline"
      >
        {t('landing.see_rules')}
      </Link>
    </div>
  );
}
