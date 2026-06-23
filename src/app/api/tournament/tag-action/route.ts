import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rejectTag } from "@/lib/reputation";

/**
 * POST /api/tournament/tag-action
 * Body: { tagId: string, action: "accept" | "reject" }
 *
 * Accept: no DB change (tag stays active). The user acknowledges it.
 * Reject: calls rejectTag() which updates status and posts a rejection
 *         one-liner to the competition chat.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tagId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tagId, action } = body;

  if (!tagId || !action) {
    return NextResponse.json(
      { error: "tagId and action are required" },
      { status: 400 },
    );
  }

  if (action !== "accept" && action !== "reject") {
    return NextResponse.json(
      { error: 'action must be "accept" or "reject"' },
      { status: 400 },
    );
  }

  // Verify the tag exists and belongs to the user
  const { data: tagRow, error: fetchError } = await supabase
    .from("member_tags")
    .select("id, user_id, status")
    .eq("id", tagId)
    .single();

  if (fetchError || !tagRow) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  if (tagRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (tagRow.status !== "active" && tagRow.status !== "pending") {
    return NextResponse.json(
      { error: "Tag cannot be acted on in current status" },
      { status: 409 },
    );
  }

  if (action === "reject") {
    await rejectTag(tagId, user.id);
  } else {
    // Accept: stamp accepted_at so CTAs disappear and auto-accept skips this tag
    const serviceClient = createServiceClient();
    await serviceClient
      .from("member_tags")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", tagId)
      .eq("status", "active");
  }

  return NextResponse.json({ ok: true, action });
}
