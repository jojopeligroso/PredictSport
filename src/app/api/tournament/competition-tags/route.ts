import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTagDefinition } from "@/lib/reputation/tag-catalogue";
import type { MemberTag } from "@/types/database";

/**
 * GET /api/tournament/competition-tags?competitionId=X
 *
 * Returns all active behavioural/engagement_pressure tags for a competition.
 * One tag per user (most recent). Bounded by member count.
 *
 * Used by the leaderboard to show compact tag badges.
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

  // Fetch all active tags for this competition (bounded by member count, not 1000+)
  const { data: tagRows, error } = await supabase
    .from("member_tags")
    .select("*")
    .eq("competition_id", competitionId)
    .in("status", ["active"])
    .in("tag_category", ["behavioural", "engagement_pressure"])
    .order("assigned_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[competition-tags] Query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // Deduplicate: one tag per user (most recent)
  const byUser = new Map<string, MemberTag>();
  for (const row of (tagRows ?? []) as MemberTag[]) {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, row);
    }
  }

  // Build response with tag definitions + stats for expanded view
  const tags: Array<{
    userId: string;
    tagName: string;
    tagCategory: string;
    status: string;
    stats: Record<string, unknown>;
    definition: {
      layer1: string;
      layer2: string;
      factCard: { fact: string; statTemplate: string; contextTemplate: string };
      visual: { borderColor: string; gold?: boolean; opacity?: number };
    };
  }> = [];

  for (const tag of byUser.values()) {
    const def = getTagDefinition(tag.tag_name);
    if (!def) continue;

    tags.push({
      userId: tag.user_id,
      tagName: tag.tag_name,
      tagCategory: tag.tag_category,
      status: tag.status,
      stats: (tag.stats ?? {}) as Record<string, unknown>,
      definition: {
        layer1: def.layer1,
        layer2: def.layer2,
        factCard: {
          fact: def.factCard.fact,
          statTemplate: def.factCard.statTemplate,
          contextTemplate: def.factCard.contextTemplate,
        },
        visual: {
          borderColor: def.visual.borderColor,
          gold: def.visual.gold,
          opacity: def.visual.opacity,
        },
      },
    });
  }

  return NextResponse.json({ tags });
}
