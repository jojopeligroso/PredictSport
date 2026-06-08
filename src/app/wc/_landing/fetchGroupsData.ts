import { createClient } from "@/lib/supabase/server";
import { computeGroupStandings } from "@/lib/wc/compute-group-standings";
import type { WindowEvent } from "@/app/wc/picks/[windowId]/WindowPickList";
import type { Prediction } from "@/types/database";
import type { TeamWithStats } from "@/lib/tournament/bracket/types";

type EventRowWithExternal = WindowEvent & { external_event_id: string | null };

/**
 * Fetch all group-stage events and user predictions, grouped by group letter.
 * Group letter is extracted from external_event_id pattern: `manual:wc2026-grp-X-...`
 */
export async function fetchGroupsData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("product_mode", "world_cup_2026_shell")
    .in("status", ["active", "draft"])
    .limit(1)
    .maybeSingle();

  if (!competition) return null;

  const { data: eventsRaw } = await supabase
    .from("events")
    .select(
      `id, event_name, sport, start_time, lock_time, status, result_confirmed, external_event_id,
       event_prediction_types (id, event_id, prediction_type, points, partial_points, config)`,
    )
    .eq("competition_id", competition.id)
    .like("external_event_id", "manual:wc2026-grp-%")
    .order("start_time", { ascending: true });

  const eventRows = (eventsRaw ?? []) as EventRowWithExternal[];

  // Group events by group letter (extracted from external_event_id)
  const groupEvents = new Map<string, WindowEvent[]>();
  for (const row of eventRows) {
    // Pattern: manual:wc2026-grp-A-md1-1
    const match = row.external_event_id?.match(/^manual:wc2026-grp-([A-L])-/);
    if (!match) continue;
    const groupLetter = match[1];
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
    const existing = groupEvents.get(groupLetter) ?? [];
    existing.push(event);
    groupEvents.set(groupLetter, existing);
  }

  // Fetch user predictions and live standings in parallel
  const standingsPromise = computeGroupStandings(supabase, competition.id);

  let predictions: Prediction[] = [];
  if (user && eventRows.length > 0) {
    const eventIds = eventRows.map((e) => e.id);
    const { data: predRows } = await supabase
      .from("predictions")
      .select(
        "id, event_prediction_type_id, event_id, user_id, prediction_type, prediction_data, is_correct, is_partial, points_awarded, note_text, note_visibility, submitted_at, updated_at",
      )
      .eq("user_id", user.id)
      .in("event_id", eventIds);
    predictions = (predRows ?? []) as Prediction[];
  }

  const standingsMap = await standingsPromise;
  const groupStandings: Record<string, TeamWithStats[]> = Object.fromEntries(standingsMap);

  return {
    competitionId: competition.id,
    groupEvents,
    predictions,
    groupStandings,
  };
}
