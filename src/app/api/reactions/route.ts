import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDisplayName } from "@/lib/require-display-name";

interface ReactionRequestBody {
  prediction_id?: string;
  emoji?: string;
}

export async function POST(request: NextRequest) {
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

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  let body: ReactionRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { prediction_id, emoji } = body;

  if (!prediction_id || !emoji) {
    return NextResponse.json(
      { error: "Missing required fields: prediction_id, emoji" },
      { status: 400 }
    );
  }

  // Upsert: toggle reaction (if exists, remove it; if not, add it)
  const { data: existing } = await supabase
    .from("prediction_reactions")
    .select("id")
    .eq("prediction_id", prediction_id)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    // Remove the reaction
    const { error: deleteError } = await supabase
      .from("prediction_reactions")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to remove reaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({ removed: true, emoji });
  }

  // Add the reaction
  const { data: created, error: insertError } = await supabase
    .from("prediction_reactions")
    .insert({
      prediction_id,
      user_id: user.id,
      emoji,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to add reaction" },
      { status: 500 }
    );
  }

  return NextResponse.json({ reaction: created }, { status: 201 });
}
