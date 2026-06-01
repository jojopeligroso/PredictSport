import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDisplayName } from "@/lib/require-display-name";

interface SubmitNominationBody {
  competition_id: string;
  event_name: string;
  sport: string;
  proposed_date: string;
  proposed_prediction_type?: string;
}

/**
 * POST /api/nominations
 * Submit an event nomination as a competition member.
 * Requires competition.allow_nominations = true.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  let body: SubmitNominationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id || !body.event_name?.trim() || !body.sport || !body.proposed_date) {
    return NextResponse.json(
      { error: "competition_id, event_name, sport, and proposed_date are required" },
      { status: 400 },
    );
  }

  // Verify user is a member of the competition
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", body.competition_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this competition" },
      { status: 403 },
    );
  }

  // Verify competition allows nominations
  const { data: competition } = await supabase
    .from("competitions")
    .select("allow_nominations")
    .eq("id", body.competition_id)
    .single();

  if (!competition?.allow_nominations) {
    return NextResponse.json(
      { error: "This competition does not accept nominations" },
      { status: 403 },
    );
  }

  const { data: nomination, error } = await supabase
    .from("event_nominations")
    .insert({
      competition_id: body.competition_id,
      nominated_by: user.id,
      event_name: body.event_name.trim(),
      sport: body.sport,
      proposed_date: body.proposed_date,
      proposed_prediction_type: body.proposed_prediction_type ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to submit nomination", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ nomination }, { status: 201 });
}

/**
 * GET /api/nominations?competition_id=X
 * List nominations for a competition (visible to all members).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const competitionId = searchParams.get("competition_id");

  if (!competitionId) {
    return NextResponse.json({ error: "competition_id is required" }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: nominations, error } = await supabase
    .from("event_nominations")
    .select("*, nominator:users!event_nominations_nominated_by_fkey(display_name)")
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch nominations", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ nominations });
}
