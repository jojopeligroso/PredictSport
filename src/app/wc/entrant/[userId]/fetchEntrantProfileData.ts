import { createClient } from "@/lib/supabase/server";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";
import { fixtureFilter, fixtureFilterFromIds } from "@/lib/tournament/shared-fixtures";
import { getTagDefinition } from "@/lib/reputation/tag-catalogue";
import type { MemberTag, TagStatus, TagCategory } from "@/types/database";

// ---------------------------------------------------------------------------
// Reveal logic — matches rival-predictions route.ts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface EntrantAccuracy {
  outcome: { correct: number; total: number; pct: number } | null;
  exact: { correct: number; total: number; pct: number } | null;
}

export interface EntrantPick {
  eventId: string;
  eventName: string;
  sport: string;
  startTime: string;
  lockTime: string;
  roundName: string | null;
  roundNumber: number | null;
  resultConfirmed: boolean;
  resultData: Record<string, unknown> | null;
  winnerPick: string | null;
  scorePick: { home: number; away: number } | null;
  winnerCorrect: boolean | null;
  scoreCorrect: boolean | null;
  winnerPoints: number;
  scorePoints: number;
}

export interface EntrantTagRow {
  id: string;
  tagName: string;
  tagCategory: TagCategory;
  status: TagStatus;
  stats: Record<string, unknown>;
  assignedAt: string;
  roundName: string | null;
  eventName: string | null;
  definition: {
    layer1: string;
    layer2: string;
    factCard: { fact: string; statTemplate: string; contextTemplate: string };
    visual: { borderColor: string; gold?: boolean; opacity?: number };
  } | null;
}

export interface EntrantGroupMember {
  userId: string;
  displayName: string;
  points: number;
  isSelf: boolean;
  isTarget: boolean;
}

export interface EntrantGroupInfo {
  groupName: string;
  members: EntrantGroupMember[];
}

export interface FormStreakEntry {
  roundNumber: number;
  roundName: string;
  correct: boolean;
}

export interface EntrantProfileData {
  found: true;
  targetUserId: string;
  displayName: string;
  competitionId: string;
  rank: number;
  totalPoints: number;
  accuracy: EntrantAccuracy;
  formatStatus: "alive" | "eliminated" | "dead" | null;
  picks: EntrantPick[];
  activeTags: EntrantTagRow[];
  allTags: EntrantTagRow[];
  formStreak: FormStreakEntry[];
  group: EntrantGroupInfo | null;
  isSelf: boolean;
}

export type EntrantProfileResult =
  | { found: false; reason: "no_competition" | "not_member" | "private" | "not_found" }
  | EntrantProfileData;

// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------

