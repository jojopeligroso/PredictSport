import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTagDefinition } from "@/lib/reputation/tag-catalogue";
import type { MemberTag } from "@/types/database";

/**
 * GET /api/tournament/my-tag?competitionId=X
 *
 * Returns the current user's active reputation tag for the given competition.
 * Only returns behavioural and engagement_pressure tags (not event_driven,
 * which are ephemeral chat announcements).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json(
      { error: "competitionId is required" },
      { status: 400 },
    );
  }

  // Fetch the user's most recent active tag (behavioural or engagement_pressure)
  const { data: tagRow, error } = await supabase
    .from("member_tags")
    .select("*")
    .eq("user_id", user.id)
    .eq("competition_id", competitionId)
    .in("status", ["active"])
    .in("tag_category", ["behavioural", "engagement_pressure"])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[my-tag] Query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!tagRow) {
    return NextResponse.json({ tag: null });
  }

  const tag = tagRow as MemberTag;
  const definition = getTagDefinition(tag.tag_name);

  if (!definition) {
    return NextResponse.json({ tag: null });
  }

  return NextResponse.json({
    tag,
    definition: {
      name: definition.name,
      layer1: definition.layer1,
      layer2: definition.layer2,
      factCard: definition.factCard,
      visual: definition.visual,
      rejectable: definition.rejectable,
      category: definition.category,
    },
  });
}
