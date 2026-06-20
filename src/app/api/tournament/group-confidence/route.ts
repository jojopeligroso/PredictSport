import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/tournament/group-confidence?event_id=X&competition_id=Y
 *
 * Returns the confidence level distribution for the current user's
 * prediction group on a specific event. Only returns data after
 * pick_reveal_at (or lock_time + 5min) to prevent herding.
 *
 * Response shape:
 * {
 *   totalPicks: number,
 *   distribution: [count_level_1, count_level_2, ..., count_level_5],
 *   highConfidenceCount: number  // levels 3-5
 * }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("event_id");
  const competitionId = request.nextUrl.searchParams.get("competition_id");

  if (!eventId || !competitionId) {
    return NextResponse.json(
      { error: "event_id and competition_id required" },
      { status: 400 },
    );
  }

  // 1. Check reveal gate — only show after pick_reveal_at
  const { data: event } = await supabase
    .from("events")
    .select("lock_time, pick_reveal_at")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const revealAt = event.pick_reveal_at
    ? new Date(event.pick_reveal_at)
    : new Date(new Date(event.lock_time).getTime() + 5 * 60_000);

  if (new Date() < revealAt) {
    return NextResponse.json({ error: "Not yet revealed" }, { status: 403 });
  }

  // 2. Find the user's prediction group
  const { data: formatCls } = await supabase
    .from("classifications")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("classification_key", "format")
    .maybeSingle();

  if (!formatCls) {
    return NextResponse.json({ error: "No format classification" }, { status: 404 });
  }

  // Find user's group membership
  const { data: myMembership } = await supabase
    .from("format_group_memberships")
    .select("group_id")
    .eq("classification_id", formatCls.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myMembership) {
    return NextResponse.json({ error: "Not in a group" }, { status: 404 });
  }

  // 3. Get all user_ids in the same group
  const svc = createServiceClient();
  const { data: groupMembers } = await svc
    .from("format_group_memberships")
    .select("user_id")
    .eq("group_id", myMembership.group_id)
    .limit(20);

  if (!groupMembers || groupMembers.length === 0) {
    return NextResponse.json({
      totalPicks: 0,
      distribution: [0, 0, 0, 0, 0],
      highConfidenceCount: 0,
    });
  }

  const memberUserIds = groupMembers.map((m) => m.user_id);

  // 4. Fetch confidence levels for all group members' winner predictions on this event
  const { data: predictions } = await svc
    .from("predictions")
    .select("confidence_level")
    .eq("event_id", eventId)
    .eq("prediction_type", "winner")
    .in("user_id", memberUserIds)
    .limit(50);

  // 5. Build distribution
  const distribution = [0, 0, 0, 0, 0]; // indices 0-4 = levels 1-5
  let totalPicks = 0;

  for (const p of predictions ?? []) {
    totalPicks++;
    const level = p.confidence_level;
    if (level && level >= 1 && level <= 5) {
      distribution[level - 1]++;
    }
  }

  // Levels 3-5 are "confident or higher"
  const highConfidenceCount = distribution[2] + distribution[3] + distribution[4];

  return NextResponse.json({
    totalPicks,
    distribution,
    highConfidenceCount,
  });
}
