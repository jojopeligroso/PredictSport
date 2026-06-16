import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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
      // Get survivor target from elimination curve, scaled to actual entrants
      const curveSteps = getEliminationCurve(classification, memberCount);
      // First curve step after "start" is the group stage target
      const firstElimination = curveSteps[1];
      const survivorTarget = firstElimination?.remaining ?? memberCount;

      const svc = createServiceClient();
      await allocatePredictionGroups(svc, classificationId, survivorTarget);
    } catch (err) {
      console.error("[my-group] Draw FAILED:", (err as Error).message);
      return NextResponse.json({
        status: "draw_error",
        error: (err as Error).message,
        drawAt: drawAt.toISOString(),
        totalMembers: memberCount,
      });
    }
  }

  // Groups exist — fetch ALL groups with members for full overview
  const { data: allGroups } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, group_number, target_size")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  if (!allGroups || allGroups.length === 0) {
    return NextResponse.json({
      status: "drawn",
      group: null,
      allGroups: [],
      totalMembers: totalMembers ?? 0,
    });
  }

  // Fetch ALL memberships across all groups
  const { data: allMemberships } = await supabase
    .from("format_group_memberships")
    .select("group_id, user_id, seed_position, status")
    .eq("classification_id", classificationId);

  const memberships = allMemberships ?? [];
  const allUserIds = memberships.map((m) => m.user_id);

  // Fetch display names for everyone
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", allUserIds);

  const nameMap = new Map<string, string>();
  for (const u of users ?? []) {
    nameMap.set(u.id, u.display_name || "Unknown");
  }

  // Aggregate total points per user from all scored predictions
  const pointsMap = new Map<string, number>();
  for (const uid of allUserIds) pointsMap.set(uid, 0);

  if (allUserIds.length > 0) {
    // Resolve tournament_id for shared fixture scoring
    const { data: comp } = await supabase
      .from("competitions")
      .select("tournament_id")
      .eq("id", competitionId)
      .single();

    const { data: scoredPreds } = comp?.tournament_id
      ? await supabase
          .from("predictions")
          .select("user_id, points_awarded, events!inner(tournament_id)")
          .in("user_id", allUserIds)
          .eq("events.tournament_id", comp.tournament_id)
          .not("points_awarded", "is", null)
          .limit(10000)
      : await supabase
          .from("predictions")
          .select("user_id, points_awarded, events!inner(competition_id)")
          .in("user_id", allUserIds)
          .eq("events.competition_id", competitionId)
          .not("points_awarded", "is", null)
          .limit(10000);

    for (const p of scoredPreds ?? []) {
      const current = pointsMap.get(p.user_id) ?? 0;
      pointsMap.set(p.user_id, current + (p.points_awarded ?? 0));
    }
  }

  // Identify user's group
  const myMembership = memberships.find((m) => m.user_id === user.id);
  const myGroupId = myMembership?.group_id ?? null;
  const myGroup = allGroups.find((g) => g.id === myGroupId);

  // Build per-group member lists
  const groupsResponse = allGroups.map((g) => {
    const gMembers = memberships
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        user_id: m.user_id,
        display_name: nameMap.get(m.user_id) ?? "Unknown",
        points: pointsMap.get(m.user_id) ?? 0,
        predictions_made: 0,
        predictions_total: 0,
        is_self: m.user_id === user.id,
        status: m.status,
      }))
      .sort((a, b) => b.points - a.points);

    return {
      id: g.id,
      name: g.group_name,
      groupNumber: g.group_number,
      targetSize: g.target_size,
      members: gMembers,
    };
  });

  // User's own group for backward compat
  const userGroupData = myGroup
    ? groupsResponse.find((g) => g.id === myGroupId) ?? null
    : null;

  return NextResponse.json({
    status: "drawn",
    group: userGroupData
      ? { name: userGroupData.name, groupNumber: userGroupData.groupNumber, members: userGroupData.members }
      : null,
    allGroups: groupsResponse,
    myGroupId,
    totalMembers: totalMembers ?? 0,
  });
}
