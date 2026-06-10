/**
 * /wc/join-open — Auto-join the WC shell competition after auth.
 *
 * Server component. Redirects unauthenticated users to login. For authenticated
 * users, finds the WC shell competition and joins them directly (no invite code),
 * then redirects to /wc/home with onboarding.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enrollEntrant } from "@/lib/tournament/classification-engine";
import { requireDisplayName } from "@/lib/require-display-name";

export const dynamic = "force-dynamic";

export default async function WcJoinOpenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/join-open");
  }

  // Find the WC shell competition
  const { data: comp } = await supabase
    .from("competitions")
    .select("id, entry_closes_at")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["draft", "active"])
    .single();

  if (!comp) {
    redirect("/wc");
  }

  // Check entry cutoff
  if (comp.entry_closes_at && new Date(comp.entry_closes_at) < new Date()) {
    redirect("/wc");
  }

  // Check display name — if missing, redirect to home which has the onboarding flow
  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) {
    // User needs a display name — the home page onboarding handles this
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", comp.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    // Join the competition
    await supabase.from("competition_members").insert({
      competition_id: comp.id,
      user_id: user.id,
      role: "participant",
    });

    // Enroll in classifications
    await enrollEntrant(supabase, comp.id, user.id);
  }

  redirect("/wc/home?onboarding=true");
}
