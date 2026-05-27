import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Md1PicksLanding } from "./_landing/Md1PicksLanding";
import { WC2026_FIXTURES, type WcFixture } from "@/lib/wc/fixtures";
import type { WindowEvent } from "./picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * /wc — picks-first World Cup landing (ADR 0014).
 *
 * The page IS the matchday-1 group-stage picker. Resolves:
 *   1. The WC competition (product_mode = world_cup_2026_shell, status active).
 *   2. Its MD1 round (round_number = 1).
 *   3. Events + EPTs for that round.
 *   4. The current user's predictions for those events (if logged in & member).
 *   5. WcFixture metadata (city colour, group letter, kickoff UTC) keyed by
 *      event.id so the card surface can render correctly.
 *
 * Anonymous + non-member visitors see a blurred preview with a tap-to-join
 * overlay (per ADR 0014). The hero / progress / calendar / toggle stay crisp.
 */
export default async function WorldCupLanding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve the WC competition. Public read on the row; safe to fetch
  // anonymously.
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, status")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"])
    .limit(1)
    .maybeSingle();

  if (!competition) {
    return <ComingSoonPanel />;
  }

  // MD1 round. round_number = 1 = first prediction window (group matchday 1).
  // Sorting is defensive — production seeding only has one MD1 round.
  const { data: md1Round } = await supabase
    .from("rounds")
    .select("id, status")
    .eq("competition_id", competition.id)
    .eq("round_number", 1)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!md1Round) {
    return <ComingSoonPanel />;
  }

  // Events for MD1. Same shape as /wc/picks/[windowId]/page.tsx (lines 89–96)
  // plus external_event_id so we can look up fixture metadata. The select uses
  // the same nested syntax to pull event_prediction_types in one round-trip.
  const { data: eventsRaw } = await supabase
    .from("events")
    .select(
      `id, event_name, sport, start_time, lock_time, status, result_confirmed, external_event_id,
       event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
    )
    .eq("round_id", md1Round.id)
    .order("start_time", { ascending: true });

  type EventRowWithExternal = WindowEvent & { external_event_id: string | null };
  const eventRows = (eventsRaw ?? []) as EventRowWithExternal[];
  const events: WindowEvent[] = eventRows.map((row) => {
    // Strip the extra external_event_id before handing rows to WindowEvent
    // consumers — the landing already used it to build fixtureByEventId.
    const {
      id,
      event_name,
      sport,
      start_time,
      lock_time,
      status,
      result_confirmed,
      event_prediction_types,
    } = row;
    return {
      id,
      event_name,
      sport,
      start_time,
      lock_time,
      status,
      result_confirmed,
      event_prediction_types,
    };
  });

  // Membership + predictions are only relevant for signed-in users.
  let isMember = false;
  let predictions: Prediction[] = [];
  if (user) {
    const { data: membership } = await supabase
      .from("competition_members")
      .select("id")
      .eq("competition_id", competition.id)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = Boolean(membership);

    if (isMember && events.length > 0) {
      const eventIds = events.map((e) => e.id);
      const { data: predRows } = await supabase
        .from("predictions")
        .select(
          "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at",
        )
        .eq("user_id", user.id)
        .in("event_id", eventIds);
      predictions = (predRows ?? []) as Prediction[];
    }
  }

  // Build the event.id → WcFixture map. Lookup is by external_event_id, the
  // canonical key used by both the seed script and src/lib/wc/fixtures.ts.
  const fixtureByExternalId = new Map<string, WcFixture>();
  for (const f of WC2026_FIXTURES) fixtureByExternalId.set(f.externalId, f);

  const fixtureByEventId = new Map<string, WcFixture>();
  for (const row of eventRows) {
    if (!row.external_event_id) continue;
    const fixture = fixtureByExternalId.get(row.external_event_id);
    if (fixture) fixtureByEventId.set(row.id, fixture);
  }

  const windowLocked =
    md1Round.status === "locked" || md1Round.status === "scored";

  return (
    <Md1PicksLanding
      competitionId={competition.id}
      events={events}
      predictions={predictions}
      fixtureByEventId={fixtureByEventId}
      isMember={isMember}
      isAuthenticated={Boolean(user)}
      windowLocked={windowLocked}
    />
  );
}

function ComingSoonPanel() {
  return (
    <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ps-amber-deep">
        Coming soon
      </p>
      <h1 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-ps-text">
        The World Cup is being set up.
      </h1>
      <p className="mt-3 text-sm text-ps-text-sec">
        Drop back closer to June. We&apos;re seeding the fixtures, polishing the
        scoring, and getting the chairs out.
      </p>
      <Link
        href="/wc/rules"
        className="mt-6 inline-block text-xs text-ps-text-sec underline-offset-2 hover:text-ps-text hover:underline"
      >
        See the rules →
      </Link>
    </div>
  );
}
