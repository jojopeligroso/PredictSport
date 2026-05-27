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

interface DeleteMemberBody {
  competition_id: string;
  member_user_id: string;
}

/**
 * DELETE /api/admin/members
 * Remove a member from a competition.
 * Only admin/co_admin can remove members.
 * Cannot remove self, the competition creator, or any member after PW1 has locked.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DeleteMemberBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id || !body.member_user_id) {
    return NextResponse.json(
      { error: "competition_id and member_user_id are required" },
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

  // Cannot remove self
  if (body.member_user_id === user.id) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the competition" },
      { status: 400 }
    );
  }

  // Cannot remove the competition creator
  const { data: competition } = await supabase
    .from("competitions")
    .select("created_by")
    .eq("id", body.competition_id)
    .single();

  if (competition?.created_by === body.member_user_id) {
    return NextResponse.json(
      { error: "Cannot remove the competition creator" },
      { status: 400 }
    );
  }

  // Check PW1 lock: if round 1 is locked, scored, or its lock_time is in the past
  const { data: round1 } = await supabase
    .from("rounds")
    .select("status, lock_time")
    .eq("competition_id", body.competition_id)
    .eq("round_number", 1)
    .single();

  if (round1) {
    const isStatusLocked =
      round1.status === "locked" || round1.status === "scored";
    const isLockTimePast =
      round1.lock_time !== null && new Date(round1.lock_time) <= new Date();

    if (isStatusLocked || isLockTimePast) {
      return NextResponse.json(
        { error: "Cannot remove entrants after PW1 has locked" },
        { status: 400 }
      );
    }
  }

  // Delete from classification_memberships
  const { error: classificationError } = await supabase
    .from("classification_memberships")
    .delete()
    .eq("competition_id", body.competition_id)
    .eq("user_id", body.member_user_id);

  if (classificationError) {
    return NextResponse.json(
      {
        error: "Failed to remove member from classifications",
        details: classificationError.message,
      },
      { status: 500 }
    );
  }

  // Delete from competition_members
  const { error: memberError } = await supabase
    .from("competition_members")
    .delete()
    .eq("competition_id", body.competition_id)
    .eq("user_id", body.member_user_id);

  if (memberError) {
    return NextResponse.json(
      {
        error: "Failed to remove member from competition",
        details: memberError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

interface UpdateCalloutBody {
  competition_id: string;
  member_user_id: string;
  callout_label: string | null;
}

/**
 * PUT /api/admin/members
 * Update a member's callout label in a competition.
 * Only admin/co_admin can update callout labels.
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpdateCalloutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id || !body.member_user_id) {
    return NextResponse.json(
      { error: "competition_id and member_user_id are required" },
      { status: 400 }
    );
  }

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

  const { data: updated, error } = await supabase
    .from("competition_members")
    .update({ callout_label: body.callout_label })
    .eq("competition_id", body.competition_id)
    .eq("user_id", body.member_user_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update callout label", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ member: updated });
}
