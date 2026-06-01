import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { requireDisplayName } from "@/lib/require-display-name";

interface CreateInviteBody {
  competition_id: string;
  expires_in_hours?: number;
  max_uses?: number;
}

/**
 * POST /api/admin/invite
 * Generate an invite token for a competition.
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

  let body: CreateInviteBody;
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

  // Verify admin
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

  const expiresAt = body.expires_in_hours
    ? new Date(
        Date.now() + body.expires_in_hours * 60 * 60 * 1000
      ).toISOString()
    : null;

  const { data: invite, error } = await supabase
    .from("invite_tokens")
    .insert({
      competition_id: body.competition_id,
      created_by: user.id,
      expires_at: expiresAt,
      max_uses: body.max_uses ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create invite", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ invite }, { status: 201 });
}
