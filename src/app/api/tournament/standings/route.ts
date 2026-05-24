import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyVisibility } from "@/lib/tournament/visibility";

/**
 * GET /api/tournament/standings?classificationId=xxx&provisional=true
 * Get standings for a classification.
 * If provisional=true, returns live-computed standings.
 * Otherwise, returns the latest finalised snapshot.
 *
 * All rows pass through `applyVisibility()` so private members appear as
 * their stable Mystery {Animal} pseudonym to non-self viewers. Format
 * classification is exempt (always real names). See ADR 0011.
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
  if (!classificationId) {
    return NextResponse.json(
      { error: "classificationId query parameter is required" },
      { status: 400 }
    );
  }

  const { data: classification } = await supabase
    .from("classifications")
    .select("competition_id, classification_type")
    .eq("id", classificationId)
    .single();

  if (!classification) {
    return NextResponse.json({ error: "Classification not found" }, { status: 404 });
  }

  // Visibility map for every member of this classification — used by both
  // the live and snapshot paths.
  const { data: visibilityRows } = await supabase
    .from("classification_memberships")
    .select("user_id, display_visibility, pseudonym")
    .eq("classification_id", classificationId);

  const visibility = (visibilityRows ?? []) as Array<{
    user_id: string;
    display_visibility: "public" | "private";
    pseudonym: string | null;
  }>;

  // Whether the current user has opted private on this classification —
  // returned so the UI can render the toggle in the right state without a
  // second roundtrip.
  const selfVisibility =
    visibility.find((v) => v.user_id === user.id)?.display_visibility ?? "public";

  const provisional = request.nextUrl.searchParams.get("provisional") === "true";

  if (provisional) {
    // Get active members
    const { data: memberships } = await supabase
      .from("classification_memberships")
      .select("user_id, status")
      .eq("classification_id", classificationId);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({
        standings: [],
        provisional: true,
        selfVisibility,
      });
    }

    const userIds = memberships.map((m: { user_id: string }) => m.user_id);

    // Get all predictions for this competition
    const { data: predictions } = await supabase
      .from("predictions")
      .select("user_id, points_awarded, events!inner(competition_id)")
      .in("user_id", userIds)
      .eq("events.competition_id", classification.competition_id)
      .not("points_awarded", "is", null);

    // Aggregate points
    const pointsMap = new Map<string, number>();
    for (const uid of userIds) pointsMap.set(uid, 0);

    for (const p of predictions ?? []) {
      const current = pointsMap.get(p.user_id) ?? 0;
      pointsMap.set(p.user_id, current + (p.points_awarded ?? 0));
    }

    // Get display names
    const { data: users } = await supabase
      .from("users")
      .select("id, display_name")
      .in("id", userIds);

    const nameMap = new Map(
      (users ?? []).map((u: { id: string; display_name: string }) => [u.id, u.display_name])
    );

    const rawStandings = [...pointsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([userId, points], idx) => ({
        rank: idx + 1,
        user_id: userId,
        display_name: nameMap.get(userId) ?? "Unknown",
        points,
        status: memberships.find((m: { user_id: string }) => m.user_id === userId)?.status ?? "active",
        eliminated: memberships.find((m: { user_id: string }) => m.user_id === userId)?.status === "eliminated",
      }));

    const standings = applyVisibility(
      rawStandings,
      visibility,
      classification.classification_type,
      user.id,
    );

    return NextResponse.json({ standings, provisional: true, selfVisibility });
  }

  // Return latest finalised snapshot
  const { data: snapshot } = await supabase
    .from("classification_standings_snapshots")
    .select("*")
    .eq("classification_id", classificationId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) {
    return NextResponse.json({
      standings: [],
      provisional: false,
      message: "No finalised standings yet",
      selfVisibility,
    });
  }

  const standings = applyVisibility(
    (snapshot.standings_data ?? []) as Array<{ user_id: string; display_name: string }>,
    visibility,
    classification.classification_type,
    user.id,
  );

  return NextResponse.json({
    standings,
    provisional: false,
    snapshot_type: snapshot.snapshot_type,
    generated_at: snapshot.generated_at,
    selfVisibility,
  });
}
