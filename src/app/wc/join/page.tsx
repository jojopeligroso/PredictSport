import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enrollEntrant } from "@/lib/tournament/classification-engine";

export const dynamic = "force-dynamic";

/**
 * /wc/join — Entry flow for World Cup prediction game.
 * If not logged in → redirect to login.
 * If logged in → auto-enroll in the WC competition → redirect onward.
 *
 * Accepts an optional `?next=` param so other WC pages (e.g. a pick window)
 * can route a non-member here for idempotent enrollment and get them back.
 * `next` is validated to an internal /wc path to avoid an open redirect.
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
    .select("id")
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

  // Check if already enrolled as competition member
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competition.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    // Create competition membership
    await supabase
      .from("competition_members")
      .insert({
        competition_id: competition.id,
        user_id: user.id,
        role: "participant",
      });
  }

  // Enroll in all active classifications (idempotent — handles duplicates)
  await enrollEntrant(supabase, competition.id, user.id);

  redirect(destination);
}
