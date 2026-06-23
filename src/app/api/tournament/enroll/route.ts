import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDisplayName } from "@/lib/require-display-name";
import {
  joinCompetitionWithCap,
  CompetitionFullError,
} from "@/lib/tournament/cap-aware-join";

/**
 * POST /api/tournament/enroll
 * Join a World Cup prediction game. Creates competition_member + all classification_memberships.
 * Body: { competition_id: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  let body: { competition_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id) {
    return NextResponse.json(
      { error: "competition_id is required" },
      { status: 400 }
    );
  }

  const competitionId = body.competition_id;

  // Verify competition exists and is accepting entries
  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .select("id, status, entry_closes_at, max_entrants, tournament_id, instance_type")
    .eq("id", competitionId)
    .single();

  if (compError || !competition) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  if (competition.status !== "active") {
    return NextResponse.json(
      { error: "Competition is not accepting entries" },
      { status: 403 }
    );
  }

  // Check entry deadline
  if (competition.entry_closes_at && new Date(competition.entry_closes_at) < new Date()) {
    return NextResponse.json(
      { error: "Entry deadline has passed" },
      { status: 403 }
    );
  }

  const svc = createServiceClient();
  let resolvedId = competitionId;

  // Fast-path cap pre-check: route overflow to the next instance before insert.
  // Service client bypasses RLS so a non-member gets an accurate count.
  if (competition.max_entrants) {
    const { count } = await svc
      .from("competition_members")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId);

    if ((count ?? 0) >= competition.max_entrants) {
      if (competition.tournament_id) {
        const { findOrProvisionInstance } = await import("@/lib/tournament/auto-provision");
        resolvedId = await findOrProvisionInstance(
          svc,
          competition.tournament_id,
          (competition.instance_type as "full" | "knockout_only") ?? "full",
          user.id
        );
      } else {
        return NextResponse.json({ error: "Competition is full" }, { status: 403 });
      }
    }
  }

  // Check if already a member of the resolved instance
  const { data: existing } = await svc
    .from("competition_members")
    .select("id")
    .eq("competition_id", resolvedId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Already enrolled in this competition" },
      { status: 409 }
    );
  }

  // Insert — the DB cap trigger is the race-proof backstop; the helper
  // auto-provisions and retries if the instance filled concurrently.
  try {
    const result = await joinCompetitionWithCap(svc, resolvedId, user.id, {
      tournamentId: competition.tournament_id,
      instanceType: (competition.instance_type as "full" | "knockout_only") ?? "full",
    });
    resolvedId = result.competitionId;
  } catch (err) {
    if (err instanceof CompetitionFullError) {
      return NextResponse.json({ error: "Competition is full" }, { status: 403 });
    }
    console.error("Failed to join competition:", err);
    return NextResponse.json(
      { error: "Failed to join competition" },
      { status: 500 }
    );
  }

  // Get all active classifications for the resolved instance
  const { data: classifications } = await svc
    .from("classifications")
    .select("id")
    .eq("competition_id", resolvedId)
    .in("status", ["active", "draft"]);

  if (classifications && classifications.length > 0) {
    const membershipRows = classifications.map((c: { id: string }) => ({
      classification_id: c.id,
      competition_id: resolvedId,
      user_id: user.id,
      status: "active",
    }));

    const { error: membershipError } = await svc
      .from("classification_memberships")
      .insert(membershipRows);

    if (membershipError) {
      // Non-fatal: they're still a competition member
      console.error("Failed to create classification memberships:", membershipError.message);
    }
  }

  return NextResponse.json(
    { success: true, enrolled: true, competition_id: resolvedId },
    { status: 201 }
  );
}
