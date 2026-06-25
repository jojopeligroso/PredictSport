import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createWorldCupCompetition } from "@/lib/tournament/create-world-cup-competition";
import { requireDisplayName } from "@/lib/require-display-name";

/**
 * POST /api/wc/admin/create
 * Create a World Cup 2026 competition. Only one can exist.
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

  // Only super admin can create (no competition exists yet to check membership)
  const { data: profile } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return NextResponse.json(
      { error: "Super admin access required to create" },
      { status: 403 }
    );
  }

  // Check no WC competition exists already
  const { data: existing } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A World Cup competition already exists" },
      { status: 409 }
    );
  }

  let body: { name: string; visibility: "public" | "private"; enabledClassifications?: string[]; groupDrawHoursBefore?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (body.visibility !== "public" && body.visibility !== "private") {
    return NextResponse.json({ error: "Visibility must be public or private" }, { status: 400 });
  }

  try {
    // Use service client: RLS now restricts competition_members INSERT
    // to role='participant' — admin self-insert requires service role (C2 fix)
    const svc = createServiceClient();
    const result = await createWorldCupCompetition(svc, user.id, {
      name: body.name.trim(),
      visibility: body.visibility,
      entrantCount: 12, // Default estimate — curve recalculated at PW1 lock
      maxEntrants: 48,
      minEntrants: 8,
      groupDrawHoursBefore: body.groupDrawHoursBefore ?? 24,
      enabledClassifications: body.enabledClassifications,
    });

    return NextResponse.json({
      competition_id: result.competition.id,
      classifications: result.classifications.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create competition" },
      { status: 500 }
    );
  }
}