export async function fetchEntrantProfileData(
  targetUserId: string,
): Promise<EntrantProfileResult> {
  const { competition, user } = await resolveWcCompetition({
    statuses: ["active", "draft"],
  });

  if (!competition) return { found: false, reason: "no_competition" };

  const supabase = await createClient();
  const viewerUserId = user?.id ?? null;
  const isSelf = viewerUserId === targetUserId;
  const ff = fixtureFilter(competition);
  const rf = fixtureFilterFromIds(competition.id, competition.tournament_id);

  // ── Parallel batch 1: membership + visibility + basic profile ──
  const [
    targetMemberResult,
    overallClassResult,
    formatClassResult,
    targetUserResult,
  ] = await Promise.all([
    supabase
      .from("competition_members")
      .select("id, user_id")
      .eq("competition_id", competition.id)
      .eq("user_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("classifications")
      .select("id")
      .eq("competition_id", competition.id)
      .eq("classification_key", "overall")
      .maybeSingle(),
    supabase
      .from("classifications")
      .select("id")
      .eq("competition_id", competition.id)
      .eq("classification_key", "format")
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, display_name")
      .eq("id", targetUserId)
      .single(),
  ]);

  if (!targetMemberResult.data) return { found: false, reason: "not_found" };
  if (!targetUserResult.data) return { found: false, reason: "not_found" };

  const overallClassId = overallClassResult.data?.id ?? null;
  const formatClassId = formatClassResult.data?.id ?? null;

  // ── Privacy check: if viewer is not self, check Overall visibility ──
  if (!isSelf && overallClassId) {
    const { data: visMembership } = await supabase
      .from("classification_memberships")
      .select("display_visibility")
      .eq("classification_id", overallClassId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (visMembership?.display_visibility === "private") {
      return { found: false, reason: "private" };
    }
  }

  // ── Parallel batch 2: all profile data ──
  const userIds = [targetUserId];
  const [
    accuracyResult,
    eventsResult,
    tagsResult,
    formatMembershipResult,
    groupResult,
    roundsResult,
  ] = await Promise.all([
    // 1. Accuracy stats (points come from the all-members RPC below)
    supabase.rpc("prediction_accuracy_stats", {
      p_user_ids: userIds,
      p_tournament_id: competition.tournament_id ?? null,
      p_competition_id: competition.id,
    }),
    // 2. Events for this competition (we'll fetch predictions separately)
    supabase
      .from("events")
      .select("id, event_name, sport, start_time, lock_time, result_confirmed, result_data, pick_reveal_at, round_id, rounds(name, round_number)")
      .eq(rf.key, rf.value)
      .lte("lock_time", new Date().toISOString())
      .order("start_time", { ascending: false })
      .limit(500),
    // 3. Tags — full history
    supabase
      .from("member_tags")
      .select("id, tag_name, tag_category, status, stats, assigned_at, round_id, event_id, rounds(name), events(event_name)")
      .eq("competition_id", competition.id)
      .eq("user_id", targetUserId)
      .in("status", ["active", "expired", "rejected"])
      .order("assigned_at", { ascending: false })
      .limit(100),
    // 4. Format status
    formatClassId
      ? supabase
          .from("classification_memberships")
          .select("status")
          .eq("classification_id", formatClassId)
          .eq("user_id", targetUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // 5. Group membership
    formatClassId
      ? supabase
          .from("format_group_memberships")
          .select("group_id")
          .eq("classification_id", formatClassId)
          .eq("user_id", targetUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // 6. All rounds for form streak computation
    supabase
      .from("rounds")
      .select("id, name, round_number, status")
      .eq(ff.key, ff.value)
      .in("status", ["scored", "locked"])
      .order("round_number", { ascending: false })
      .limit(10),
  ]);

  // ── Points + rank computation ──
  // We need all members' points to compute rank
  const { data: allMemberIds } = await supabase
    .from("competition_members")
    .select("user_id")
    .eq("competition_id", competition.id);

  const allUserIds = (allMemberIds ?? []).map((m: { user_id: string }) => m.user_id);
  const { data: allPointsRows } = await supabase.rpc("sum_prediction_points", {
    p_user_ids: allUserIds,
    p_tournament_id: competition.tournament_id ?? null,
    p_competition_id: competition.id,
  });

  const allPoints = (allPointsRows ?? []) as Array<{ user_id: string; total_points: number }>;
  const sortedPoints = allPoints
    .map((r) => ({ userId: r.user_id, points: r.total_points ?? 0 }))
    .sort((a, b) => b.points - a.points);

  const targetPointsRow = sortedPoints.find((r) => r.userId === targetUserId);
  const totalPoints = targetPointsRow?.points ?? 0;
  const rank = sortedPoints.findIndex((r) => r.userId === targetUserId) + 1;

  // ── Accuracy ──
  const accRows = (accuracyResult.data ?? []) as Array<{
    user_id: string;
    winner_correct: number;
    winner_total: number;
    score_correct: number;
    score_total: number;
  }>;
  const accRow = accRows.find((r) => r.user_id === targetUserId);
  const accuracy: EntrantAccuracy = {
    outcome: accRow && accRow.winner_total > 0
      ? {
          correct: accRow.winner_correct,
          total: accRow.winner_total,
          pct: Math.round((accRow.winner_correct / accRow.winner_total) * 100),
        }
      : null,
    exact: accRow && accRow.score_total > 0
      ? {
          correct: accRow.score_correct,
          total: accRow.score_total,
          pct: Math.round((accRow.score_correct / accRow.score_total) * 100),
        }
      : null,
  };

  // ── Build event map from revealed events ──
  type EventRow = {
    id: string;
    event_name: string;
    sport: string;
    start_time: string;
    lock_time: string;
    result_confirmed: boolean;
    result_data: Record<string, unknown> | null;
    pick_reveal_at: string | null;
    round_id: string | null;
    rounds: { name: string; round_number: number } | null;
  };
  const allEventRows = (eventsResult.data ?? []) as unknown as EventRow[];
  // Filter to only revealed events (matches rival-predictions isRevealed logic)
  const eventRows = allEventRows.filter((ev) =>
    isRevealed({ result_confirmed: ev.result_confirmed, lock_time: ev.lock_time, pick_reveal_at: ev.pick_reveal_at }),
  );
  const eventMap = new Map<string, EventRow>();
  for (const ev of eventRows) {
    eventMap.set(ev.id, ev);
  }

  // Fetch user's predictions for these events (RLS enforces reveal visibility)
  const eventIds = eventRows.map((e) => e.id);
  type PredRow = {
    event_id: string;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    points_awarded: number;
  };
  let predRows: PredRow[] = [];
  if (eventIds.length > 0) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("event_id, prediction_type, prediction_data, is_correct, points_awarded")
      .eq("user_id", targetUserId)
      .in("event_id", eventIds)
      .limit(500);
    predRows = (preds ?? []) as PredRow[];
  }

  // Group predictions by event
  const predsByEvent = new Map<string, PredRow[]>();
  for (const p of predRows) {
    const list = predsByEvent.get(p.event_id) ?? [];
    list.push(p);
    predsByEvent.set(p.event_id, list);
  }

  const picks: EntrantPick[] = [];
  for (const [eventId, preds] of predsByEvent) {
    const ev = eventMap.get(eventId);
    if (!ev) continue;
    const winnerPred = preds.find((p) => p.prediction_type === "winner");
    const scorePred = preds.find((p) => p.prediction_type === "exact_score");

    let scorePick: { home: number; away: number } | null = null;
    if (scorePred?.prediction_data) {
      const sd = scorePred.prediction_data;
      const h = Number(sd.home ?? sd.home_score);
      const a = Number(sd.away ?? sd.away_score);
      if (!isNaN(h) && !isNaN(a)) scorePick = { home: h, away: a };
    }

    picks.push({
      eventId,
      eventName: ev.event_name,
      sport: ev.sport,
      startTime: ev.start_time,
      lockTime: ev.lock_time,
      roundName: (ev.rounds as { name: string; round_number: number } | null)?.name ?? null,
      roundNumber: (ev.rounds as { name: string; round_number: number } | null)?.round_number ?? null,
      resultConfirmed: ev.result_confirmed,
      resultData: ev.result_data,
      winnerPick: (winnerPred?.prediction_data?.value as string) ??
        (winnerPred?.prediction_data?.selection as string) ?? null,
      scorePick,
      winnerCorrect: winnerPred?.is_correct ?? null,
      scoreCorrect: scorePred?.is_correct ?? null,
      winnerPoints: winnerPred?.points_awarded ?? 0,
      scorePoints: scorePred?.points_awarded ?? 0,
    });
  }

  // Add "No pick" rows for events without predictions
  const pickedEventIds = new Set(picks.map((p) => p.eventId));
  for (const [eventId, ev] of eventMap) {
    if (pickedEventIds.has(eventId)) continue;
    picks.push({
      eventId,
      eventName: ev.event_name,
      sport: ev.sport,
      startTime: ev.start_time,
      lockTime: ev.lock_time,
      roundName: (ev.rounds as { name: string; round_number: number } | null)?.name ?? null,
      roundNumber: (ev.rounds as { name: string; round_number: number } | null)?.round_number ?? null,
      resultConfirmed: ev.result_confirmed,
      resultData: ev.result_data,
      winnerPick: null,
      scorePick: null,
      winnerCorrect: null,
      scoreCorrect: null,
      winnerPoints: 0,
      scorePoints: 0,
    });
  }

  // Sort picks by start_time descending (newest first within rounds)
  picks.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  // ── Tags ──
  interface RawTagRow {
    id: string;
    tag_name: string;
    tag_category: TagCategory;
    status: TagStatus;
    stats: Record<string, unknown>;
    assigned_at: string;
    round_id: string | null;
    event_id: string | null;
    rounds: { name: string } | null;
    events: { event_name: string } | null;
  }
  const tagRows = (tagsResult.data ?? []) as unknown as RawTagRow[];
  const allTags: EntrantTagRow[] = tagRows.map((t) => {
    const def = getTagDefinition(t.tag_name);
    const roundObj = t.rounds as { name: string } | null;
    const eventObj = t.events as { event_name: string } | null;
    return {
      id: t.id,
      tagName: t.tag_name,
      tagCategory: t.tag_category,
      status: t.status,
      stats: (t.stats ?? {}) as Record<string, unknown>,
      assignedAt: t.assigned_at,
      roundName: roundObj?.name ?? null,
      eventName: eventObj?.event_name ?? null,
      definition: def
        ? {
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
          }
        : null,
    };
  });

  const activeTags = allTags.filter((t) => t.status === "active");

  // ── Format status ──
  let formatStatus: "alive" | "eliminated" | "dead" | null = null;
  if (formatMembershipResult.data) {
    const status = formatMembershipResult.data.status;
    if (status === "eliminated") formatStatus = "eliminated";
    else if (status === "dead") formatStatus = "dead";
    else formatStatus = "alive";
  }

  // ── Form streak (last 5 scored rounds) ──
  const rounds = (roundsResult.data ?? []) as Array<{
    id: string;
    name: string;
    round_number: number;
    status: string;
  }>;
  const scoredRounds = rounds
    .filter((r) => r.status === "scored")
    .sort((a, b) => b.round_number - a.round_number)
    .slice(0, 5);

  const formStreak: FormStreakEntry[] = [];
  for (const round of scoredRounds) {
    // Check if user got any winner predictions correct in this round
    const roundPicks = picks.filter((p) => p.roundNumber === round.round_number);
    const anyCorrect = roundPicks.some((p) => p.winnerCorrect === true);
    formStreak.push({
      roundNumber: round.round_number,
      roundName: round.name,
      correct: anyCorrect,
    });
  }
  // Reverse so it reads left-to-right chronologically
  formStreak.reverse();

  // ── Group membership ──
  let group: EntrantGroupInfo | null = null;
  if (groupResult.data?.group_id && formatClassId) {
    const groupId = groupResult.data.group_id;
    const [groupInfoResult, groupMembersResult] = await Promise.all([
      supabase
        .from("format_prediction_groups")
        .select("group_name")
        .eq("id", groupId)
        .single(),
      supabase
        .from("format_group_memberships")
        .select("user_id")
        .eq("group_id", groupId),
    ]);

    if (groupInfoResult.data && groupMembersResult.data) {
      const memberUserIds = groupMembersResult.data.map((m: { user_id: string }) => m.user_id);

      // Format groups use stage-local points (reset per stage).
      // Find the current stage: first non-finalised sporting stage.
      let stageId: string | null = null;
      if (competition.tournament_id) {
        const { data: currentStage } = await supabase
          .from("sporting_stages")
          .select("id")
          .eq("tournament_id", competition.tournament_id)
          .neq("status", "finalised")
          .order("stage_order", { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = currentStage?.id ?? null;
      }

      const [groupUserNames, groupPointsResult] = await Promise.all([
        supabase.from("users").select("id, display_name").in("id", memberUserIds),
        stageId
          ? supabase.rpc("sum_stage_points", {
              p_user_ids: memberUserIds,
              p_sporting_stage_id: stageId,
              p_tournament_id: competition.tournament_id ?? null,
              p_competition_id: competition.id,
            })
          : supabase.rpc("sum_prediction_points", {
              p_user_ids: memberUserIds,
              p_tournament_id: competition.tournament_id ?? null,
              p_competition_id: competition.id,
            }),
      ]);

      const nameMap = new Map(
        (groupUserNames.data ?? []).map((u: { id: string; display_name: string }) => [
          u.id,
          u.display_name,
        ]),
      );
      const gpMap = new Map(
        ((groupPointsResult.data ?? []) as Array<{ user_id: string; total_points: number }>).map(
          (r) => [r.user_id, r.total_points ?? 0],
        ),
      );

      const members: EntrantGroupMember[] = memberUserIds
        .map((uid: string) => ({
          userId: uid,
          displayName: nameMap.get(uid) ?? "Unknown",
          points: gpMap.get(uid) ?? 0,
          isSelf: uid === viewerUserId,
          isTarget: uid === targetUserId,
        }))
        .sort((a: EntrantGroupMember, b: EntrantGroupMember) => b.points - a.points);

      group = {
        groupName: groupInfoResult.data.group_name,
        members,
      };
    }
  }

  return {
    found: true,
    targetUserId,
    displayName: targetUserResult.data.display_name,
    competitionId: competition.id,
    rank,
    totalPoints,
    accuracy,
    formatStatus,
    picks,
    activeTags,
    allTags,
    formStreak,
    group,
    isSelf,
  };
}
