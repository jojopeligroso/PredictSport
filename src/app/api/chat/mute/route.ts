import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MUTE_DURATION_MINUTES = 15;

const ROLE_RANK: Record<string, number> = {
  participant: 0,
  mod: 1,
  co_admin: 2,
  admin: 3,
};

/**
 * POST /api/chat/mute
 * Mute a user in a competition chat for 15 minutes.
 * Body: { competitionId, userId }
 * Hierarchy: admin/co_admin can mute mod/participant; mod can mute participant only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { competitionId: string; userId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competitionId || !body.userId) {
    return NextResponse.json(
      { error: "competitionId and userId are required" },
      { status: 400 }
    );
  }

  if (body.userId === user.id) {
    return NextResponse.json(
      { error: "You cannot mute yourself" },
      { status: 400 }
    );
  }

  // Get actor's membership
  const { data: actorMembership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", body.competitionId)
    .eq("user_id", user.id)
    .single();

  if (!actorMembership) {
    return NextResponse.json(
      { error: "Not a member of this competition" },
      { status: 403 }
    );
  }

  const actorRank = ROLE_RANK[actorMembership.role] ?? 0;
  if (actorRank < ROLE_RANK.mod) {
    return NextResponse.json(
      { error: "Insufficient permissions to mute users" },
      { status: 403 }
    );
  }

  // Get target's membership
  const { data: targetMembership } = await supabase
    .from("competition_members")
    .select("role")
    .eq("competition_id", body.competitionId)
    .eq("user_id", body.userId)
    .single();

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Target user is not a member of this competition" },
      { status: 404 }
    );
  }

  const targetRank = ROLE_RANK[targetMembership.role] ?? 0;
  if (targetRank >= actorRank) {
    return NextResponse.json(
      { error: "Cannot mute users of equal or higher role" },
      { status: 403 }
    );
  }

  const mutedUntil = new Date(
    Date.now() + MUTE_DURATION_MINUTES * 60 * 1000
  ).toISOString();

  const { error } = await supabase
    .from("competition_members")
    .update({ chat_muted_until: mutedUntil })
    .eq("competition_id", body.competitionId)
    .eq("user_id", body.userId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to mute user", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ muted_until: mutedUntil });
}
