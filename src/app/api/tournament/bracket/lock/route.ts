import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lock all bracket submissions for a classification.
 * Called by cron or super admin when the bracket lock deadline passes.
 * POST body: { classificationId: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check super admin
  const { data: profile } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: "Super admin required" }, { status: 403 });
  }

  const { classificationId } = await request.json();

  if (!classificationId) {
    return NextResponse.json({ error: "classificationId required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Lock all submitted (non-superseded, non-locked) bracket submissions
  const { data: locked, error } = await supabase
    .from("bracket_prediction_submissions")
    .update({ status: "locked", locked_at: now })
    .eq("classification_id", classificationId)
    .eq("status", "submitted")
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    lockedCount: locked?.length ?? 0,
    lockedAt: now,
  });
}
