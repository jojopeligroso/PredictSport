import { getReadClient } from "@/lib/wc/archive-client";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
import { utcDateIso } from "@/lib/wc/daily-lock";
import { resolveWcCompetition } from "@/lib/wc/resolve-wc-competition";
import { fixtureFilter } from "@/lib/tournament/shared-fixtures";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

type EventRowWithExternal = WindowEvent & { external_event_id: string | null };

/** Number of fixture-days visible in the sliding window. */
const WINDOW_SIZE_DAYS = 8;

/**
 * Fetch events for the picks-first /wc landing.
 *
 * Group stage (rounds 1-3): 8-day sliding window across all group rounds.
 * The window starts at the earliest UTC date with at least one unconfirmed
 * fixture and includes the next 8 calendar days that have fixtures.
 * When all fixtures on the earliest visible day are confirmed, the window
 * slides forward automatically.
 *
 * Knockout (round 4+): all fixtures for the current round (no sliding).
 */
export async function fetchMd1PicksData() {
  const { competition, user, isMember: resolvedIsMember } = await resolveWcCompetition({
    statuses: ["active", "draft"],
  });

  if (!competition) return { ready: false as const };

  const supabase = await getReadClient();
  const ff = fixtureFilter(competition);

  // Fetch all group-stage rounds (round_number 1-3)
  const { data: groupRounds } = await supabase
    .from("rounds")
    .select("id, status, round_number")
    .eq(ff.key, ff.value)
    .lte("round_number", 3)
    .order("round_number", { ascending: true });

  if (!groupRounds?.length) return { ready: false as const };

  // Check if we're still in group stage (at least one non-scored group round)
  const hasActiveGroupRound = groupRounds.some((r) => r.status !== "scored");

  let eventRows: EventRowWithExternal[];
  let windowLocked: boolean;

  if (hasActiveGroupRound) {
    // ── Group stage: 8-day sliding window ────────────────────────────
    const groupRoundIds = groupRounds.map((r) => r.id);

    const { data: allEventsRaw } = await supabase
      .from("events")
      .select(
        `id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_confirmed, external_event_id,
         event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
      )
      .in("round_id", groupRoundIds)
      .order("start_time", { ascending: true });

    const allGroupEvents = (allEventsRaw ?? []) as EventRowWithExternal[];

    // Group events by UTC date and find dates with unconfirmed fixtures
    const eventsByDate = new Map<string, EventRowWithExternal[]>();
    for (const e of allGroupEvents) {
      const iso = utcDateIso(new Date(e.start_time));
      const list = eventsByDate.get(iso) ?? [];
      list.push(e);
      eventsByDate.set(iso, list);
    }

    // Window start: earliest date with at least one unconfirmed fixture
    const sortedDates = [...eventsByDate.keys()].sort();
    const windowStartIso = sortedDates.find((iso) => {
      const dayEvents = eventsByDate.get(iso) ?? [];
      return dayEvents.some((e) => !e.result_confirmed);
    });

    if (!windowStartIso) {
      // All group fixtures confirmed — fall through to knockout below
      return fetchKnockoutFallback(supabase, competition.id, ff, user, resolvedIsMember);
    }

    // Take 8 fixture-dates from window_start (skipping dates with no fixtures)
    const windowStartIdx = sortedDates.indexOf(windowStartIso);
    const windowDates = new Set(
      sortedDates.slice(windowStartIdx, windowStartIdx + WINDOW_SIZE_DAYS),
    );

    // Filter events to the window
    eventRows = allGroupEvents.filter((e) => {
      const iso = utcDateIso(new Date(e.start_time));
      return windowDates.has(iso);
    });

    // Per-fixture locking — no round-level lock
    windowLocked = false;
  } else {
    // All group rounds scored — fall through to knockout
    return fetchKnockoutFallback(supabase, competition.id, ff, user, resolvedIsMember);
  }

  const events: WindowEvent[] = eventRows.map((row) => ({
    id: row.id,
    event_name: row.event_name,
    sport: row.sport,
    start_time: row.start_time,
    lock_time: row.lock_time,
    status: row.status,
    result_confirmed: row.result_confirmed,
    event_prediction_types: row.event_prediction_types,
  }));

  const isMember = resolvedIsMember;
  let predictions: Prediction[] = [];
  if (user) {
    if (isMember && events.length > 0) {
      const eventIds = events.map((e) => e.id);
      const { data: predRows } = await supabase
        .from("predictions")
        .select(
          "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at, confidence_level",
        )
        .eq("user_id", user.id)
        .in("event_id", eventIds);
      predictions = (predRows ?? []) as Prediction[];
    }
  }

  const fixtureByExternalId = new Map<string, WcFixture>();
  for (const f of WC2026_FIXTURES) fixtureByExternalId.set(f.externalId, f);

  const fixtureByEventId = new Map<string, WcFixture>();
  for (const row of eventRows) {
    if (!row.external_event_id) continue;
    const fixture = fixtureByExternalId.get(row.external_event_id);
    if (fixture) fixtureByEventId.set(row.id, fixture);
  }

  return {
    ready: true as const,
    concluded: false as const,
    competitionId: competition.id,
    events,
    predictions,
    fixtureByEventId,
    isMember,
    isAuthenticated: Boolean(user),
    windowLocked,
  };
}

/**
 * Fallback: all group rounds scored → fetch the first actionable knockout round.
 *
 * If there is no actionable knockout round either, distinguish two terminal
 * states rather than collapsing both into "not ready":
 *  - concluded: every round is scored (the tournament is over) → return a
 *    ready, `concluded` payload so /wc renders the finished experience
 *    (Results / Fixtures / Groups tabs + round index) instead of the
 *    pre-launch "coming soon" panel.
 *  - not started: no scored rounds yet (genuinely pre-launch) → ready: false.
 */
async function fetchKnockoutFallback(
  supabase: Awaited<ReturnType<typeof getReadClient>>,
  competitionId: string,
  ff: { key: "tournament_id" | "competition_id"; value: string },
  user: { id: string } | null,
  resolvedIsMember: boolean,
) {
  const { data: koRound } = await supabase
    .from("rounds")
    .select("id, status")
    .eq(ff.key, ff.value)
    .gt("round_number", 3)
    .in("status", ["draft", "open", "locked"])
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!koRound) {
    // No actionable round anywhere. Concluded iff at least one round exists
    // and every round is scored; otherwise treat as pre-launch.
    const { data: roundStatuses } = await supabase
      .from("rounds")
      .select("status")
      .eq(ff.key, ff.value);
    const rounds = roundStatuses ?? [];
    const concluded =
      rounds.length > 0 && rounds.every((r) => r.status === "scored");

    if (concluded) {
      return {
        ready: true as const,
        concluded: true as const,
        competitionId,
        events: [] as WindowEvent[],
        predictions: [] as Prediction[],
        fixtureByEventId: new Map<string, WcFixture>(),
        isMember: resolvedIsMember,
        isAuthenticated: Boolean(user),
        windowLocked: true,
      };
    }
    return { ready: false as const };
  }

  const { data: eventsRaw } = await supabase
    .from("events")
    .select(
      `id, event_name, sport, start_time, lock_time, pick_reveal_at, status, result_confirmed, external_event_id,
       event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
    )
    .eq("round_id", koRound.id)
    .order("start_time", { ascending: true });

  const eventRows = (eventsRaw ?? []) as EventRowWithExternal[];
  const events: WindowEvent[] = eventRows.map((row) => ({
    id: row.id,
    event_name: row.event_name,
    sport: row.sport,
    start_time: row.start_time,
    lock_time: row.lock_time,
    status: row.status,
    result_confirmed: row.result_confirmed,
    event_prediction_types: row.event_prediction_types,
  }));

  const fixtureByExternalId = new Map<string, WcFixture>();
  for (const f of WC2026_FIXTURES) fixtureByExternalId.set(f.externalId, f);

  const fixtureByEventId = new Map<string, WcFixture>();
  for (const row of eventRows) {
    if (!row.external_event_id) continue;
    const fixture = fixtureByExternalId.get(row.external_event_id);
    if (fixture) fixtureByEventId.set(row.id, fixture);
  }

  const isMember = resolvedIsMember;
  let predictions: Prediction[] = [];
  if (user) {
    if (isMember && events.length > 0) {
      const eventIds = events.map((e) => e.id);
      const { data: predRows } = await supabase
        .from("predictions")
        .select(
          "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at, confidence_level",
        )
        .eq("user_id", user.id)
        .in("event_id", eventIds);
      predictions = (predRows ?? []) as Prediction[];
    }
  }

  const windowLocked =
    koRound.status === "locked" || koRound.status === "scored";

  return {
    ready: true as const,
    concluded: false as const,
    competitionId,
    events,
    predictions,
    fixtureByEventId,
    isMember,
    isAuthenticated: Boolean(user),
    windowLocked,
  };
}
