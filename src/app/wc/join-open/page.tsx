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
import { joinCompetitionWithCap, CompetitionFullError } from "@/lib/tournament/cap-aware-join";
import { requireDisplayName } from "@/lib/require-display-name";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";

export const dynamic = "force-dynamic";

export default async function WcJoinOpenPage() {
  // Step 1: Check if user is already in a WC instance → redirect to /wc/home
  const { competition: existingComp, user, isMember } = await resolveWcCompetition({
    statuses: ["draft", "active"],
  });

  if (!user) {
    redirect("/login?next=/wc/join-open");
  }

  if (isMember && existingComp) {
    redirect("/wc/home");
  }

  // For non-members, find the first public instance to join (fallback path of resolver)
  const supabase = await createClient();
  const svc = createServiceClient();

  const comp = existingComp;
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
  const instanceType =
    comp.instance_type === "full" || comp.instance_type === "knockout_only"
      ? comp.instance_type
      : "full";

  if (comp.max_entrants) {
    const { count } = await svc
      .from("competition_members")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", comp.id);

    if ((count ?? 0) >= comp.max_entrants) {
      if (comp.tournament_id) {
        // Tournament instance full — find or create a new one
        try {
          competitionId = await findOrProvisionInstance(
            svc,
            comp.tournament_id,
            instanceType,
            user.id
          );
        } catch (err) {
          console.error("[join-open] Auto-provision failed:", (err as Error).message);
          redirect("/wc");
        }
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
    // Join the competition. The DB cap trigger backstops the pre-check above:
    // if the instance filled via a concurrent join, the helper provisions/finds
    // the next instance and retries, so competitionId may change here.
    try {
      const joinResult = await joinCompetitionWithCap(svc, competitionId, user.id, {
        tournamentId: comp.tournament_id,
        instanceType,
      });
      competitionId = joinResult.competitionId;
    } catch (err) {
      if (err instanceof CompetitionFullError) {
        redirect("/wc");
      }
      throw err;
    }

    // Enroll in classifications (idempotent)
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
