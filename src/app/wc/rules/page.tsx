/**
 * /wc/rules — How the World Cup prediction game works.
 *
 * Server component. Handles auth, passes isMember and isAuthenticated
 * to the RulesContent client component which owns tabs and all rendering.
 */
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { WcBrandedTitle } from "@/components/wc/WcBrandedTitle";
import { RulesContent } from "@/components/wc/RulesContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rules — FIFA World Cup 2026",
  description:
    "How the World Cup 2026 prediction game works. Pick winners, guess scores, climb the leaderboard.",
};

export default async function WcRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isMember = false;
  if (user) {
    const { data } = await supabase
      .from("competition_members")
      .select("competition_id, competitions!inner(product_mode)")
      .eq("user_id", user.id)
      .eq("competitions.product_mode", "world_cup_2026_shell")
      .limit(1);
    isMember = (data ?? []).length > 0;
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6 pb-16">
      <WcBrandedTitle
        title="Rules"
        subtitle="Everything you need to know."
        backHref="/wc"
        backLabel="Back to World Cup"
        className="mb-8"
      />
      <RulesContent isMember={isMember} isAuthenticated={!!user} />
    </div>
  );
}
