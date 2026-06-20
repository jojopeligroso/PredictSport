/**
 * /wc/rules — How the World Cup prediction game works.
 *
 * Server component. Handles auth + first lock time query,
 * passes props to the RulesContent client component.
 */
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";
import { RulesContent } from "@/components/wc/RulesContent";
import { getServerT } from "@/lib/i18n/server";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rules — FIFA World Cup 2026",
  description:
    "How the World Cup 2026 prediction game works. Pick winners, guess scores, climb the leaderboard.",
};

export default async function WcRulesPage() {
  const t = await getServerT();
  const { competition: wcComp, user, isMember } = await resolveWcCompetition({
    statuses: ["active", "draft"],
  });

  // Get earliest lock_time across WC matchday 1
  let firstLockTime: string | null = null;

  if (wcComp) {
    const supabase = await createClient();
    const { data: md1Round } = await supabase
      .from("rounds")
      .select("id")
      .eq("competition_id", wcComp.id)
      .eq("round_number", 1)
      .limit(1)
      .maybeSingle();

    if (md1Round) {
      const { data: firstEvent } = await supabase
        .from("events")
        .select("lock_time")
        .eq("round_id", md1Round.id)
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      firstLockTime = firstEvent?.lock_time ?? null;
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <WcBrandedTitle
        title={t('rules.page_title')}
        subtitle={t('rules.page_subtitle')}
        backHref="/wc"
        backLabel={t('nav.back_to_wc')}
        className="mb-8"
      />
      <RulesContent
        isMember={isMember}
        isAuthenticated={!!user}
        firstLockTime={firstLockTime}
      />
    </div>
  );
}
