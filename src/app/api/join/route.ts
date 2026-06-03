import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrollEntrant } from "@/lib/tournament/classification-engine";
import { requireDisplayName } from "@/lib/require-display-name";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in first" },
      { status: 401 }
    );
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  // 2. Parse body
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
  const { token } = body;

  if (!token) {
    return NextResponse.json(
      { error: "Invalid invite link" },
      { status: 404 }
    );
  }

  // 3. Look up invite — try invite_tokens first, then competitions.invite_code
  const trimmedToken = token.trim();

  const { data: invite } = await supabase
    .from("invite_tokens")
    .select("*")
    .eq("token", trimmedToken)
    .single();

  let competitionId: string;
  let isInviteToken = false;

  if (invite) {
    // Found in invite_tokens — validate expiry and max uses
    isInviteToken = true;
    competitionId = invite.competition_id;

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invite link has expired" },
        { status: 410 }
      );
    }

    if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
      return NextResponse.json(
        { error: "This invite link has reached its maximum uses" },
        { status: 410 }
      );
    }
  } else {
    // Not in invite_tokens — try competitions.invite_code (exact match, case-normalized)
    const { data: comp } = await supabase
      .from("competitions")
      .select("id")
      .eq("invite_code", trimmedToken.toLowerCase())
      .in("status", ["draft", "active"])
      .single();

    if (!comp) {
      return NextResponse.json(
        { error: "This code doesn't match any active competition" },
        { status: 404 }
      );
    }
    competitionId = comp.id;
  }

  // 4. Check if user already a member
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Already a member — ensure classification memberships exist (idempotent backfill)
    await enrollEntrant(supabase, competitionId, user.id);

    const { data: comp } = await supabase
      .from("competitions")
      .select("name")
      .eq("id", competitionId)
      .single();

    return NextResponse.json({
      competition_id: competitionId,
      competition_name: comp?.name ?? "Competition",
      already_member: true,
    });
  }

  // 5. Insert into competition_members
  const { error: insertError } = await supabase
    .from("competition_members")
    .insert({
      competition_id: competitionId,
      user_id: user.id,
      role: "participant",
    });

  if (insertError) {
    // Handle concurrent duplicate join gracefully
    if (insertError.code === "23505") {
      const { data: comp } = await supabase
        .from("competitions")
        .select("name")
        .eq("id", competitionId)
        .single();

      return NextResponse.json({
        competition_id: competitionId,
        competition_name: comp?.name ?? "Competition",
        already_member: true,
      });
    }
    console.error("Failed to join competition:", insertError);
    return NextResponse.json({ error: "Failed to join" }, { status: 500 });
  }

  // 6. Enroll in classifications (idempotent — no-op for non-tournament competitions)
  await enrollEntrant(supabase, competitionId, user.id);

  // 7. Increment use_count (only for invite_tokens, not permanent invite_codes)
  if (isInviteToken && invite) {
    await supabase
      .from("invite_tokens")
      .update({ use_count: (invite.use_count ?? 0) + 1 })
      .eq("id", invite.id);
  }

  // 8. Fetch competition name
  const { data: competition } = await supabase
    .from("competitions")
    .select("name")
    .eq("id", competitionId)
    .single();

  return NextResponse.json({
    competition_id: competitionId,
    competition_name: competition?.name ?? "Competition",
  });
}
