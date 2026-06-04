import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allocatePredictionGroups } from "@/lib/tournament/format/group-allocation";
import { getEliminationCurve } from "@/lib/tournament/format/elimination";
import type { Classification } from "@/types/tournament";

/**
 * GET /api/tournament/my-group?classificationId=X&competitionId=Y
 *
 * Returns the current user's format group info, or draw-pending status
 * with countdown. Triggers lazy group draw if draw window has opened.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classificationId = request.nextUrl.searchParams.get("classificationId");
  const competitionId = request.nextUrl.searchParams.get("competitionId");

  if (!classificationId || !competitionId) {
    return NextResponse.json(
      { error: "classificationId and competitionId required" },
      { status: 400 }
    );
  }

  // Fetch classification with config
  const { data: cls, error: clsError } = await supabase
    .from("classifications")
    .select("*")
    .eq("id", classificationId)
    .single();

  if (clsError || !cls) {
    return NextResponse.json({ status: "no_classification" });
  }

  const classification = cls as Classification;
  const config = classification.config as Record<string, unknown>;
  const groupDrawHoursBefore = (config?.group_draw_hours_before as number) ?? 24;

  // Get total member count
  const { count: totalMembers } = await supabase
    .from("classification_memberships")
    .select("id", { count: "exact", head: true })
    .eq("classification_id", classificationId)
    .eq("status", "active");

  // Check if groups already exist
  const { data: existingGroups } = await supabase
    .from("format_prediction_groups")
    .select("id")
    .eq("classification_id", classificationId)
    .limit(1);

  const groupsExist = (existingGroups?.length ?? 0) > 0;

  if (!groupsExist) {
    // Find the next prediction window to compute draw time
    const { data: nextRound } = await supabase
      .from("rounds")
      .select("id, round_number, sporting_stage_id")
      .eq("competition_id", competitionId)
      .in("status", ["draft", "open"])
      .order("round_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextRound) {
      return NextResponse.json({
        status: "draw_pending",
        drawAt: null,
        totalMembers: totalMembers ?? 0,
      });
    }

    // Get earliest event start_time in this round
    const { data: firstEvent } = await supabase
      .from("events")
      .select("start_time")
      .eq("round_id", nextRound.id)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstEvent) {
      return NextResponse.json({
        status: "draw_pending",
        drawAt: null,
        totalMembers: totalMembers ?? 0,
      });
    }

    const eventStart = new Date(firstEvent.start_time);
    const drawAt = new Date(eventStart.getTime() - groupDrawHoursBefore * 60 * 60 * 1000);
    const now = new Date();

    if (now < drawAt) {
      // Not yet time to draw
      return NextResponse.json({
        status: "draw_pending",
        drawAt: drawAt.toISOString(),
        totalMembers: totalMembers ?? 0,
      });
    }

    // Draw window open — trigger lazy draw
    const memberCount = totalMembers ?? 0;
    if (memberCount < 3) {
      return NextResponse.json({
        status: "draw_pending",
        drawAt: drawAt.toISOString(),
        totalMembers: memberCount,
      });
    }

    try {
      // Get survivor target from elimination curve
      const curveSteps = getEliminationCurve(classification);
      // First curve step after "start" is the group stage target
      const firstElimination = curveSteps[1];
      const survivorTarget = firstElimination?.remaining ?? memberCount;

      await allocatePredictionGroups(supabase, classificationId, survivorTarget);
    } catch (err) {
      console.error("[my-group] Lazy draw failed:", (err as Error).message);
      return NextResponse.json({
        status: "draw_pending",
        drawAt: drawAt.toISOString(),
        totalMembers: memberCount,
      });
    }
  }

  // Groups exist (either pre-existing or just drawn) — fetch user's group
  const { data: membership } = await supabase
    .from("format_group_memberships")
    .select("group_id, status")
    .eq("classification_id", classificationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({
      status: "drawn",
      group: null,
      totalMembers: totalMembers ?? 0,
    });
  }

  // Fetch group details
  const { data: group } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, group_number, target_size")
    .eq("id", membership.group_id)
    .single();

  if (!group) {
    return NextResponse.json({
      status: "drawn",
      group: null,
      totalMembers: totalMembers ?? 0,
    });
  }

  // Fetch all members of this group with display names
  const { data: groupMembers } = await supabase
    .from("format_group_memberships")
    .select("user_id, seed_position, status")
    .eq("group_id", group.id)
    .order("seed_position", { ascending: true });

  const memberUserIds = (groupMembers ?? []).map((m: { user_id: string }) => m.user_id);

  // Fetch display names
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", memberUserIds);

  const nameMap = new Map<string, string>();
  for (const u of users ?? []) {
    nameMap.set(u.id, u.display_name || "Unknown");
  }

  // Fetch prediction counts for this round
  // Find current/next round
  const { data: currentRound } = await supabase
    .from("rounds")
    .select("id")
    .eq("competition_id", competitionId)
    .in("status", ["draft", "open", "locked"])
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  let predictionsTotal = 0;
  const predictionsMadeMap = new Map<string, number>();

  if (currentRound) {
    // Count total prediction types in this round
    const { data: roundEvents } = await supabase
      .from("events")
      .select("id")
      .eq("round_id", currentRound.id);

    const eventIds = (roundEvents ?? []).map((e: { id: string }) => e.id);

    if (eventIds.length > 0) {
      const { count: eptCount } = await supabase
        .from("event_prediction_types")
        .select("id", { count: "exact", head: true })
        .in("event_id", eventIds);

      predictionsTotal = eptCount ?? 0;

      // Count predictions per group member
      const { data: predictions } = await supabase
        .from("predictions")
        .select("user_id")
        .in("user_id", memberUserIds)
        .in("event_id", eventIds);

      for (const p of predictions ?? []) {
        const current = predictionsMadeMap.get(p.user_id) ?? 0;
        predictionsMadeMap.set(p.user_id, current + 1);
      }
    }
  }

  // Aggregate total points per group member from all scored predictions
  const pointsMap = new Map<string, number>();
  for (const uid of memberUserIds) pointsMap.set(uid, 0);

  const { data: scoredPreds } = await supabase
    .from("predictions")
    .select("user_id, points_awarded, events!inner(competition_id)")
    .in("user_id", memberUserIds)
    .eq("events.competition_id", competitionId)
    .not("points_awarded", "is", null);

  for (const p of scoredPreds ?? []) {
    const current = pointsMap.get(p.user_id) ?? 0;
    pointsMap.set(p.user_id, current + (p.points_awarded ?? 0));
  }

  // Build response — sorted by points descending
  const members = (groupMembers ?? [])
    .map((m: { user_id: string; seed_position: number | null; status: string }) => ({
      user_id: m.user_id,
      display_name: nameMap.get(m.user_id) ?? "Unknown",
      points: pointsMap.get(m.user_id) ?? 0,
      predictions_made: predictionsMadeMap.get(m.user_id) ?? 0,
      predictions_total: predictionsTotal,
      is_self: m.user_id === user.id,
      status: m.status,
    }))
    .sort((a, b) => b.points - a.points);

  return NextResponse.json({
    status: "drawn",
    group: {
      name: group.group_name,
      groupNumber: group.group_number,
      members,
    },
    totalMembers: totalMembers ?? 0,
  });
}
