import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const REVEAL_OFFSET_MS = 5 * 60_000; // 5 minutes

function computeRevealTime(lockTime: string, pickRevealAt: string | null): Date {
  if (pickRevealAt) return new Date(pickRevealAt);
  return new Date(new Date(lockTime).getTime() + REVEAL_OFFSET_MS);
}

function isRevealed(event: {
  result_confirmed: boolean;
  lock_time: string;
  pick_reveal_at: string | null;
}): boolean {
  if (event.result_confirmed) return true;
  return new Date() >= computeRevealTime(event.lock_time, event.pick_reveal_at);
}

/** Sort order: exact correct (0) > winner correct (1) > wrong (2) > pending (3) > no pick (4) */
function predSortOrder(row: {
  winner: string | null;
  winnerCorrect: boolean | null;
  scoreCorrect: boolean | null;
}): number {
  if (row.winner === null) return 4;
  if (row.scoreCorrect === true) return 0;
  if (row.winnerCorrect === true) return 1;
  if (row.winnerCorrect === false) return 2;
  return 3; // pending — not yet resulted
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get("competitionId");
  const eventId = searchParams.get("eventId");
  const mode = searchParams.get("mode"); // "teaser" for dashboard

  if (!competitionId) {
    return NextResponse.json({ error: "Missing competitionId" }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Resolve tournament_id for shared fixtures
  const { data: comp } = await supabase
    .from("competitions")
    .select("tournament_id")
    .eq("id", competitionId)
    .single();

  const tournamentId = comp?.tournament_id ?? null;

  if (mode === "teaser") {
    return handleTeaser(supabase, competitionId, tournamentId, user.id);
  }

  if (eventId) {
    return handleEventPredictions(
      supabase,
      competitionId,
      tournamentId,
      eventId,
      user.id,
    );
  }

  return handleFixtureList(supabase, competitionId, tournamentId);
}

// ── Fixture list (for the fixture browser) ──────────────────────────────────

async function handleFixtureList(
  supabase: SupabaseClient,
  competitionId: string,
  tournamentId: string | null,
) {
  const baseQuery = supabase
    .from("events")
    .select(
      "id, event_name, lock_time, pick_reveal_at, start_time, result_confirmed, result_data, external_event_id, sport, rounds(name)",
    )
    .order("start_time", { ascending: false });

  const { data: events } = tournamentId
    ? await baseQuery.eq("tournament_id", tournamentId)
    : await baseQuery.eq("competition_id", competitionId);

  if (!events) return NextResponse.json({ fixtures: [] });

  const revealed = events
    .filter((e) => isRevealed(e))
    .map((e) => ({
      eventId: e.id,
      name: e.event_name,
      lockTime: e.lock_time,
      pickRevealAt: e.pick_reveal_at,
      startTime: e.start_time,
      resultConfirmed: e.result_confirmed,
      resultData: e.result_data,
      externalEventId: e.external_event_id,
      sport: e.sport,
      roundName: (e.rounds as unknown as { name: string } | null)?.name ?? null,
    }));

  return NextResponse.json({ fixtures: revealed });
}

// ── Predictions for a single event ──────────────────────────────────────────

async function handleEventPredictions(
  supabase: SupabaseClient,
  competitionId: string,
  tournamentId: string | null,
  eventId: string,
  userId: string,
) {
  // Fetch event to check reveal status
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, event_name, lock_time, pick_reveal_at, start_time, result_confirmed, result_data, external_event_id, sport, rounds(name)",
    )
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const revealed = isRevealed(event);
  const revealTime = computeRevealTime(event.lock_time, event.pick_reveal_at);

  // Parallel: fetch predictions (RLS handles visibility) + members + group
  const [predsResult, membersResult, groupMemberships] = await Promise.all([
    supabase
      .from("predictions")
      .select(
        "user_id, prediction_type, prediction_data, is_correct, points_awarded, confidence_level",
      )
      .eq("event_id", eventId),
    supabase
      .from("competition_members")
      .select("user_id, users(display_name)")
      .eq("competition_id", competitionId),
    getAllGroupMemberships(supabase, competitionId, userId),
  ]);

  const predictions = predsResult.data ?? [];
  const members = membersResult.data ?? [];
  const memberIds = new Set(members.map((m) => m.user_id));

  // Build prediction map: user_id -> merged winner + exact_score data
  const predMap = new Map<
    string,
    {
      winner: string | null;
      exactScore: { home: number; away: number } | null;
      winnerCorrect: boolean | null;
      scoreCorrect: boolean | null;
      winnerPoints: number;
      scorePoints: number;
      confidenceLevel: number | null;
    }
  >();

  for (const p of predictions) {
    // Only include predictions from competition members
    if (!memberIds.has(p.user_id)) continue;

    if (!predMap.has(p.user_id)) {
      predMap.set(p.user_id, {
        winner: null,
        exactScore: null,
        winnerCorrect: null,
        scoreCorrect: null,
        winnerPoints: 0,
        scorePoints: 0,
        confidenceLevel: null,
      });
    }
    const entry = predMap.get(p.user_id)!;
    const data = p.prediction_data as Record<string, unknown>;

    if (p.prediction_type === "winner") {
      entry.winner = (data?.value as string) ?? null;
      entry.winnerCorrect = p.is_correct;
      entry.winnerPoints = p.points_awarded ?? 0;
      entry.confidenceLevel = (p as Record<string, unknown>).confidence_level as number | null;
    } else if (p.prediction_type === "exact_score") {
      entry.exactScore =
        data?.home != null
          ? { home: Number(data.home), away: Number(data.away) }
          : null;
      entry.scoreCorrect = p.is_correct;
      entry.scorePoints = p.points_awarded ?? 0;
    }
  }

  // Build rows for ALL competition members
  const rows = members.map((m) => {
    const userObj = m.users as unknown as { display_name: string } | null;
    const pred = predMap.get(m.user_id);
    return {
      userId: m.user_id,
      displayName: userObj?.display_name || "Unknown",
      winner: pred?.winner ?? null,
      exactScore: pred?.exactScore ?? null,
      winnerCorrect: pred?.winnerCorrect ?? null,
      scoreCorrect: pred?.scoreCorrect ?? null,
      totalPoints: (pred?.winnerPoints ?? 0) + (pred?.scorePoints ?? 0),
      isGroupMember: groupMemberships.get(m.user_id)?.isUserGroup ?? false,
      isSelf: m.user_id === userId,
      groupName: groupMemberships.get(m.user_id)?.groupName ?? null,
      groupId: groupMemberships.get(m.user_id)?.groupId ?? null,
      confidenceLevel: pred?.confidenceLevel ?? null,
    };
  });

  // Sort: exact correct > winner correct > wrong > pending > no pick, then points desc
  rows.sort((a, b) => {
    const ao = predSortOrder(a);
    const bo = predSortOrder(b);
    if (ao !== bo) return ao - bo;
    return b.totalPoints - a.totalPoints;
  });

  return NextResponse.json({
    event: {
      eventId: event.id,
      name: event.event_name,
      lockTime: event.lock_time,
      pickRevealAt: event.pick_reveal_at,
      startTime: event.start_time,
      resultConfirmed: event.result_confirmed,
      resultData: event.result_data,
      externalEventId: event.external_event_id,
      sport: event.sport,
      roundName: (event.rounds as unknown as { name: string } | null)?.name ?? null,
    },
    predictions: rows,
    totalMembers: members.length,
    revealed,
    revealTime: revealTime.toISOString(),
  });
}

// ── Dashboard teaser (group members only, most recent revealed event) ───────

async function handleTeaser(
  supabase: SupabaseClient,
  competitionId: string,
  tournamentId: string | null,
  userId: string,
) {
  // Get group member IDs first — if no group, nothing to show
  const allMemberships = await getAllGroupMemberships(supabase, competitionId, userId);
  const groupMemberIds = [...allMemberships.entries()]
    .filter(([, info]) => info.isUserGroup)
    .map(([uid]) => uid);
  if (groupMemberIds.length === 0) {
    return NextResponse.json({ event: null, predictions: [] });
  }

  // Find the most recently revealed event
  const baseQuery = supabase
    .from("events")
    .select(
      "id, event_name, lock_time, pick_reveal_at, start_time, result_confirmed, result_data, external_event_id",
    )
    .order("start_time", { ascending: false });

  const { data: events } = tournamentId
    ? await baseQuery.eq("tournament_id", tournamentId)
    : await baseQuery.eq("competition_id", competitionId);

  const revealed = (events ?? []).find((e) => isRevealed(e));
  if (!revealed) {
    return NextResponse.json({ event: null, predictions: [] });
  }

  // Fetch predictions + display names for group members
  const [predsResult, usersResult, memberCountResult] = await Promise.all([
    supabase
      .from("predictions")
      .select(
        "user_id, prediction_type, prediction_data, is_correct, points_awarded",
      )
      .eq("event_id", revealed.id)
      .in("user_id", groupMemberIds),
    supabase
      .from("users")
      .select("id, display_name")
      .in("id", groupMemberIds),
    supabase
      .from("competition_members")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId),
  ]);

  const nameMap = new Map<string, string>();
  for (const u of usersResult.data ?? []) {
    nameMap.set(u.id, u.display_name || "Unknown");
  }

  // Build prediction map
  const predMap = new Map<
    string,
    {
      winner: string | null;
      exactScore: { home: number; away: number } | null;
      winnerCorrect: boolean | null;
      scoreCorrect: boolean | null;
      winnerPoints: number;
      scorePoints: number;
    }
  >();

  for (const p of predsResult.data ?? []) {
    if (!predMap.has(p.user_id)) {
      predMap.set(p.user_id, {
        winner: null,
        exactScore: null,
        winnerCorrect: null,
        scoreCorrect: null,
        winnerPoints: 0,
        scorePoints: 0,
      });
    }
    const entry = predMap.get(p.user_id)!;
    const data = p.prediction_data as Record<string, unknown>;

    if (p.prediction_type === "winner") {
      entry.winner = (data?.value as string) ?? null;
      entry.winnerCorrect = p.is_correct;
      entry.winnerPoints = p.points_awarded ?? 0;
    } else if (p.prediction_type === "exact_score") {
      entry.exactScore =
        data?.home != null
          ? { home: Number(data.home), away: Number(data.away) }
          : null;
      entry.scoreCorrect = p.is_correct;
      entry.scorePoints = p.points_awarded ?? 0;
    }
  }

  // Build rows — exclude self
  const rows = groupMemberIds
    .filter((uid) => uid !== userId)
    .map((uid) => {
      const pred = predMap.get(uid);
      return {
        userId: uid,
        displayName: nameMap.get(uid) ?? "Unknown",
        winner: pred?.winner ?? null,
        exactScore: pred?.exactScore ?? null,
        winnerCorrect: pred?.winnerCorrect ?? null,
        scoreCorrect: pred?.scoreCorrect ?? null,
        totalPoints: (pred?.winnerPoints ?? 0) + (pred?.scorePoints ?? 0),
      };
    });

  return NextResponse.json({
    event: {
      eventId: revealed.id,
      name: revealed.event_name,
      resultConfirmed: revealed.result_confirmed,
      resultData: revealed.result_data,
      externalEventId: revealed.external_event_id,
    },
    predictions: rows,
    totalMembers: memberCountResult.count ?? 0,
  });
}

