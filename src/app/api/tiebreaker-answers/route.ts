import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDisplayName } from "@/lib/require-display-name";

interface SubmitAnswerBody {
  tiebreaker_id: string;
  value: number;
}

/**
 * POST /api/tiebreaker-answers
 * Submit or update a tiebreaker answer. User must be a member
 * of the competition that owns the tiebreaker.
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

  let body: SubmitAnswerBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.tiebreaker_id || typeof body.value !== "number") {
    return NextResponse.json(
      { error: "tiebreaker_id and numeric value are required" },
      { status: 400 },
    );
  }

  // Fetch the tiebreaker to get competition_id
  const { data: tiebreaker, error: tbError } = await supabase
    .from("tiebreakers")
    .select("id, competition_id")
    .eq("id", body.tiebreaker_id)
    .single();

  if (tbError || !tiebreaker) {
    return NextResponse.json({ error: "Tiebreaker not found" }, { status: 404 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", tiebreaker.competition_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this competition" },
      { status: 403 },
    );
  }

  // Upsert the answer
  const { data: answer, error } = await supabase
    .from("tiebreaker_answers")
    .upsert(
      {
        tiebreaker_id: body.tiebreaker_id,
        user_id: user.id,
        value: body.value,
      },
      { onConflict: "tiebreaker_id,user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to save answer", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ answer });
}
