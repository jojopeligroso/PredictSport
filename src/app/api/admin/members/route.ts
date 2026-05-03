import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import type { UserRole } from "@/types/database";

interface UpdateMemberBody {
  competition_id: string;
  member_user_id: string;
  role: UserRole;
}

const VALID_ROLES: UserRole[] = ["admin", "co_admin", "participant"];

/**
 * PATCH /api/admin/members
 * Update a member's role in a competition.
 * Only admin/co_admin can promote/demote.
 * Cannot demote the original competition creator.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpdateMemberBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id || !body.member_user_id || !body.role) {
    return NextResponse.json(
      { error: "competition_id, member_user_id, and role are required" },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json(
      { error: "Invalid role. Must be admin, co_admin, or participant" },
      { status: 400 }
    );
  }

  // Verify the requester is an admin
  const member = await verifyCompetitionAdmin(
    supabase,
    user.id,
    body.competition_id
  );
  if (!member) {
    return NextResponse.json(
      { error: "You are not an admin of this competition" },
      { status: 403 }
    );
  }

  // Prevent self-demotion
  if (body.member_user_id === user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 }
    );
  }

  // Prevent demoting the original competition creator
  const { data: competition } = await supabase
    .from("competitions")
    .select("created_by")
    .eq("id", body.competition_id)
    .single();

  if (competition?.created_by === body.member_user_id && body.role !== "admin") {
    return NextResponse.json(
      { error: "Cannot demote the competition creator" },
      { status: 400 }
    );
  }

  // Update the role
  const { data: updated, error } = await supabase
    .from("competition_members")
    .update({ role: body.role })
    .eq("competition_id", body.competition_id)
    .eq("user_id", body.member_user_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update member role", details: error.message },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Member not found in this competition" },
      { status: 404 }
    );
  }

  return NextResponse.json({ member: updated });
}
