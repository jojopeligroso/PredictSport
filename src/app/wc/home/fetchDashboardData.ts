import { createClient } from "@/lib/supabase/server";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
import { describeDraftProgress } from "@/lib/bracket/bracket-progress";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";
import type { BracketSubmissionData } from "@/types/tournament";

type EventRowWithExternal = WindowEvent & { external_event_id: string | null };

/** A single completed match with result data and the user's prediction outcome. */
export interface ResultRow {
  fixture: WcFixture;
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
  /** Label for the results section (e.g. "Today's Results" or "Jun 12 Results"). */
  resultsLabel: string;
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
  /** Bracket draft progress, null if user has no bracket activity. */
  bracketProgress: { pct: number; label: string } | null;
}

export type DashboardResult =
  | { ready: false }
  | DashboardData;

/**
 * Fetch all data needed for the WC Dashboard home page.
 * Runs server-side. Reuses the same Supabase patterns as fetchMd1PicksData.
 */
export async function fetchDashboardData(): Promise<DashboardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Find the WC competition
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, status, invite_code, entry_closes_at")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"])
    .limit(1)
    .maybeSingle();

  if (!competition) return { ready: false };

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
      // User membership
      user
        ? supabase
            .from("competition_members")
            .select("id")
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
  const isMember = Boolean(membershipResult.data);
  const memberCount = memberCountResult.count ?? 0;
  const classificationId = classificationResult.data?.id ?? null;

  if (!currentRound) return { ready: false };

  // 3. Fetch events for the current round
  const { data: eventsRaw } = await supabase
    .from("events")
    .select(
      `id, event_name, sport, start_time, lock_time, status, result_confirmed, external_event_id,
       event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
    )
    .eq("round_id", currentRound.id)
    .order("start_time", { ascending: true });

  const eventRows = (eventsRaw ?? []) as EventRowWithExternal[];

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
  const now = new Date();
  const unlocked = eventRows.filter(
    (e) => new Date(e.lock_time) > now && e.status !== "completed",
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
  const nextDayEvents = sortedDates.length > 0 ? (byDate.get(sortedDates[0]) ?? []) : [];
  const nextEvents: WindowEvent[] = nextDayEvents.slice(0, 4).map((row) => ({
    id: row.id,
    event_name: row.event_name,
    sport: row.sport,
    start_time: row.start_time,
    lock_time: row.lock_time,
    status: row.status,
    result_confirmed: row.result_confirmed,
    event_prediction_types: row.event_prediction_types,
  }));

  // 5. Fetch predictions for the upcoming events
  let predictions: Prediction[] = [];
  if (user && isMember && nextEvents.length > 0) {
    const eventIds = nextEvents.map((e) => e.id);
    const { data: predRows } = await supabase
      .from("predictions")
      .select(
        "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at",
      )
      .eq("user_id", user.id)
      .in("event_id", eventIds);
    predictions = (predRows ?? []) as Prediction[];
  }

  // 6. Most recent completed matchday results with user prediction outcomes
  const { recentResults, resultsLabel } = await fetchRecentResults(
    supabase,
    competition.id,
    fixtureByExternalId,
    user?.id ?? null,
  );

  const windowLocked =
    currentRound.status === "locked" || currentRound.status === "scored";

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
      supabase
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

  // Invite code — only show if entry is still open
  const entryClosesAt = competition.entry_closes_at ?? null;
  const entryOpen = !entryClosesAt || new Date(entryClosesAt) > now;
  const inviteCode = entryOpen ? (competition.invite_code ?? null) : null;

  return {
    ready: true,
    competitionId: competition.id,
    nextEvents,
    predictions,
    fixtureByEventId,
    recentResults,
    resultsLabel,
    classificationId,
    inviteCode,
    entryClosesAt,
    memberCount,
    isMember,
    isAuthenticated: Boolean(user),
    windowLocked,
    bracketProgress,
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
): Promise<{ recentResults: ResultRow[]; resultsLabel: string }> {
  // Fetch all completed events with result_data
  const { data: completedEvents } = await supabase
    .from("events")
    .select("id, external_event_id, start_time, result_data")
    .eq("competition_id", competitionId)
    .eq("status", "completed")
    .not("result_data", "is", null)
    .order("start_time", { ascending: false });

  if (!completedEvents?.length) {
    return { recentResults: [], resultsLabel: "Results" };
  }

  // Group completed events by UTC date, pick today or most recent
  const byDate = new Map<string, typeof completedEvents>();
  for (const e of completedEvents) {
    const d = new Date(e.start_time);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const list = byDate.get(iso) ?? [];
    list.push(e);
    byDate.set(iso, list);
  }

  const now = new Date();
  const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  // Prefer today; otherwise most recent date
  let targetDate = todayIso;
  if (!byDate.has(todayIso)) {
    const sortedDates = [...byDate.keys()].sort().reverse();
    targetDate = sortedDates[0];
  }

  const matchdayEvents = byDate.get(targetDate) ?? [];
  // Sort chronologically within the matchday
  matchdayEvents.sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  // Build label
  const isToday = targetDate === todayIso;
  let resultsLabel = "Today's Results";
  if (!isToday) {
    const d = new Date(targetDate + "T12:00:00Z");
    resultsLabel = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }) + " Results";
  }

  // Fetch user's predictions for these events (if logged in)
  type PredRow = {
    event_id: string;
    prediction_type: string;
    prediction_data: Record<string, unknown>;
    is_correct: boolean | null;
    points_awarded: number;
  };
  const predsByEventId = new Map<string, PredRow[]>();

  if (userId) {
    const eventIds = matchdayEvents.map((e) => e.id);
    const { data: preds } = await supabase
      .from("predictions")
      .select("event_id, prediction_type, prediction_data, is_correct, points_awarded")
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
  for (const e of matchdayEvents) {
    if (!e.external_event_id) continue;
    const fixture = fixtureByExternalId.get(e.external_event_id);
    if (!fixture) continue;

    const rd = (e.result_data ?? {}) as Record<string, unknown>;
    const homeScore = numOrNull(rd.home_score ?? rd.homeScore);
    const awayScore = numOrNull(rd.away_score ?? rd.awayScore);
    if (homeScore === null || awayScore === null) continue;

    const winner =
      homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw";

    const preds = predsByEventId.get(e.id) ?? [];
    const winnerPred = preds.find((p) => p.prediction_type === "winner");
    const scorePred = preds.find((p) => p.prediction_type === "exact_score");

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
      homeScore,
      awayScore,
      winner,
      userWinnerPick,
      userScorePick,
      winnerCorrect: winnerPred ? (winnerPred.is_correct ?? false) : null,
      scoreCorrect: scorePred ? (scorePred.is_correct ?? false) : null,
      winnerPoints: winnerPred?.points_awarded ?? 0,
      scorePoints: scorePred?.points_awarded ?? 0,
    });
  }

  return { recentResults, resultsLabel };
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
