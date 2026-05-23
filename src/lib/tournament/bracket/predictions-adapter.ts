/**
 * Bracket → predictions one-way adapter (U3 from DESIGN-WC-UNIFIED-PREDICTIONS).
 *
 * On bracket save/submit, this fans out the bracket's group-stage W/D/L picks
 * and tiebreaker scores into per-event `predictions` rows so that:
 *   - The Overall classification (sums every prediction's points) scores group
 *     matches without a second engine.
 *   - The Format classification (windowed scoring) sees the same data.
 *   - The windowed pick UI (`/wc/picks/[windowId]`) pre-fills any value the
 *     user already entered via the Bracket flow.
 *
 * Knockout picks stay in `bracket_data` — they are the documented exception
 * (a knockout progression pick has no per-event analogue in the Bracket view).
 *
 * Direction: ONE-WAY, Bracket → predictions. The Bracket never reads from
 * `predictions`; that direction would introduce sync ambiguity.
 *
 * Failure mode: this runs *after* the bracket itself is persisted. A failure
 * here is logged and surfaced as a warning in the response but does NOT roll
 * back the bracket save. The bracket is the user's primary intent; the fanout
 * is a derived projection that we can re-run idempotently from the stored
 * `bracket_data` if needed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BracketSubmissionData, GroupDataV2 } from "@/types/tournament";

interface AdapterResult {
  predictionsWritten: number;
  errors: string[];
}

interface EventLookupRow {
  id: string;
  external_event_id: string | null;
}

interface EventPredictionTypeRow {
  id: string;
  event_id: string;
  prediction_type: string;
}

/**
 * Fan out a bracket's group-stage W/D/L picks (+ any tiebreaker scores) into
 * per-event `predictions` rows for the given user + competition.
 *
 * Idempotent: relies on the unique constraint `(user_id, event_prediction_type_id)`
 * by upserting. If a user already has a prediction for the same event+type,
 * the row is updated.
 */
export async function fanoutBracketToPredictions(
  supabase: SupabaseClient,
  args: {
    userId: string;
    competitionId: string;
    bracketData: BracketSubmissionData;
  },
): Promise<AdapterResult> {
  const { userId, competitionId, bracketData } = args;
  const errors: string[] = [];

  if (!bracketData.groupsV2 || bracketData.groupsV2.length === 0) {
    return { predictionsWritten: 0, errors: [] };
  }

  // Build the set of external_event_ids referenced by the bracket data.
  // External id format: `wc2026-grp-{group}-md{md}-{matchInGroup}`. The
  // `matchInGroup` is the matchday-order index, which the bracket's own
  // match_id (cross-pair order, "{group}-m{n}") doesn't preserve. So we map
  // by team names instead — every group-stage match has a unique
  // (group, home, away) signature within the competition.
  const externalIdByKey = await loadGroupEventIdMap(supabase, competitionId);
  if (externalIdByKey.size === 0) {
    return {
      predictionsWritten: 0,
      errors: [
        "No WC group events found for this competition — bracket-to-predictions fanout skipped.",
      ],
    };
  }

  // Index event_prediction_types so we can look up the winner & exact_score
  // type id per event.
  const eventIds = Array.from(externalIdByKey.values()).map((e) => e.id);
  const eptByEventId = await loadEventPredictionTypes(supabase, eventIds);

  // Build the desired predictions list from bracket data.
  const upserts: Array<{
    event_id: string;
    event_prediction_type_id: string;
    user_id: string;
    prediction_type: "winner" | "exact_score";
    prediction_data: Record<string, unknown>;
  }> = [];

  for (const group of bracketData.groupsV2) {
    for (const match of group.matches) {
      if (!match.result) continue;
      const evt = matchToEvent(externalIdByKey, group, match);
      if (!evt) {
        errors.push(
          `No matching event for ${group.group_id}: ${match.home_team} vs ${match.away_team}`,
        );
        continue;
      }
      const epts = eptByEventId.get(evt.id) ?? [];
      const winnerEpt = epts.find((e) => e.prediction_type === "winner");
      const scoreEpt = epts.find((e) => e.prediction_type === "exact_score");

      if (winnerEpt) {
        upserts.push({
          event_id: evt.id,
          event_prediction_type_id: winnerEpt.id,
          user_id: userId,
          prediction_type: "winner",
          prediction_data: {
            // Match the standard `winner` shape: { selection: "Team Name" } or
            // { selection: "Draw" }. This matches what the windowed pick UI
            // will write (see /wc/picks).
            selection:
              match.result === "home_win"
                ? match.home_team
                : match.result === "away_win"
                  ? match.away_team
                  : "Draw",
          },
        });
      }
      if (scoreEpt && match.exact_score) {
        upserts.push({
          event_id: evt.id,
          event_prediction_type_id: scoreEpt.id,
          user_id: userId,
          prediction_type: "exact_score",
          prediction_data: {
            home_score: match.exact_score.home_score,
            away_score: match.exact_score.away_score,
          },
        });
      }
    }
  }

  if (upserts.length === 0) return { predictionsWritten: 0, errors };

  // Upsert in chunks. The unique key in `predictions` is
  // (user_id, event_prediction_type_id) — same row gets updated on conflict.
  const chunkSize = 100;
  let written = 0;
  for (let i = 0; i < upserts.length; i += chunkSize) {
    const chunk = upserts.slice(i, i + chunkSize);
    const { error, count } = await supabase
      .from("predictions")
      .upsert(chunk, {
        onConflict: "user_id,event_prediction_type_id",
        count: "exact",
      });
    if (error) {
      errors.push(`Upsert failed: ${error.message}`);
    } else {
      written += count ?? chunk.length;
    }
  }

  return { predictionsWritten: written, errors };
}

