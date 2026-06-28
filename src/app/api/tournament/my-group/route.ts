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

  // Check if groups already exist — use service client to bypass RLS,
  // since format_prediction_groups may not have SELECT policies for members.
  const svcCheck = createServiceClient();
  const { data: existingGroupsRaw } = await svcCheck
    .from("format_prediction_groups")
    .select("id, status")
    .eq("classification_id", classificationId)
    .limit(100);

  // Filter active groups in app code — safe when status column doesn't exist yet
  const existingGroups = (existingGroupsRaw ?? []).filter(
    (g) => !g.status || g.status === "active"
  );
  const groupsExist = existingGroups.length > 0;

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

  // Groups exist — fetch ALL active groups with members for full overview.
  // Use service client because format_prediction_groups RLS may block members.
  const svcFetch = createServiceClient();
  const { data: allGroupsRaw } = await svcFetch
    .from("format_prediction_groups")
    .select("id, group_name, group_number, target_size, status")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  // Separate active and archived groups
  const allGroups = (allGroupsRaw ?? []).filter(
    (g) => !g.status || g.status === "active"
  );
  const archivedGroups = (allGroupsRaw ?? []).filter(
    (g) => g.status === "archived"
  );

  if (allGroups.length === 0 && archivedGroups.length === 0) {
    return NextResponse.json({
      status: "drawn",
      group: null,
      allGroups: [],
      totalMembers: totalMembers ?? 0,
    });
  }

  // Fetch ALL memberships across all groups — service client for RLS bypass
  const { data: allMemberships } = await svcFetch
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

  // Aggregate stage-local points per user (Format resets points per stage).
  const pointsMap = new Map<string, number>();
  for (const uid of allUserIds) pointsMap.set(uid, 0);

  if (allUserIds.length > 0) {
    // Resolve tournament_id for shared fixture scoring
    const { data: comp } = await supabase
      .from("competitions")
      .select("tournament_id")
      .eq("id", competitionId)
      .single();

    const tournamentId = comp?.tournament_id ?? null;

    // Find the current stage: first non-finalised stage by stage_order.
    // Sporting stage status may lag behind reality (e.g. 'upcoming' when
    // rounds are already open/scored), so we can't rely on status='active'.
    let activeSportingStageId: string | null = null;
    if (tournamentId) {
      const { data: currentStage } = await supabase
        .from("sporting_stages")
        .select("id")
        .eq("tournament_id", tournamentId)
        .neq("status", "finalised")
        .order("stage_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      activeSportingStageId = currentStage?.id ?? null;
    }

    // Use stage-scoped RPC for Format groups (points reset per stage).
    // Falls back to tournament-wide sum if no active stage found.
    const { data: pointRows } = activeSportingStageId
      ? await supabase.rpc("sum_stage_points", {
          p_user_ids: allUserIds,
          p_sporting_stage_id: activeSportingStageId,
          p_tournament_id: tournamentId,
          p_competition_id: competitionId,
        })
      : await supabase.rpc("sum_prediction_points", {
          p_user_ids: allUserIds,
          p_tournament_id: tournamentId,
          p_competition_id: competitionId,
        });

    for (const r of (pointRows ?? []) as Array<{ user_id: string; total_points: number }>) {
      pointsMap.set(r.user_id, r.total_points ?? 0);
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

  // Build archived group response (historical group stage view)
  const archivedGroupsResponse = archivedGroups.map((g) => {
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

  // Fetch eliminated classification members for the eliminated section
  const { data: eliminatedMembers } = await svcFetch
    .from("classification_memberships")
    .select("user_id")
    .eq("classification_id", classificationId)
    .eq("status", "eliminated");

  const eliminatedUserIds = new Set((eliminatedMembers ?? []).map((m) => m.user_id));

  // Build eliminated list with points and source group
  const eliminatedList = [...eliminatedUserIds].map((uid) => {
    // Find which archived group they were in
    const archivedMembership = memberships.find(
      (m) => m.user_id === uid && archivedGroups.some((g) => g.id === m.group_id)
    );
    const sourceGroup = archivedMembership
      ? archivedGroups.find((g) => g.id === archivedMembership.group_id)
      : null;

    return {
      user_id: uid,
      display_name: nameMap.get(uid) ?? "Unknown",
      points: pointsMap.get(uid) ?? 0,
      is_self: uid === user.id,
      source_group: sourceGroup?.group_name ?? null,
      status: archivedMembership?.status ?? "eliminated",
    };
  }).sort((a, b) => b.points - a.points);

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
    archivedGroups: archivedGroupsResponse,
    eliminatedMembers: eliminatedList,
    myGroupId,
    totalMembers: totalMembers ?? 0,
  });
}