// ── Helper: get ALL group memberships for the competition ───────────────────

interface GroupInfo {
  groupId: string;
  groupName: string;
  isUserGroup: boolean;
}

async function getAllGroupMemberships(
  supabase: SupabaseClient,
  competitionId: string,
  userId: string,
): Promise<Map<string, GroupInfo>> {
  const result = new Map<string, GroupInfo>();

  const { data: formatClass } = await supabase
    .from("classifications")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("classification_key", "format")
    .maybeSingle();

  if (!formatClass) return result;

  // Fetch all groups + all memberships in parallel
  const [groupsResult, membershipsResult] = await Promise.all([
    supabase
      .from("format_prediction_groups")
      .select("id, group_name")
      .eq("classification_id", formatClass.id),
    supabase
      .from("format_group_memberships")
      .select("user_id, group_id")
      .eq("classification_id", formatClass.id),
  ]);

  const groups = groupsResult.data ?? [];
  const memberships = membershipsResult.data ?? [];

  const groupNameById = new Map(groups.map((g) => [g.id, g.group_name]));

  // Find the current user's group
  const userMembership = memberships.find((m) => m.user_id === userId);
  const userGroupId = userMembership?.group_id ?? null;

  for (const m of memberships) {
    result.set(m.user_id, {
      groupId: m.group_id,
      groupName: groupNameById.get(m.group_id) ?? "Unknown",
      isUserGroup: m.group_id === userGroupId,
    });
  }

  return result;
}
