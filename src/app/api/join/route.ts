import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // 3. Look up invite token
  const { data: invite, error: inviteError } = await supabase
    .from("invite_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: "Invalid invite link" },
      { status: 404 }
    );
  }

  // 4. Validate expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This invite link has expired" },
      { status: 410 }
    );
  }

  // 5. Validate max uses
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return NextResponse.json(
      { error: "This invite link has reached its maximum uses" },
      { status: 410 }
    );
  }

  // 6. Check if user already a member
  const { data: existing } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", invite.competition_id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Already a member - fetch competition name and return success
    const { data: comp } = await supabase
      .from("competitions")
      .select("name")
      .eq("id", invite.competition_id)
      .single();

    return NextResponse.json({
      competition_id: invite.competition_id,
      competition_name: comp?.name ?? "Competition",
      already_member: true,
    });
  }

  // 7. Insert into competition_members
  const { error: insertError } = await supabase
    .from("competition_members")
    .insert({
      competition_id: invite.competition_id,
      user_id: user.id,
      role: "participant",
    });

  if (insertError) {
    // Handle concurrent duplicate join gracefully
    if (insertError.code === "23505") {
      const { data: comp } = await supabase
        .from("competitions")
        .select("name")
        .eq("id", invite.competition_id)
        .single();

      return NextResponse.json({
        competition_id: invite.competition_id,
        competition_name: comp?.name ?? "Competition",
        already_member: true,
      });
    }
    console.error("Failed to join competition:", insertError);
    return NextResponse.json({ error: "Failed to join" }, { status: 500 });
  }

  // 8. Increment use_count atomically
  await supabase
    .from("invite_tokens")
    .update({ use_count: (invite.use_count ?? 0) + 1 })
    .eq("id", invite.id);

  // 9. Fetch competition name
  const { data: competition } = await supabase
    .from("competitions")
    .select("name")
    .eq("id", invite.competition_id)
    .single();

  return NextResponse.json({
    competition_id: invite.competition_id,
    competition_name: competition?.name ?? "Competition",
  });
}
