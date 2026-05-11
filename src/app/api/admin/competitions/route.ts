import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import type { CompetitionType, CompetitionVisibility, CompetitionStatus } from "@/types/database";

const VALID_TYPES: CompetitionType[] = ["fixed", "open"];
const VALID_VISIBILITY: CompetitionVisibility[] = ["public", "private"];

interface CreateCompetitionBody {
  name: string;
  description?: string;
  type: CompetitionType;
  visibility: CompetitionVisibility;
  scoring_rules: Record<string, unknown>;
  lock_default_minutes?: number;
  allow_nominations?: boolean;
  min_rounds_required?: number | null;
  allow_prediction_updates?: boolean;
  tiebreaker_question?: string;
}

/**
 * POST /api/admin/competitions
 * Create a new competition. The creator becomes its admin.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateCompetitionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Competition name is required" },
      { status: 400 }
    );
  }

  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: "Invalid competition type" },
      { status: 400 }
    );
  }

  if (body.visibility && !VALID_VISIBILITY.includes(body.visibility)) {
    return NextResponse.json(
      { error: "Invalid visibility setting" },
      { status: 400 }
    );
  }

  // Create competition
  const { data: competition, error: compError } = await supabase
    .from("competitions")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      type: body.type,
      visibility: body.visibility || "private",
      status: "draft",
      scoring_rules: body.scoring_rules || {},
      lock_default_minutes: body.lock_default_minutes ?? 5,
      allow_nominations: body.allow_nominations ?? true,
      min_rounds_required: body.min_rounds_required ?? null,
      allow_prediction_updates: body.allow_prediction_updates ?? true,
      created_by: user.id,
    })
    .select()
    .single();

  if (compError) {
    console.error("[CREATE COMPETITION]", compError.message, compError.code, compError.details);
    return NextResponse.json(
      { error: "Failed to create competition", details: compError.message, code: compError.code },
      { status: 500 }
    );
  }

  // Add creator as admin member
  const { error: memberError } = await supabase
    .from("competition_members")
    .insert({
      competition_id: competition.id,
      user_id: user.id,
      role: "admin",
    });

  if (memberError) {
    // Rollback: delete the competition if member creation fails
    await supabase.from("competitions").delete().eq("id", competition.id);
    return NextResponse.json(
      { error: "Failed to set up admin membership", details: memberError.message },
      { status: 500 }
    );
  }

  // Create tiebreaker if question provided
  if (body.tiebreaker_question?.trim()) {
    await supabase.from("tiebreakers").insert({
      competition_id: competition.id,
      question_text: body.tiebreaker_question.trim(),
    });
  }

  return NextResponse.json({ competition }, { status: 201 });
}

/**
 * DELETE /api/admin/competitions
 * Delete a competition and all related data (cascades).
 */
export async function DELETE(request: Request) {
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

  const { error: deleteError } = await supabase
    .from("competitions")
    .delete()
    .eq("id", body.competition_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete competition", details: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: body.competition_id });
}

const VALID_STATUSES: CompetitionStatus[] = ["draft", "active", "completed", "archived"];
const ALLOWED_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  draft: ["active"],
  active: ["completed"],
  completed: ["archived"],
  archived: [],
};

interface PatchBody {
  competition_id: string;
  status?: CompetitionStatus;
  name?: string;
  description?: string | null;
  visibility?: CompetitionVisibility;
  type?: CompetitionType;
  allow_nominations?: boolean;
  lock_default_minutes?: number;
}

/**
 * PATCH /api/admin/competitions
 * Two modes:
 * 1. Status transition — body contains `status`
 * 2. Field update — body does NOT contain `status`
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
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

  // ── Mode 1: Status transition ──
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Fetch current competition to validate transition
    const { data: competition } = await supabase
      .from("competitions")
      .select("status")
      .eq("id", body.competition_id)
      .single();

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 }
      );
    }

    const allowed = ALLOWED_TRANSITIONS[competition.status as CompetitionStatus] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${competition.status}' to '${body.status}'`,
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("competitions")
      .update({ status: body.status })
      .eq("id", body.competition_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update status", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ competition: updated });
  }

  // ── Mode 2: Field update ──

  // Fetch current competition to check status for type updates
  const { data: competition } = await supabase
    .from("competitions")
    .select("status")
    .eq("id", body.competition_id)
    .single();

  if (!competition) {
    return NextResponse.json(
      { error: "Competition not found" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Name must be a non-empty string" },
        { status: 400 }
      );
    }
    updates.name = body.name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    updates.description = typeof body.description === "string"
      ? body.description.trim() || null
      : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "visibility")) {
    if (!body.visibility || !VALID_VISIBILITY.includes(body.visibility)) {
      return NextResponse.json(
        { error: "Invalid visibility setting" },
        { status: 400 }
      );
    }
    updates.visibility = body.visibility;
  }

  if (Object.prototype.hasOwnProperty.call(body, "type")) {
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: "Invalid competition type" },
        { status: 400 }
      );
    }
    if (competition.status !== "draft") {
      return NextResponse.json(
        { error: "Competition type can only be changed while in draft status" },
        { status: 400 }
      );
    }
    updates.type = body.type;
  }

  if (Object.prototype.hasOwnProperty.call(body, "allow_nominations")) {
    updates.allow_nominations = Boolean(body.allow_nominations);
  }

  if (Object.prototype.hasOwnProperty.call(body, "lock_default_minutes")) {
    updates.lock_default_minutes = Number(body.lock_default_minutes);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("competitions")
    .update(updates)
    .eq("id", body.competition_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update competition", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ competition: updated });
}