interface GroupEventEntry {
  id: string;
  external_event_id: string;
  group: string;
}

async function loadGroupEventIdMap(
  supabase: SupabaseClient,
  competitionId: string,
): Promise<Map<string, GroupEventEntry>> {
  const map = new Map<string, GroupEventEntry>();

  const { data, error } = await supabase
    .from("events")
    .select("id, external_event_id, event_name")
    .eq("competition_id", competitionId)
    .like("external_event_id", "wc2026-grp-%");

  if (error || !data) return map;

  for (const row of data as Array<{
    id: string;
    external_event_id: string;
    event_name: string;
  }>) {
    const parsed = parseGroupExternalId(row.external_event_id);
    if (!parsed) continue;

    // Pull home/away from event_name format: "Group A: Mexico vs South Africa"
    const nameMatch = row.event_name.match(/Group\s+([A-L])[:\s]+(.+?)\s+vs\s+(.+)$/i);
    if (!nameMatch) continue;
    const [, group, home, away] = nameMatch;

    const key = signatureKey(group, home.trim(), away.trim());
    map.set(key, {
      id: row.id,
      external_event_id: row.external_event_id,
      group,
    });
  }

  return map;
}

async function loadEventPredictionTypes(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, EventPredictionTypeRow[]>> {
  const map = new Map<string, EventPredictionTypeRow[]>();
  if (eventIds.length === 0) return map;

  const { data, error } = await supabase
    .from("event_prediction_types")
    .select("id, event_id, prediction_type")
    .in("event_id", eventIds);

  if (error || !data) return map;

  for (const row of data as EventPredictionTypeRow[]) {
    const arr = map.get(row.event_id) ?? [];
    arr.push(row);
    map.set(row.event_id, arr);
  }
  return map;
}

function parseGroupExternalId(
  externalId: string | null,
): { group: string; matchday: number; matchInGroup: number } | null {
  if (!externalId) return null;
  const m = externalId.match(/^wc2026-grp-([A-L])-md(\d+)-(\d+)$/);
  if (!m) return null;
  return {
    group: m[1],
    matchday: parseInt(m[2], 10),
    matchInGroup: parseInt(m[3], 10),
  };
}

function matchToEvent(
  externalIdByKey: Map<string, GroupEventEntry>,
  group: GroupDataV2,
  match: GroupDataV2["matches"][number],
): EventLookupRow | null {
  // Try both orientations — the wizard's `home`/`away` may be the alphabetical
  // pair order, while the fixture's home/away is the FIFA-assigned one.
  const k1 = signatureKey(group.group_id, match.home_team, match.away_team);
  const hit1 = externalIdByKey.get(k1);
  if (hit1) return { id: hit1.id, external_event_id: hit1.external_event_id };

  const k2 = signatureKey(group.group_id, match.away_team, match.home_team);
  const hit2 = externalIdByKey.get(k2);
  if (hit2) return { id: hit2.id, external_event_id: hit2.external_event_id };

  return null;
}

function signatureKey(group: string, home: string, away: string): string {
  return `${group}::${home}::${away}`;
}
