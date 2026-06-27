import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTagDefinition } from "@/lib/reputation/tag-catalogue";

/**
 * GET /api/tournament/competition-tags?competitionId=X
 *
 * Returns the active reputation tags for a competition, ready to render as
 * pills on every leaderboard surface (overall standings, format/group view,
 * Rival Predictions).
 *
 * Per user we return at most:
 *  - one behavioural / engagement_pressure tag (the most recent active "title")
 *  - one event-driven tag (the most recent that hasn't expired)
 *
 * Persistence rules:
 *  - Behavioural tags are held like a title until another member earns the
 *    same tag (transfer is handled at publish time), so we simply surface
 *    whatever is currently `active`.
 *  - Event-driven tags are fleeting. Each one stays visible until the LATER of
 *    (a) 24h after it was earned, or (b) 45 minutes before the next fixture
 *    starts. We compute that expiry here at read time (no cron needed) and
 *    drop anything past it.
 */

/** Event-driven tags live at least this long after being earned. */
const EVENT_TAG_MIN_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** ...and otherwise until this long before the next fixture kicks off. */
const EVENT_TAG_PRE_FIXTURE_MS = 45 * 60 * 1000;

type ResponseTag = {
  userId: string;
  tagName: string;
  tagCategory: string;
  status: string;
  stats: Record<string, unknown>;
  expiresAt: string | null;
  definition: {
    layer1: string;
    layer2: string;
    factCard: { fact: string; statTemplate: string; contextTemplate: string };
    visual: { borderColor: string; gold?: boolean; opacity?: number };
  };
};

type TagRow = {
  user_id: string;
  tag_name: string;
  tag_category: string;
  status: string;
  stats: Record<string, unknown> | null;
  assigned_at: string;
};

function toResponseTag(tag: TagRow, expiresAt: string | null): ResponseTag | null {
  const def = getTagDefinition(tag.tag_name);
  if (!def) return null;
  return {
    userId: tag.user_id,
    tagName: tag.tag_name,
    tagCategory: tag.tag_category,
    status: tag.status,
    stats: (tag.stats ?? {}) as Record<string, unknown>,
    expiresAt,
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
  };
}

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

  // Fetch all active tags for this competition (bounded by member count).
  const { data: tagRows, error } = await supabase
    .from("member_tags")
    .select("user_id, tag_name, tag_category, status, stats, assigned_at")
    .eq("competition_id", competitionId)
    .eq("status", "active")
    .in("tag_category", ["behavioural", "engagement_pressure", "event_driven"])
    .order("assigned_at", { ascending: false })
    .limit(400);

  if (error) {
    console.error("[competition-tags] Query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const rows = (tagRows ?? []) as TagRow[];
  const hasEventTags = rows.some((r) => r.tag_category === "event_driven");

  // Fetch fixture start times only if we have event-driven tags to expire.
  let sortedStarts: number[] = [];
  if (hasEventTags) {
    const { data: eventRows } = await supabase
      .from("events")
      .select("start_time, status")
      .eq("competition_id", competitionId)
      .neq("status", "cancelled")
      .limit(1000);

    sortedStarts = (eventRows ?? [])
      .map((e) => new Date(e.start_time as string).getTime())
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }

  const now = Date.now();

  /**
   * Expiry for an event-driven tag: the LATER of (earned + 24h) and
   * (next fixture start − 45min). Falls back to the 24h floor when no
   * later fixture is scheduled.
   */
  const eventTagExpiry = (assignedAtIso: string): number => {
    const assignedAt = new Date(assignedAtIso).getTime();
    const floor = assignedAt + EVENT_TAG_MIN_LIFETIME_MS;
    const nextStart = sortedStarts.find((s) => s > assignedAt);
    if (nextStart === undefined) return floor;
    return Math.max(floor, nextStart - EVENT_TAG_PRE_FIXTURE_MS);
  };

  // One behavioural/engagement tag + one event-driven tag per user.
  const behaviouralByUser = new Map<string, ResponseTag>();
  const eventByUser = new Map<string, ResponseTag>();

  for (const tag of rows) {
    if (tag.tag_category === "event_driven") {
      if (eventByUser.has(tag.user_id)) continue;
      const expiry = eventTagExpiry(tag.assigned_at);
      if (now >= expiry) continue; // expired — hide from the board
      const built = toResponseTag(tag, new Date(expiry).toISOString());
      if (built) eventByUser.set(tag.user_id, built);
    } else {
      if (behaviouralByUser.has(tag.user_id)) continue;
      const built = toResponseTag(tag, null);
      if (built) behaviouralByUser.set(tag.user_id, built);
    }
  }

  const tags: ResponseTag[] = [
    ...behaviouralByUser.values(),
    ...eventByUser.values(),
  ];

  return NextResponse.json({ tags });
}
