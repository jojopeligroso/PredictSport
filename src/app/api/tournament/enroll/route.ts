import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, status, entry_closes_at")
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

  // Check if already a member
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Already enrolled in this competition" },
      { status: 409 }
    );
  }

  // Add as participant
  const { error: memberError } = await supabase
    .from("competition_members")
    .insert({
      competition_id: competitionId,
      user_id: user.id,
      role: "participant",
    });

  if (memberError) {
    return NextResponse.json(
      { error: "Failed to join competition" },
      { status: 500 }
    );
  }

  // Get all active classifications
  const { data: classifications } = await supabase
    .from("classifications")
    .select("id")
    .eq("competition_id", competitionId)
    .in("status", ["active", "draft"]);

  if (classifications && classifications.length > 0) {
    const membershipRows = classifications.map((c: { id: string }) => ({
      classification_id: c.id,
      competition_id: competitionId,
      user_id: user.id,
      status: "active",
    }));

    const { error: membershipError } = await supabase
      .from("classification_memberships")
      .insert(membershipRows);

    if (membershipError) {
      // Non-fatal: they're still a competition member
      console.error("Failed to create classification memberships:", membershipError.message);
    }
  }

  return NextResponse.json({ success: true, enrolled: true }, { status: 201 });
}
