import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmTournamentResult } from "@/lib/tournament/finalisation";

/**
 * POST /api/tournament/confirm-result
 * Confirm a fixture result for a tournament competition (super admin only).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { event_id: string; result_data: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.event_id || !body.result_data) {
    return NextResponse.json(
      { error: "event_id and result_data are required" },
      { status: 400 }
    );
  }

  try {
    const result = await confirmTournamentResult(
      supabase,
      body.event_id,
      body.result_data,
      user.id
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("super admin") ? 403 : message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
