import { createClient } from "@/lib/supabase/server";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
import { describeDraftProgress } from "@/lib/bracket/bracket-progress";
import { computeGroupStandings } from "@/lib/wc/compute-group-standings";
import { utcDateIso } from "@/lib/wc/daily-lock";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";
import type { BracketSubmissionData } from "@/types/tournament";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";

/** Number of fixture-days visible in the sliding window. */
const WINDOW_SIZE_DAYS = 8;

type EventRowWithExternal = WindowEvent & { external_event_id: string | null };

export interface DatePillSummary {
  iso: string;
  weekday: string;
  dayNum: number;
  totalCount: number;
  fullyComplete: number;
  hasAnyOutcome: boolean;
  lockTime: string;
}

/** A single completed match with result data and the user's prediction outcome. */
export interface ResultRow {
  fixture: WcFixture;
  startTime: string;
  homeScore: number;
  awayScore: number;
  /** "home" | "away" | "draw" */
  winner: string;
  /** User's winner prediction value (team name or "draw"), null if no prediction. */
  userWinnerPick: string | null;
  /** User's exact score prediction, null if none. */
  userScorePick: { home: number; away: number } | null;
  /** Did user get the winner right? null = no prediction. */
  winnerCorrect: boolean | null;
  /** Did user get the exact score right? null = no prediction. */
  scoreCorrect: boolean | null;
  /** Points awarded for winner prediction. */
  winnerPoints: number;
  /** Points awarded for exact score prediction. */
  scorePoints: number;
  /** User's confidence level (1-5) on their winner prediction, null if not set. */
  userConfidence: number | null;
}

export interface LastChatMessage {
  senderName: string;
  senderAvatar: string | null;
  content: string;
  createdAt: string;
}

export interface DashboardData {
  ready: true;
  competitionId: string;
  /** Next upcoming events (up to 4 from the next unlocked day). */
  nextEvents: WindowEvent[];
  /** User's predictions for those events. */
  predictions: Prediction[];
  /** Fixture metadata keyed by event.id. */
  fixtureByEventId: Map<string, WcFixture>;
  /** Most recent completed matchday results with user prediction outcomes. */
  recentResults: ResultRow[];
  /** Classification IDs for group/standings lookup. */
  classificationId: string | null;
  /** Competition invite code (null if no code or entry closed). */
  inviteCode: string | null;
  /** When entry closes. */
  entryClosesAt: string | null;
  /** Current member count. */
  memberCount: number;
  /** Whether the user is a member. */
  isMember: boolean;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** Whether the current round window is locked. */
  windowLocked: boolean;
  /** Groups that have matches on the next matchday. */
  todayGroups: string[];
  /** Events for today's groups keyed by group letter, for accordion mode. */
  todayGroupEvents: Map<string, WindowEvent[]>;
  /** Bracket draft progress, null if user has no bracket activity. */
  bracketProgress: { pct: number; label: string } | null;
  /** Live group standings from confirmed results, keyed by group letter. */
  groupStandings: Record<string, TeamWithStats[]>;
  /** All events across the 3 pill dates (for client-side date filtering). */
  pillDateEvents: WindowEvent[];
  /** Date pill summaries for the first 3 unlocked matchdays. */
  datePills: DatePillSummary[];
  /** Whether chat is enabled for this competition. */
  chatEnabled: boolean;
  /** Whether the current user is an admin/co-admin. */
  isCompetitionAdmin: boolean;
  /** The current user's role in the competition. */
  memberRole: string;
  /** Last non-join chat message for the notification card. */
  lastChatMessage: LastChatMessage | null;
}

export type DashboardResult =
  | { ready: false }
  | DashboardData;

/**
 * Fetch all data needed for the WC Dashboard home page.
 * Runs server-side. Reuses the same Supabase patterns as fetchMd1PicksData.
 */
