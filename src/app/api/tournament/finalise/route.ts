import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finaliseWindow, finaliseStage } from "@/lib/tournament/finalisation";

/**
 * POST /api/tournament/finalise
 * Finalise a prediction window or sporting stage (super admin only).
 * Body: { type: 'window' | 'stage', id: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type: "window" | "stage"; id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.type || !body.id) {
    return NextResponse.json(
      { error: "type ('window' or 'stage') and id are required" },
      { status: 400 }
    );
  }

  try {
    let finalisation;
    if (body.type === "window") {
      finalisation = await finaliseWindow(supabase, body.id, user.id);
    } else if (body.type === "stage") {
      finalisation = await finaliseStage(supabase, body.id, user.id);
    } else {
      return NextResponse.json(
        { error: "type must be 'window' or 'stage'" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, finalisation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("super admin") ? 403 : message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
