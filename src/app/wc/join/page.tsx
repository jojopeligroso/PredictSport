import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enrollEntrant } from "@/lib/tournament/classification-engine";
import { JoinFlow } from "@/components/wc/JoinFlow";

export const dynamic = "force-dynamic";

/**
 * /wc/join — Entry flow for World Cup prediction game.
 * Shows display name confirmation before enrolling.
 * Enforces max_entrants cap.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination =
    next && next.startsWith("/wc/") ? next : "/wc/picks";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/wc/join?next=${destination}`)}`);
  }

  // Find the active WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, max_entrants, min_entrants")
    .eq("product_mode", "world_cup_2026_shell")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="font-display text-3xl uppercase tracking-tight text-ps-text">Coming Soon</h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          The World Cup 2026 prediction game is being set up. Check back soon.
        </p>
      </div>
    );
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competition.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Already enrolled — ensure classification memberships are up to date, then redirect
    await enrollEntrant(supabase, competition.id, user.id);
    redirect(destination);
  }

  // Check entrant cap
  const { count: memberCount } = await supabase
    .from("competition_members")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competition.id);

  if (competition.max_entrants && (memberCount ?? 0) >= competition.max_entrants) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <h1 className="font-display text-2xl uppercase tracking-tight text-ps-text">
          Competition Full
        </h1>
        <p className="mt-2 text-sm text-ps-text-sec">
          This competition has reached its maximum of {competition.max_entrants} entrants.
        </p>
      </div>
    );
  }

  // Fetch user profile for display name
  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <JoinFlow
      competitionId={competition.id}
      destination={destination}
      currentDisplayName={profile?.display_name ?? ""}
      maxEntrants={competition.max_entrants}
      currentCount={memberCount ?? 0}
    />
  );
}
