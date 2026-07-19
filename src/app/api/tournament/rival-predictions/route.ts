import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isWorldCupArchive } from "@/lib/product-mode";
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
  const archiveMode = isWorldCupArchive();

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let user: { id: string } | null = null;

  if (archiveMode) {
    supabase = createServiceClient() as Awaited<ReturnType<typeof createClient>>;
    const demoUserId = process.env.WC_ARCHIVE_DEMO_USER_ID || "e5094c4a-148c-5358-a6ae-cafcd8ad5ebf";
    user = { id: demoUserId };
  } else {
    supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;
  }

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

  // Verify membership (skip in archive mode — demo user is always a member)
  if (!archiveMode) {
    const { data: membership } = await supabase
      .from("competition_members")
      .select("id")
      .eq("competition_id", competitionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
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

  // Overall points for sort tiebreaker (one row per user via RPC — no row-limit risk)
  const memberIdArray = [...memberIds];
  const { data: overallPointRows } = await supabase.rpc("sum_prediction_points", {
    p_user_ids: memberIdArray,
    p_tournament_id: tournamentId,
    p_competition_id: competitionId,
  });
  const overallRankMap = new Map<string, number>();
  const sortedByPoints = [...(overallPointRows ?? []) as Array<{ user_id: string; total_points: number }>]
    .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
  sortedByPoints.forEach((r, i) => overallRankMap.set(r.user_id, i + 1));
  // Users with no scored predictions get bottom rank
  for (const uid of memberIdArray) {
    if (!overallRankMap.has(uid)) overallRankMap.set(uid, memberIdArray.length);
  }

  // Build prediction map: user_id -> merged winner + exact_score + h2h data
  const predMap = new Map<
    string,
    {
      winner: string | null;
      exactScore: { home: number; away: number } | null;
      winnerCorrect: boolean | null;
      scoreCorrect: boolean | null;
      winnerPoints: number;
      scorePoints: number;
      h2hPoints: number;
      goesThrough: string | null;
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
        h2hPoints: 0,
        goesThrough: null as string | null,
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
    } else if (p.prediction_type === "head_to_head") {
      entry.h2hPoints = p.points_awarded ?? 0;
      entry.goesThrough = (data?.selection as string) ?? null;
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
      totalPoints: (pred?.winnerPoints ?? 0) + (pred?.scorePoints ?? 0) + (pred?.h2hPoints ?? 0),
      goesThrough: pred?.goesThrough ?? null,
      isGroupMember: groupMemberships.get(m.user_id)?.isUserGroup ?? false,
      isSelf: m.user_id === userId,
      groupName: groupMemberships.get(m.user_id)?.groupName ?? null,
      groupId: groupMemberships.get(m.user_id)?.groupId ?? null,
      confidenceLevel: pred?.confidenceLevel ?? null,
    };
  });

  // Sort with overall rank tiebreaker
  const hasResult = event.result_confirmed;
  rows.sort((a, b) => {
    const ao = predSortOrder(a);
    const bo = predSortOrder(b);
    if (ao !== bo) return ao - bo;

    if (!hasResult) {
      // Before result: group by winner prediction, then exact score, then overall rank
      if (a.winner !== b.winner) {
        if (a.winner === null) return 1;
        if (b.winner === null) return -1;
        return a.winner.localeCompare(b.winner);
      }
      const aScore = a.exactScore ? `${a.exactScore.home}-${a.exactScore.away}` : "\uffff";
      const bScore = b.exactScore ? `${b.exactScore.home}-${b.exactScore.away}` : "\uffff";
      if (aScore !== bScore) return aScore.localeCompare(bScore);
      return (overallRankMap.get(a.userId) ?? 999) - (overallRankMap.get(b.userId) ?? 999);
    }

    // After result: by fixture points desc, then overall rank
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return (overallRankMap.get(a.userId) ?? 999) - (overallRankMap.get(b.userId) ?? 999);
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

// ── Dashboard teaser (2 above / 2 below user in standings) ───────────────────

async function handleTeaser(
  supabase: SupabaseClient,
  competitionId: string,
  tournamentId: string | null,
  userId: string,
) {
  // 1. Get all members + format group info + format elimination status in parallel
  const [membersResult, groupMemberships, formatStatusResult] = await Promise.all([
    supabase
      .from("competition_members")
      .select("user_id, users(display_name)")
      .eq("competition_id", competitionId),
    getAllGroupMemberships(supabase, competitionId, userId),
    // Check if user is eliminated from format
    (async () => {
      const { data: formatClass } = await supabase
        .from("classifications")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("classification_key", "format")
        .maybeSingle();
      if (!formatClass) return null;
      const { data: membership } = await supabase
        .from("classification_memberships")
        .select("status")
        .eq("classification_id", formatClass.id)
        .eq("user_id", userId)
        .maybeSingle();
      return membership?.status ?? "active";
    })(),
  ]);

  const members = membersResult.data ?? [];
  if (members.length === 0) {
    return NextResponse.json({ event: null, predictions: [] });
  }

  const allMemberIds = members.map((m) => m.user_id);

  // Fetch overall points for standings ranking
  const { data: pointRows } = await supabase.rpc("sum_prediction_points", {
    p_user_ids: allMemberIds,
    p_tournament_id: tournamentId,
    p_competition_id: competitionId,
  });

  const overallPointsMap = new Map<string, number>();
  for (const r of (pointRows ?? []) as Array<{ user_id: string; total_points: number }>) {
    overallPointsMap.set(r.user_id, r.total_points ?? 0);
  }

  // 2. Determine which pool to use: group standings or overall standings
  const userGroupInfo = groupMemberships.get(userId);
  const isEliminated = formatStatusResult === "eliminated" || formatStatusResult === "dead";
  const useGroupPool = userGroupInfo && !isEliminated;

  let rankedNeighbourIds: string[];

  if (useGroupPool) {
    // Group standings: rank members of user's group by points
    const groupMembers = [...groupMemberships.entries()]
      .filter(([, info]) => info.groupId === userGroupInfo.groupId)
      .map(([uid]) => uid);
    const ranked = groupMembers
      .map((uid) => ({ uid, pts: overallPointsMap.get(uid) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    const myIdx = ranked.findIndex((r) => r.uid === userId);
    const start = Math.max(0, myIdx - 2);
    const end = Math.min(ranked.length, myIdx + 3); // +3 to include 2 below
    rankedNeighbourIds = ranked.slice(start, end)
      .map((r) => r.uid)
      .filter((uid) => uid !== userId);
  } else {
    // Overall standings: rank all members by points
    const ranked = allMemberIds
      .map((uid) => ({ uid, pts: overallPointsMap.get(uid) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    const myIdx = ranked.findIndex((r) => r.uid === userId);
    const start = Math.max(0, myIdx - 2);
    const end = Math.min(ranked.length, myIdx + 3);
    rankedNeighbourIds = ranked.slice(start, end)
      .map((r) => r.uid)
      .filter((uid) => uid !== userId);
  }

  if (rankedNeighbourIds.length === 0) {
    return NextResponse.json({ event: null, predictions: [] });
  }

  // 3. Find the most recently revealed event
  const eventsQuery = supabase
    .from("events")
    .select(
      "id, event_name, lock_time, pick_reveal_at, start_time, result_confirmed, result_data, external_event_id",
    )
    .order("start_time", { ascending: false });

  const { data: events } = tournamentId
    ? await eventsQuery.eq("tournament_id", tournamentId)
    : await eventsQuery.eq("competition_id", competitionId);

  const revealed = (events ?? []).find((e) => isRevealed(e));
  if (!revealed) {
    return NextResponse.json({ event: null, predictions: [] });
  }

  // 4. Fetch predictions + names for neighbours
  const [predsResult, usersResult, memberCountResult] = await Promise.all([
    supabase
      .from("predictions")
      .select(
        "user_id, prediction_type, prediction_data, is_correct, points_awarded",
      )
      .eq("event_id", revealed.id)
      .in("user_id", rankedNeighbourIds),
    supabase
      .from("users")
      .select("id, display_name")
      .in("id", rankedNeighbourIds),
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
      h2hPoints: number;
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
        h2hPoints: 0,
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
    } else if (p.prediction_type === "head_to_head") {
      entry.h2hPoints = p.points_awarded ?? 0;
    }
  }

  // Build rows in standings order (preserve the ranked neighbour order)
  const rows = rankedNeighbourIds.map((uid) => {
    const pred = predMap.get(uid);
    return {
      userId: uid,
      displayName: nameMap.get(uid) ?? "Unknown",
      winner: pred?.winner ?? null,
      exactScore: pred?.exactScore ?? null,
      winnerCorrect: pred?.winnerCorrect ?? null,
      scoreCorrect: pred?.scoreCorrect ?? null,
      totalPoints: (pred?.winnerPoints ?? 0) + (pred?.scorePoints ?? 0) + (pred?.h2hPoints ?? 0),
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
      .select("id, group_name, status")
      .eq("classification_id", formatClass.id),
    supabase
      .from("format_group_memberships")
      .select("user_id, group_id")
      .eq("classification_id", formatClass.id),
  ]);

  // Filter active groups in app code — safe when status column doesn't exist yet
  const groups = (groupsResult.data ?? []).filter(
    (g) => !g.status || g.status === "active"
  );
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
