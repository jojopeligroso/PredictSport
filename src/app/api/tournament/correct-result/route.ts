import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { correctResult } from "@/lib/tournament/corrections";
import { requireDisplayName } from "@/lib/require-display-name";

/**
 * POST /api/tournament/correct-result
 * Emergency result correction (super admin only).
 * Body: { finalisation_id, event_id, new_result, reason }
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

  let body: {
    finalisation_id: string;
    event_id: string;
    new_result: Record<string, unknown>;
    reason: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.finalisation_id || !body.event_id || !body.new_result || !body.reason) {
    return NextResponse.json(
      { error: "finalisation_id, event_id, new_result, and reason are required" },
      { status: 400 }
    );
  }

  try {
    // H1: batch_score_predictions revoked from authenticated — use service client
    const svc = createServiceClient();
    const correction = await correctResult(
      svc,
      body.finalisation_id,
      body.event_id,
      body.new_result,
      body.reason,
      user.id
    );

    return NextResponse.json({ success: true, correction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("super admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
