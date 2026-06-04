import { createClient } from "@/lib/supabase/server";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

type EventRowWithExternal = WindowEvent & { external_event_id: string | null };

export interface DashboardData {
  ready: true;
  competitionId: string;
  /** Next upcoming events (up to 4 from the next unlocked day). */
  nextEvents: WindowEvent[];
  /** User's predictions for those events. */
  predictions: Prediction[];
  /** Fixture metadata keyed by event.id. */
  fixtureByEventId: Map<string, WcFixture>;
  /** Today's completed fixtures with results. */
  todayFixtures: WcFixture[];
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

  // 2. Parallel fetches: round, member count, membership, classification
  const [roundResult, memberCountResult, membershipResult, classificationResult] =
    await Promise.all([
      // Current/next open round
      supabase
        .from("rounds")
        .select("id, status, round_number")
        .eq("competition_id", competition.id)
        .in("status", ["draft", "open", "locked", "scored"])
        .order("round_number", { ascending: true })
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

  const currentRound = roundResult.data;
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

  // 6. Today's completed fixtures
  const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const todayFixtures = WC2026_FIXTURES.filter((f) => {
    const fDate = new Date(f.kickoffUtc);
    const fIso = `${fDate.getUTCFullYear()}-${String(fDate.getUTCMonth() + 1).padStart(2, "0")}-${String(fDate.getUTCDate()).padStart(2, "0")}`;
    return fIso === todayIso;
  });

  const windowLocked =
    currentRound.status === "locked" || currentRound.status === "scored";

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
    todayFixtures,
    classificationId,
    inviteCode,
    entryClosesAt,
    memberCount,
    isMember,
    isAuthenticated: Boolean(user),
    windowLocked,
  };
}
