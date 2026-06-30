import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyVisibility, type ViewerRole } from "@/lib/tournament/visibility";

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

  const { data: viewerProfile } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  const viewerRole = viewerProfile?.is_super_admin ? "admin" as const : "member" as const;

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

    // Get all predictions for this competition (tournament-aware)
    const { data: compForTournament } = await supabase
      .from("competitions")
      .select("tournament_id")
      .eq("id", classification.competition_id)
      .single();

    const tournamentId = compForTournament?.tournament_id ?? null;

    // Format classification: points reset per sporting stage (stage-local).
    // Find the current active stage so we can scope the queries.
    let activeSportingStageId: string | null = null;
    const isFormat = classification.classification_type === "format_elimination";

    if (isFormat && tournamentId) {
      // Find the current stage: first non-finalised stage by stage_order.
      // Sporting stage status may lag behind reality (e.g. 'upcoming' when
      // rounds are already open/scored), so we can't rely on status='active'.
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

    // Sum scored prediction points per user in the database. Aggregating in
    // SQL returns one row per user (~50 rows) instead of every prediction row,
    // so it can never hit PostgREST's max-rows cap.
    // Format uses stage-scoped RPCs; Overall uses tournament-wide RPCs.
    const [{ data: pointRows }, { data: accuracyRows }] = isFormat && activeSportingStageId
      ? await Promise.all([
          supabase.rpc("sum_stage_points", {
            p_user_ids: userIds,
            p_sporting_stage_id: activeSportingStageId,
            p_tournament_id: tournamentId,
            p_competition_id: classification.competition_id,
          }),
          supabase.rpc("stage_accuracy_stats", {
            p_user_ids: userIds,
            p_sporting_stage_id: activeSportingStageId,
            p_tournament_id: tournamentId,
            p_competition_id: classification.competition_id,
          }),
        ])
      : await Promise.all([
          supabase.rpc("sum_prediction_points", {
            p_user_ids: userIds,
            p_tournament_id: tournamentId,
            p_competition_id: classification.competition_id,
          }),
          supabase.rpc("prediction_accuracy_stats", {
            p_user_ids: userIds,
            p_tournament_id: tournamentId,
            p_competition_id: classification.competition_id,
          }),
        ]);

    const pointsMap = new Map<string, number>();
    for (const uid of userIds) pointsMap.set(uid, 0);

    for (const r of (pointRows ?? []) as Array<{ user_id: string; total_points: number }>) {
      pointsMap.set(r.user_id, r.total_points ?? 0);
    }

    const accuracyMap = new Map<string, {
      outcome: { correct: number; total: number; pct: number } | null;
      exact: { correct: number; total: number; pct: number } | null;
    }>();
    for (const r of (accuracyRows ?? []) as Array<{
      user_id: string;
      winner_correct: number;
      winner_total: number;
      score_correct: number;
      score_total: number;
    }>) {
      accuracyMap.set(r.user_id, {
        outcome: r.winner_total > 0
          ? { correct: r.winner_correct, total: r.winner_total, pct: Math.round((r.winner_correct / r.winner_total) * 100) }
          : null,
        exact: r.score_total > 0
          ? { correct: r.score_correct, total: r.score_total, pct: Math.round((r.score_correct / r.score_total) * 100) }
          : null,
      });
    }

    // Get display names + available points (max possible from confirmed events).
    // Format: only count events in the current stage.
    let eventsFilter;
    if (isFormat && activeSportingStageId) {
      // Stage-scoped: join through rounds to filter by sporting_stage_id
      eventsFilter = supabase
        .from("events")
        .select("id, rounds!inner(sporting_stage_id)")
        .eq("rounds.sporting_stage_id", activeSportingStageId)
        .eq("result_confirmed", true);
      // Also scope to tournament or competition
      if (tournamentId) {
        eventsFilter = eventsFilter.eq("tournament_id", tournamentId);
      } else {
        eventsFilter = eventsFilter.eq("competition_id", classification.competition_id);
      }
    } else {
      eventsFilter = tournamentId
        ? supabase
            .from("events")
            .select("id")
            .eq("tournament_id", tournamentId)
            .eq("result_confirmed", true)
        : supabase
            .from("events")
            .select("id")
            .eq("competition_id", classification.competition_id)
            .eq("result_confirmed", true);
    }

    const [{ data: users }, { data: confirmedEvents }] = await Promise.all([
      supabase.from("users").select("id, display_name").in("id", userIds),
      eventsFilter,
    ]);

    let availablePoints = 0;
    const confirmedEventIds = (confirmedEvents ?? []).map((e: { id: string }) => e.id);
    if (confirmedEventIds.length > 0) {
      const { data: epts } = await supabase
        .from("event_prediction_types")
        .select("points")
        .in("event_id", confirmedEventIds);
      availablePoints = (epts ?? []).reduce((sum: number, r: { points: number }) => sum + r.points, 0);
    }

    const nameMap = new Map(
      (users ?? []).map((u: { id: string; display_name: string }) => [u.id, u.display_name])
    );

    const rawStandings = [...pointsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([userId, points], idx) => ({
        rank: idx + 1,
        user_id: userId,
        display_name: nameMap.get(userId) || "Unknown",
        points,
        status: memberships.find((m: { user_id: string }) => m.user_id === userId)?.status ?? "active",
        eliminated: memberships.find((m: { user_id: string }) => m.user_id === userId)?.status === "eliminated",
        accuracy: accuracyMap.get(userId) ?? { outcome: null, exact: null },
      }));

    const standings = applyVisibility(
      rawStandings,
      visibility,
      classification.classification_type,
      user.id,
      viewerRole,
    );

    return NextResponse.json({ standings, provisional: true, selfVisibility, availablePoints });
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
    viewerRole,
  );

  return NextResponse.json({
    standings,
    provisional: false,
    snapshot_type: snapshot.snapshot_type,
    generated_at: snapshot.generated_at,
    selfVisibility,
  });
}