export async function fetchDashboardData(): Promise<DashboardResult> {
  const { competition, user, isMember: resolvedIsMember } = await resolveWcCompetition({
    statuses: ["active", "draft"],
  });

  if (!competition) return { ready: false };

  const supabase = await createClient();

  // 2. Parallel fetches: round (actionable + scored fallback), member count, membership, classification
  const [
    actionableRoundResult,
    scoredRoundResult,
    memberCountResult,
    membershipResult,
    classificationResult,
  ] = await Promise.all([
      // Actionable round: draft/open/locked — lowest round_number first
      supabase
        .from("rounds")
        .select("id, status, round_number")
        .eq("competition_id", competition.id)
        .in("status", ["draft", "open", "locked"])
        .order("round_number", { ascending: true })
        .limit(1)
        .maybeSingle(),
      // Fallback: most recently scored round (for result display when no actionable round)
      supabase
        .from("rounds")
        .select("id, status, round_number")
        .eq("competition_id", competition.id)
        .eq("status", "scored")
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Member count
      supabase
        .from("competition_members")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competition.id),
      // User membership role (membership already resolved, but need role for admin check)
      user
        ? supabase
            .from("competition_members")
            .select("id, role")
            .eq("competition_id", competition.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Format classification (for group table / standings)
      supabase
        .from("classifications")
        .select("id")
        .eq("competition_id", competition.id)
        .eq("classification_key", "format")
        .maybeSingle(),
    ]);

  // Prefer actionable round; fall back to most recent scored round
  const currentRound = actionableRoundResult.data ?? scoredRoundResult.data;
  const membership = membershipResult.data;
  const isMember = resolvedIsMember;
  const isCompetitionAdmin = membership?.role === "admin" || membership?.role === "co_admin";
  const memberCount = memberCountResult.count ?? 0;
  const classificationId = classificationResult.data?.id ?? null;

  if (!currentRound) return { ready: false };

  // 3. Fetch events — sliding window for group stage, full round for knockout
  const isGroupStage = currentRound.round_number <= 3;
  let eventRows: EventRowWithExternal[];

  if (isGroupStage) {
    // Fetch ALL group-stage events across rounds 1-3
    const { data: groupRounds } = await supabase
      .from("rounds")
      .select("id")
      .eq("competition_id", competition.id)
      .lte("round_number", 3);

    const groupRoundIds = (groupRounds ?? []).map((r: { id: string }) => r.id);

    const { data: allGroupEventsRaw } = await supabase
      .from("events")
      .select(
        `id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_confirmed, external_event_id,
         event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
      )
      .in("round_id", groupRoundIds)
      .order("start_time", { ascending: true });

    const allGroupEvents = (allGroupEventsRaw ?? []) as EventRowWithExternal[];

    // Group by date, find earliest date with unconfirmed fixtures
    const eventsByDate = new Map<string, EventRowWithExternal[]>();
    for (const e of allGroupEvents) {
      const iso = utcDateIso(new Date(e.start_time));
      const list = eventsByDate.get(iso) ?? [];
      list.push(e);
      eventsByDate.set(iso, list);
    }

    const allDates = [...eventsByDate.keys()].sort();
    const windowStartIso = allDates.find((iso) =>
      (eventsByDate.get(iso) ?? []).some((e) => !e.result_confirmed),
    );

    if (windowStartIso) {
      const windowStartIdx = allDates.indexOf(windowStartIso);
      const windowDates = new Set(
        allDates.slice(windowStartIdx, windowStartIdx + WINDOW_SIZE_DAYS),
      );
      eventRows = allGroupEvents.filter((e) =>
        windowDates.has(utcDateIso(new Date(e.start_time))),
      );
    } else {
      // All group fixtures confirmed — fall back to current round events
      eventRows = [];
    }
  } else {
    // Knockout: fetch all events for the current round
    const { data: eventsRaw } = await supabase
      .from("events")
      .select(
        `id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_confirmed, external_event_id,
         event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
      )
      .eq("round_id", currentRound.id)
      .order("start_time", { ascending: true });

    eventRows = (eventsRaw ?? []) as EventRowWithExternal[];
  }

  // Build fixture map
  const fixtureByExternalId = new Map<string, WcFixture>();
  for (const f of WC2026_FIXTURES) fixtureByExternalId.set(f.externalId, f);

  const fixtureByEventId = new Map<string, WcFixture>();
  for (const row of eventRows) {
    if (!row.external_event_id) continue;
    const fixture = fixtureByExternalId.get(row.external_event_id);
    if (fixture) fixtureByEventId.set(row.id, fixture);
  }

  // 4. Filter to next upcoming events (up to 4 from next unlocked day)
  //    Also include in-progress events (locked but not yet resulted) so
  //    the dashboard can show the user's locked prediction during a match.
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const inProgress = eventRows.filter(
    (e) =>
      new Date(e.lock_time) <= now &&
      new Date(e.start_time) >= sixHoursAgo &&
      !e.result_confirmed &&
      e.status !== "cancelled" &&
      e.status !== "postponed",
  );
  const unlocked = eventRows.filter(
    (e) => new Date(e.lock_time) > now && e.status !== "resulted",
  );

  // Group by UTC date, take the first day with events
  const byDate = new Map<string, EventRowWithExternal[]>();
  for (const e of unlocked) {
    const d = new Date(e.start_time);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const list = byDate.get(iso) ?? [];
    list.push(e);
    byDate.set(iso, list);
  }
  const sortedDates = [...byDate.keys()].sort();

  // Collect events from the first day; spill into subsequent days until we
  // have at least 2 (or run out of unlocked events). Still cap at 4 max.
  const spilledEvents: EventRowWithExternal[] = [];
  for (const d of sortedDates) {
    const dayEvents = byDate.get(d) ?? [];
    for (const e of dayEvents) {
      if (spilledEvents.length >= 4) break;
      spilledEvents.push(e);
    }
    if (spilledEvents.length >= 2) break;
    if (spilledEvents.length >= 4) break;
  }
  // In-progress events appear first (auto-expanded), then upcoming picks
  const nextDayEvents = [...inProgress, ...spilledEvents];

  // Derive which groups play on the next matchday — use ALL first-day events
  // (not the capped hero picks) so the accordion shows complete group data.
  const firstDayAllEvents: EventRowWithExternal[] =
    sortedDates.length > 0 ? (byDate.get(sortedDates[0]) ?? []) : [];
  const todayGroupsSet = new Set<string>();
  const todayGroupEvents = new Map<string, WindowEvent[]>();
  for (const row of firstDayAllEvents) {
    if (!row.external_event_id) continue;
    const fixture = fixtureByExternalId.get(row.external_event_id);
    if (fixture?.group) {
      todayGroupsSet.add(fixture.group);
      const event: WindowEvent = {
        id: row.id,
        event_name: row.event_name,
        sport: row.sport,
        start_time: row.start_time,
        lock_time: row.lock_time,
        status: row.status,
        result_confirmed: row.result_confirmed,
        event_prediction_types: row.event_prediction_types,
      };
      const existing = todayGroupEvents.get(fixture.group) ?? [];
      existing.push(event);
      todayGroupEvents.set(fixture.group, existing);
    }
  }
  const todayGroups = [...todayGroupsSet].sort();

  const nextEvents: WindowEvent[] = nextDayEvents.map((row) => ({
    id: row.id,
    event_name: row.event_name,
    sport: row.sport,
    start_time: row.start_time,
    lock_time: row.lock_time,
    status: row.status,
    result_confirmed: row.result_confirmed,
    event_prediction_types: row.event_prediction_types,
  }));

  // 5. Fetch predictions for all round events (hero picks + group accordion)
  let predictions: Prediction[] = [];
  if (user && isMember && eventRows.length > 0) {
    const eventIds = eventRows.map((e) => e.id);
    const { data: predRows } = await supabase
      .from("predictions")
      .select(
        "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at, confidence_level",
      )
      .eq("user_id", user.id)
      .in("event_id", eventIds);
    predictions = (predRows ?? []) as Prediction[];
  }

  // Build date pill summaries for the window.
  // Group stage: ALL dates in the 8-day window (including locked-but-unconfirmed).
  // Knockout: first 3 unlocked dates (original behavior).
  const allWindowByDate = new Map<string, EventRowWithExternal[]>();
  for (const e of eventRows) {
    const iso = utcDateIso(new Date(e.start_time));
    const list = allWindowByDate.get(iso) ?? [];
    list.push(e);
    allWindowByDate.set(iso, list);
  }
  const allWindowDates = [...allWindowByDate.keys()].sort();

  const pillDates = isGroupStage ? allWindowDates.slice(0, 3) : sortedDates.slice(0, 3);
  const pillSource = isGroupStage ? allWindowByDate : byDate;

  const datePills: DatePillSummary[] = pillDates.map((iso) => {
    const dayEvents = pillSource.get(iso) ?? [];
    const dayEventIds = new Set(dayEvents.map((e) => e.id));
    const dayPreds = predictions.filter((p) => dayEventIds.has(p.event_id));

    let fullyComplete = 0;
    let hasAnyOutcome = false;
    for (const ev of dayEvents) {
      const evPreds = dayPreds.filter((p) => p.event_id === ev.id);
      const hasWinner = evPreds.some((p) => p.prediction_type === "winner");
      const hasScore = evPreds.some((p) => p.prediction_type === "exact_score");
      if (hasWinner && hasScore) fullyComplete++;
      if (hasWinner || hasScore) hasAnyOutcome = true;
    }

    const lockTimes = dayEvents.map((e) => e.lock_time).sort();
    const d = new Date(iso + "T00:00:00Z");
    const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

    return {
      iso,
      weekday,
      dayNum: d.getUTCDate(),
      totalCount: dayEvents.length,
      fullyComplete,
      hasAnyOutcome,
      lockTime: lockTimes[0] ?? iso,
    };
  });

  // All events for pill dates (client-side date filtering)
  const pillDateEvents: WindowEvent[] = pillDates.flatMap((iso) =>
    (pillSource.get(iso) ?? []).map((row) => ({
      id: row.id,
      event_name: row.event_name,
      sport: row.sport,
      start_time: row.start_time,
      lock_time: row.lock_time,
      status: row.status,
      result_confirmed: row.result_confirmed,
      event_prediction_types: row.event_prediction_types,
    })),
  );

  // 6. Most recent completed matchday results + live group standings (parallel)
  const [recentResults, standingsMap] = await Promise.all([
    fetchRecentResults(supabase, competition.id, fixtureByExternalId, user?.id ?? null),
    computeGroupStandings(supabase, competition.id),
  ]);
  const groupStandings = Object.fromEntries(standingsMap);

  // Group stage: per-fixture locking via lock_time, no round-level lock.
  // Knockout: round-level lock as before.
  const windowLocked = isGroupStage
    ? false
    : currentRound.status === "locked" || currentRound.status === "scored";

  // 7. Bracket progress
  // Group picks must be counted across ALL group-stage events for the
  // competition, not just the current round's eventRows. Otherwise the
  // progress bar resets/undercounts once the dashboard round advances.
  let bracketProgress: { pct: number; label: string } | null = null;
  if (user && isMember) {
    const [bracketSubResult, groupEventsResult] = await Promise.all([
      supabase
        .from("bracket_prediction_submissions")
        .select("bracket_data")
        .eq("competition_id", competition.id)
        .eq("user_id", user.id)
        .eq("is_superseded", false)
        .maybeSingle(),
      competition.tournament_id
        ? supabase
            .from("events")
            .select("id")
            .eq("tournament_id", competition.tournament_id)
            .like("external_event_id", "manual:wc2026-grp-%")
        : supabase
            .from("events")
            .select("id")
            .eq("competition_id", competition.id)
            .like("external_event_id", "manual:wc2026-grp-%"),
    ]);

    const allGroupEventIds = (groupEventsResult.data ?? []).map(
      (e: { id: string }) => e.id,
    );

    let groupPicksCount = 0;
    if (allGroupEventIds.length > 0) {
      const { count } = await supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("prediction_type", "winner")
        .in("event_id", allGroupEventIds);
      groupPicksCount = count ?? 0;
    }

    const bracketData = (bracketSubResult.data?.bracket_data as BracketSubmissionData) ?? null;
    const progress = describeDraftProgress(bracketData, groupPicksCount);
    if (progress.pct > 0) {
      bracketProgress = progress;
    }
  }

  // Invite code — only show if entry is still open and competition isn't full
  const entryClosesAt = competition.entry_closes_at ?? null;
  const competitionFull = competition.max_entrants && memberCount >= competition.max_entrants;
  const entryOpen = !competitionFull && (!entryClosesAt || new Date(entryClosesAt) > now);
  const inviteCode = entryOpen ? (competition.invite_code ?? null) : null;

  // Last chat message for notification card (non-join, non-result, non-deleted).
  // Reckons are social content — include them in the preview.
  let lastChatMessage: LastChatMessage | null = null;
  if (competition.chat_enabled) {
    const { data: msg } = await supabase
      .from("chat_messages")
      .select("content, created_at, user_id")
      .eq("competition_id", competition.id)
      .in("message_type", ["user", "system_reckons"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (msg) {
      const { data: sender } = await supabase
        .from("users")
        .select("display_name, avatar_url")
        .eq("id", msg.user_id)
        .single();

      lastChatMessage = {
        senderName: sender?.display_name ?? "Someone",
        senderAvatar: sender?.avatar_url ?? null,
        content: msg.content,
        createdAt: msg.created_at,
      };
    }
  }

  return {
    ready: true,
    competitionId: competition.id,
    nextEvents,
    pillDateEvents,
    predictions,
    fixtureByEventId,
    recentResults,
    classificationId,
    todayGroups,
    todayGroupEvents,
    inviteCode,
    entryClosesAt,
    memberCount,
    isMember,
    isAuthenticated: Boolean(user),
    windowLocked,
    bracketProgress,
    groupStandings,
    datePills,
    chatEnabled: competition.chat_enabled ?? true,
    isCompetitionAdmin,
    memberRole: membership?.role ?? "participant",
    lastChatMessage,
  };
}

// ---------------------------------------------------------------------------
// Recent results helper
// ---------------------------------------------------------------------------

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function fetchRecentResults(
  supabase: SupabaseClient,
  competitionId: string,
  fixtureByExternalId: Map<string, WcFixture>,
  userId: string | null,
): Promise<ResultRow[]> {
  // Fetch resulted events from the last 48h. No date grouping — the client
  // applies a 6AM-local-anchor window to handle users across all timezones.
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: completedEvents } = await supabase
    .from("events")
    .select("id, external_event_id, start_time, result_data")
    .eq("competition_id", competitionId)
    .eq("status", "resulted")
    .not("result_data", "is", null)
    .gte("start_time", cutoff)
    .order("start_time", { ascending: false })
    .limit(20);

  if (!completedEvents?.length) return [];

  // Fetch user's predictions for these events (if logged in)
  type PredRow = {
    event_id: string;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    points_awarded: number;
    confidence_level: number | null;
  };
  const predsByEventId = new Map<string, PredRow[]>();

  if (userId) {
    const eventIds = completedEvents.map((e) => e.id);
    const { data: preds } = await supabase
      .from("predictions")
      .select(
        "event_id, prediction_type, prediction_data, is_correct, points_awarded, confidence_level",
      )
      .eq("user_id", userId)
      .in("event_id", eventIds);

    for (const p of (preds ?? []) as PredRow[]) {
      const list = predsByEventId.get(p.event_id) ?? [];
      list.push(p);
      predsByEventId.set(p.event_id, list);
    }
  }

  // Assemble result rows
  const recentResults: ResultRow[] = [];
  for (const e of completedEvents) {
    if (!e.external_event_id) continue;
    const fixture = fixtureByExternalId.get(e.external_event_id);
    if (!fixture) continue;

    // Extract scores — handle all three shapes:
    // 1. Nested (ESPN auto-resolve): result_data.score.home_score
    // 2. Flat snake_case (manual): result_data.home_score
    // 3. Flat camelCase: result_data.homeScore
    const rd = (e.result_data ?? {}) as Record<string, unknown>;
    const scores = extractResultScores(rd);
    if (!scores) continue;

    const winner =
      scores.home > scores.away
        ? "home"
        : scores.away > scores.home
          ? "away"
          : "draw";

    const preds = predsByEventId.get(e.id) ?? [];
    const winnerPred = preds.find((p) => p.prediction_type === "winner");
    const scorePred = preds.find(
      (p) => p.prediction_type === "exact_score",
    );

    // Extract user's winner pick value
    const userWinnerPick: string | null =
      (winnerPred?.prediction_data?.value as string) ??
      (winnerPred?.prediction_data?.selection as string) ??
      null;

    // Extract user's score pick
    let userScorePick: { home: number; away: number } | null = null;
    if (scorePred?.prediction_data) {
      const sd = scorePred.prediction_data;
      const h = Number(sd.home ?? sd.home_score);
      const a = Number(sd.away ?? sd.away_score);
      if (!isNaN(h) && !isNaN(a)) userScorePick = { home: h, away: a };
    }

    recentResults.push({
      fixture,
      startTime: e.start_time,
      homeScore: scores.home,
      awayScore: scores.away,
      winner,
      userWinnerPick,
      userScorePick,
      winnerCorrect: winnerPred ? (winnerPred.is_correct ?? false) : null,
      scoreCorrect: scorePred ? (scorePred.is_correct ?? false) : null,
      winnerPoints: winnerPred?.points_awarded ?? 0,
      scorePoints: scorePred?.points_awarded ?? 0,
      userConfidence: winnerPred?.confidence_level ?? null,
    });
  }

  return recentResults;
}

/**
 * Extract home/away scores from result_data, handling all three shapes:
 * 1. Nested (ESPN): result_data.score.home_score
 * 2. Flat snake_case (manual): result_data.home_score
 * 3. Flat camelCase: result_data.homeScore
 * Mirrors compute-group-standings.ts extractScores().
 */
function extractResultScores(
  rd: Record<string, unknown>,
): { home: number; away: number } | null {
  // Top-level flat shape
  let home = numOrNull(rd.home_score ?? rd.homeScore);
  let away = numOrNull(rd.away_score ?? rd.awayScore);
  if (home !== null && away !== null) return { home, away };

  // Nested score shape (ESPN auto-resolve)
  const score = rd.score as Record<string, unknown> | undefined;
  if (score) {
    home = numOrNull(score.home_score ?? score.home);
    away = numOrNull(score.away_score ?? score.away);
    if (home !== null && away !== null) return { home, away };
  }

  return null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
