/**
 * /wc/join-open — Auto-join the WC shell competition after auth.
 *
 * Server component. Redirects unauthenticated users to login. For authenticated
 * users, finds the WC shell competition and joins them directly (no invite code),
 * then redirects to /wc/home with onboarding.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { enrollEntrant } from "@/lib/tournament/classification-engine";
import { addLateEntrant } from "@/lib/tournament/format/group-allocation";
import { findOrProvisionInstance } from "@/lib/tournament/auto-provision";
import { requireDisplayName } from "@/lib/require-display-name";

export const dynamic = "force-dynamic";

export default async function WcJoinOpenPage() {
  const supabase = await createClient();
  const svc = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wc/join-open");
  }

  // Find the WC shell competition
  const { data: comp } = await supabase
    .from("competitions")
    .select("id, entry_closes_at, max_entrants, tournament_id, instance_type")
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

  // Check display name — if missing, redirect to home which has the onboarding flow.
  // Home shows the DisplayNameModal; after setting a name the user can retry join-open.
  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) {
    redirect("/wc/home?onboarding=true&next=/wc/join-open");
  }

  // Resolve target competition — auto-provision if this instance is full
  let competitionId = comp.id;

  if (comp.max_entrants) {
    const { count } = await svc
      .from("competition_members")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", comp.id);

    if ((count ?? 0) >= comp.max_entrants) {
      if (comp.tournament_id) {
        // Tournament instance full — find or create a new one
        competitionId = await findOrProvisionInstance(
          svc,
          comp.tournament_id,
          (comp.instance_type as "full" | "knockout_only") ?? "full",
          user.id
        );
      } else {
        // Non-tournament shell with hard cap — competition is full
        redirect("/wc");
      }
    }
  }

  // Check if already a member (of the resolved competition)
  const { data: existing } = await svc
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    // Join the competition
    await svc.from("competition_members").insert({
      competition_id: competitionId,
      user_id: user.id,
      role: "participant",
    });

    // Enroll in classifications
    await enrollEntrant(svc, competitionId, user.id);

    // If format groups already drawn, slot this user into a group.
    const { data: formatCls } = await svc
      .from("classifications")
      .select("id")
      .eq("competition_id", competitionId)
      .eq("classification_type", "format_elimination")
      .eq("status", "active")
      .maybeSingle();

    if (formatCls) {
      const { data: existingGroups } = await svc
        .from("format_prediction_groups")
        .select("id")
        .eq("classification_id", formatCls.id)
        .limit(1);

      if (existingGroups && existingGroups.length > 0) {
        try {
          await addLateEntrant(svc, formatCls.id, user.id);
        } catch (err) {
          console.error("[join-open] Failed to add late entrant to group:", (err as Error).message);
        }
      }
    }
  }

  redirect("/wc/home?onboarding=true");
}
