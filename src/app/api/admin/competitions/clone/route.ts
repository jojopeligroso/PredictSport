import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { requireDisplayName } from "@/lib/require-display-name";

/**
 * POST /api/admin/competitions/clone
 *
 * Clone a completed or archived competition into a new draft.
 * Copies: name (with season suffix), type, visibility, scoring_rules,
 * lock_default_minutes, allow_nominations, min_rounds_required,
 * allow_prediction_updates. Also copies all members with their roles.
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

  let body: { competition_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id) {
    return NextResponse.json(
      { error: "competition_id is required" },
      { status: 400 },
    );
  }

  // Verify caller is admin of the source competition
  const member = await verifyCompetitionAdmin(supabase, user.id, body.competition_id);
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 },
    );
  }

  // Fetch source competition
  const { data: source, error: fetchError } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", body.competition_id)
    .single();

  if (fetchError || !source) {
    return NextResponse.json(
      { error: "Competition not found" },
      { status: 404 },
    );
  }

  if (source.status !== "completed" && source.status !== "archived") {
    return NextResponse.json(
      { error: "Only completed or archived competitions can be cloned" },
      { status: 400 },
    );
  }

  // Generate new name with season suffix
  const newName = nextSeasonName(source.name);

  // Create new competition in draft
  const { data: newComp, error: createError } = await supabase
    .from("competitions")
    .insert({
      name: newName,
      description: source.description,
      type: source.type,
      visibility: source.visibility,
      status: "draft",
      scoring_rules: source.scoring_rules,
      lock_default_minutes: source.lock_default_minutes,
      allow_nominations: source.allow_nominations,
      min_rounds_required: source.min_rounds_required,
      allow_prediction_updates: source.allow_prediction_updates,
      created_by: user.id,
    })
    .select()
    .single();

  if (createError || !newComp) {
    return NextResponse.json(
      { error: "Failed to create new competition", details: createError?.message },
      { status: 500 },
    );
  }

  // Copy members from source (all roles preserved)
  const { data: members } = await supabase
    .from("competition_members")
    .select("user_id, role")
    .eq("competition_id", body.competition_id);

  if (members && members.length > 0) {
    const memberRows = members.map((m) => ({
      competition_id: newComp.id,
      user_id: m.user_id,
      role: m.role,
    }));

    const { error: membersError } = await supabase
      .from("competition_members")
      .insert(memberRows);

    if (membersError) {
      // Non-fatal — competition exists but members failed to copy
      console.error("[CLONE] Failed to copy members:", membersError.message);
    }
  }

  // Copy tiebreaker question if one existed
  const { data: tiebreaker } = await supabase
    .from("tiebreakers")
    .select("question_text")
    .eq("competition_id", body.competition_id)
    .maybeSingle();

  if (tiebreaker?.question_text) {
    await supabase.from("tiebreakers").insert({
      competition_id: newComp.id,
      question_text: tiebreaker.question_text,
    });
  }

  return NextResponse.json({ competition: newComp }, { status: 201 });
}

/**
 * Increment the season number in the competition name.
 * "Premier League Predictions" → "Premier League Predictions (Season 2)"
 * "Premier League Predictions (Season 2)" → "Premier League Predictions (Season 3)"
 */
function nextSeasonName(name: string): string {
  const match = name.match(/^(.*)\(Season (\d+)\)\s*$/);
  if (match) {
    const base = match[1].trimEnd();
    const nextNum = parseInt(match[2], 10) + 1;
    return `${base} (Season ${nextNum})`;
  }
  return `${name} (Season 2)`;
}
