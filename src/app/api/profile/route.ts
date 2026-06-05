import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateDisplayName } from "@/lib/display-name";

// Display-name change cooldown. Set to 0 to effectively disable.
// Infrastructure kept for future tightening if abuse emerges.
const COOLDOWN_MS = 0;

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
    const error = validateDisplayName(name);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    body.display_name = name;
  }

  // Build update object with only provided fields.
  // display_name_updated_at is resolved below after the cooldown check.
  const update: Record<string, unknown> = {};
  if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url;
  if (body.notification_prefs !== undefined)
    update.notification_prefs = body.notification_prefs;
  if (body.favourite_team !== undefined)
    update.favourite_team = body.favourite_team;

  // Cooldown check — runs only when a display_name change is requested
  if (body.display_name !== undefined) {
    const { data: currentProfile, error: fetchError } = await supabase
      .from("users")
      .select("display_name, display_name_updated_at")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch current profile" },
        { status: 500 }
      );
    }

    const currentName: string = currentProfile?.display_name ?? "";
    const updatedAt: string | null = currentProfile?.display_name_updated_at ?? null;
    const newName = body.display_name;

    if (!currentName) {
      // Initial set — allow without writing a timestamp
      update.display_name = newName;
    } else if (newName === currentName) {
      // No change — omit from update entirely
    } else if (updatedAt === null) {
      // First change from a non-empty name — allow and record timestamp
      update.display_name = newName;
      update.display_name_updated_at = new Date().toISOString();
    } else {
      const lastChanged = new Date(updatedAt);
      const now = new Date();
      const elapsed = now.getTime() - lastChanged.getTime();

      if (elapsed < COOLDOWN_MS) {
        const nextChangeDate = new Date(lastChanged.getTime() + COOLDOWN_MS);
        return NextResponse.json(
          {
            error: `You can change your name again on ${nextChangeDate.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}`,
            next_change_date: nextChangeDate.toISOString(),
          },
          { status: 429 }
        );
      }

      // Cooldown has passed — allow and record timestamp
      update.display_name = newName;
      update.display_name_updated_at = new Date().toISOString();
    }
  }

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
