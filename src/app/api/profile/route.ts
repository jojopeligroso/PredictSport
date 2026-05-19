import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ProfileUpdateBody {
  display_name?: string;
  avatar_url?: string | null;
  notification_prefs?: Record<string, unknown>;
  favourite_team?: { sport: string; team_name: string; provider_id: string | null } | null;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body: ProfileUpdateBody = await request.json();

  // Validate display_name
  if (body.display_name !== undefined) {
    const name = body.display_name.trim();
    if (name.length < 1 || name.length > 50) {
      return NextResponse.json(
        { error: "Display name must be 1-50 characters" },
        { status: 400 }
      );
    }
    body.display_name = name;
  }

  // Build update object with only provided fields
  const update: Record<string, unknown> = {};
  if (body.display_name !== undefined) update.display_name = body.display_name;
  if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url;
  if (body.notification_prefs !== undefined)
    update.notification_prefs = body.notification_prefs;
  if (body.favourite_team !== undefined)
    update.favourite_team = body.favourite_team;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: data });
}
