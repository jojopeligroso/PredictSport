import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tournament/all-groups?classificationId=X&competitionId=Y
 *
 * Returns ALL format prediction groups with members for the group overview.
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

  const { data: groups, error: groupError } = await supabase
    .from("format_prediction_groups")
    .select("id, group_name, group_number, target_size")
    .eq("classification_id", classificationId)
    .order("group_number", { ascending: true });

  if (groupError || !groups || groups.length === 0) {
    return NextResponse.json({ status: "no_groups", myGroupId: null, groups: [] });
  }

  const { data: allMemberships } = await supabase
    .from("format_group_memberships")
    .select("group_id, user_id, status")
    .eq("classification_id", classificationId);

  const memberships = allMemberships ?? [];
  const allUserIds = memberships.map((m) => m.user_id);

  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", allUserIds);

  const nameMap = new Map<string, string>();
  for (const u of users ?? []) {
    nameMap.set(u.id, u.display_name || "Unknown");
  }

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
      : await supabase
          .from("predictions")
          .select("user_id, points_awarded, events!inner(competition_id)")
          .in("user_id", allUserIds)
          .eq("events.competition_id", competitionId)
          .not("points_awarded", "is", null);

    for (const p of scoredPreds ?? []) {
      const current = pointsMap.get(p.user_id) ?? 0;
      pointsMap.set(p.user_id, current + (p.points_awarded ?? 0));
    }
  }

  const myMembership = memberships.find((m) => m.user_id === user.id);
  const myGroupId = myMembership?.group_id ?? null;

  const responseGroups = groups.map((g) => {
    const groupMembers = memberships
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        user_id: m.user_id,
        display_name: nameMap.get(m.user_id) ?? "Unknown",
        points: pointsMap.get(m.user_id) ?? 0,
        is_self: m.user_id === user.id,
        status: m.status,
      }))
      .sort((a, b) => b.points - a.points);

    return {
      id: g.id,
      name: g.group_name,
      groupNumber: g.group_number,
      members: groupMembers,
    };
  });

  return NextResponse.json({
    status: "drawn",
    myGroupId,
    groups: responseGroups,
  });
}
