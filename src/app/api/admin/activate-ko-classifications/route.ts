import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCompetitionAdmin } from "@/lib/admin";
import { requireDisplayName } from "@/lib/require-display-name";

/**
 * POST /api/admin/activate-ko-classifications
 *
 * Activates the knockout_bracket and r32_pick classifications for a
 * competition, making them visible on the leaderboard.
 *
 * Body: { competition_id: string }
 *
 * This is a dormant endpoint — not scheduled as a Vercel cron.
 * Admin triggers it manually when the knockout stage is ready.
 * To schedule later, add to vercel.json crons:
 *   { "path": "/api/admin/activate-ko-classifications", "schedule": "..." }
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

  let body: { competition_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.competition_id) {
    return NextResponse.json({ error: "competition_id required" }, { status: 400 });
  }

  const isAdmin = await verifyCompetitionAdmin(supabase, user.id, body.competition_id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Not a competition admin" }, { status: 403 });
  }

  const koKeys = ["knockout_bracket", "r32_pick"];

  const { data: updated, error } = await supabase
    .from("classifications")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("competition_id", body.competition_id)
    .in("classification_key", koKeys)
    .eq("status", "draft")
    .select("classification_key, status");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    activated: (updated ?? []).map((c) => c.classification_key),
  });
}
