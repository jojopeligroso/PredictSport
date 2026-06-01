import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensurePseudonym } from "@/lib/tournament/visibility";
import { requireDisplayName } from "@/lib/require-display-name";

/**
 * POST /api/tournament/visibility
 *
 * Body: { classificationId: string, visibility: "public" | "private" }
 *
 * Toggles the caller's display visibility on a single classification.
 * Format (`classification_type === 'format_elimination'`) rejects the toggle
 * — the survival ladder needs real names. Switching to private generates a
 * stable Mystery {Animal} pseudonym on first call and reuses it forever.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nameGuard = await requireDisplayName(supabase, user.id);
  if (nameGuard) return nameGuard;

  let body: { classificationId?: string; visibility?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { classificationId, visibility } = body;
  if (!classificationId || (visibility !== "public" && visibility !== "private")) {
    return NextResponse.json(
      { error: "classificationId and visibility ('public'|'private') required" },
      { status: 400 },
    );
  }

  const { data: classification } = await supabase
    .from("classifications")
    .select("id, classification_type")
    .eq("id", classificationId)
    .maybeSingle();

  if (!classification) {
    return NextResponse.json({ error: "Classification not found" }, { status: 404 });
  }

  if (classification.classification_type === "format_elimination") {
    return NextResponse.json(
      { error: "Format is always public — it's the survival ladder." },
      { status: 409 },
    );
  }

  const { data: membership } = await supabase
    .from("classification_memberships")
    .select("id")
    .eq("classification_id", classificationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "You aren't enrolled in this classification" },
      { status: 403 },
    );
  }

  let pseudonym: string | null = null;
  if (visibility === "private") {
    pseudonym = await ensurePseudonym(supabase, classificationId, user.id);
  }

  const { error: updateError } = await supabase
    .from("classification_memberships")
    .update({ display_visibility: visibility })
    .eq("classification_id", classificationId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update visibility" }, { status: 500 });
  }

  return NextResponse.json({ visibility, pseudonym });
}
