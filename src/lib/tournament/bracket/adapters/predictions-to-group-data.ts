/**
 * predictions → GroupData adapter (read direction of the unified prediction
 * model — see docs/DESIGN-WC-UNIFIED-PREDICTIONS.md, Amendment 2026-05-23).
 *
 * The Bracket wizard's group-stage UI consumes a `GroupData[]` shape:
 *
 *   { group_id, group_name, teams, matches: [{ match_id, home_team,
 *     away_team, result: 'home_win'|'draw'|'away_win'|null, exact_score? }] }
 *
 * Under the unified model, group W/D/L picks and tiebreaker exact_scores live
 * in `predictions` rows keyed by `(user_id, event_id)`, written by `/picks`
 * matchday flows and by the bracket wizard alike. This adapter takes the
 * canonical store and projects it into the wizard's view shape.
 *
 * Mirror of `predictions-adapter.ts` (the write fanout that this amendment
 * retires). The fanout matched bracket data → predictions by parsing
 * `events.event_name` (e.g. "Group A: Mexico vs South Africa") to recover the
 * (group, home, away) signature. We do the same in reverse: load WC group
 * events, parse their names, key by signature, look up each (group, match_id,
 * home_team, away_team) triplet against the user's predictions.
 *
 * What this does NOT do:
 *   - It does not call the FIFA tiebreaker engine. Producing 1st–4th rankings
 *     from this data is a separate step (`groupDataToRankings()`).
 *   - It does not enforce "all 12 groups fully predicted" — partial fills are
 *     normal (a user mid-window leaves most matches null).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupData } from "@/components/tournament/bracket/GroupResultsStepV2";
import type { MatchResult } from "@/components/tournament/bracket/MatchCard";

export interface WC2026GroupSpec {
  groupId: string;
  name: string;
  teams: string[];
}

interface EventRow {
  id: string;
  external_event_id: string | null;
  event_name: string;
}

interface PredictionRow {
  event_id: string;
  prediction_type: string;
  prediction_data: Record<string, unknown> | null;
}

/**
 * Build the wizard's `GroupData[]` for one user + competition, sourcing
 * `result` and `exact_score` from existing `predictions` rows.
 *
 * `groups` is the template's group definition (team names per group). Match
 * IDs are generated the same way the wizard does in `buildGroupMatches()` —
 * round-robin order, `{groupId}-m{n}` — so they remain stable across renders.
 *
 * Returns an entry for every template group. A group with no user predictions
 * yet comes back with `matches[].result = null` for every match; the wizard
 * renders that as "not picked." `has_tiebreaker_scores` is true iff at least
 * one match in the group has an `exact_score` (derivable rather than stored).
 */
export async function loadGroupDataFromPredictions(
  supabase: SupabaseClient,
  args: {
    userId: string;
    competitionId: string;
    groups: WC2026GroupSpec[];
  },
): Promise<GroupData[]> {
  const result = await loadGroupDataAndEventMap(supabase, args);
  return result.groups;
}

/**
 * As `loadGroupDataFromPredictions`, but also returns the
 * `{groupId}-m{n}` → `events.id` map. The wizard needs that map for per-tap
 * writes to `/api/predictions` (which expects `event_id`).
 */
export async function loadGroupDataAndEventMap(
  supabase: SupabaseClient,
  args: {
    userId: string;
    competitionId: string;
    groups: WC2026GroupSpec[];
  },
): Promise<{ groups: GroupData[]; eventIdByMatchId: Record<string, string> }> {
  const { userId, competitionId, groups } = args;

  const eventBySignature = await loadGroupEventsBySignature(supabase, competitionId);

  const eventIds = Array.from(eventBySignature.values()).map((e) => e.id);
  const predictionByKey = await loadUserPredictionsByEventAndType(
    supabase,
    userId,
    eventIds,
  );

  const built = groups.map((group) =>
    buildGroupData(group, eventBySignature, predictionByKey),
  );

  // Build the wizard-side event lookup: `{groupId}-m{n}` → `events.id`.
  // We follow the same round-robin enumeration the wizard uses so the
  // match_ids agree on both sides.
  const eventIdByMatchId: Record<string, string> = {};
  for (const group of groups) {
    let n = 0;
    for (let i = 0; i < group.teams.length; i++) {
      for (let j = i + 1; j < group.teams.length; j++) {
        n++;
        const home_team = group.teams[i];
        const away_team = group.teams[j];
        const evt =
          eventBySignature.get(signatureKey(group.groupId, home_team, away_team)) ??
          eventBySignature.get(signatureKey(group.groupId, away_team, home_team));
        if (evt) {
          eventIdByMatchId[`${group.groupId}-m${n}`] = evt.id;
        }
      }
    }
  }

  return { groups: built, eventIdByMatchId };
}

function buildGroupData(
  group: WC2026GroupSpec,
  eventBySignature: Map<string, EventRow>,
  predictionByKey: Map<string, PredictionRow>,
): GroupData {
  let n = 0;
  const matches: GroupData["matches"] = [];
  let anyExactScore = false;

  for (let i = 0; i < group.teams.length; i++) {
    for (let j = i + 1; j < group.teams.length; j++) {
      n++;
      const home_team = group.teams[i];
      const away_team = group.teams[j];

      const evt =
        eventBySignature.get(signatureKey(group.groupId, home_team, away_team)) ??
        eventBySignature.get(signatureKey(group.groupId, away_team, home_team));

      let result: MatchResult | null = null;
      let exact_score: { home_score: number; away_score: number } | undefined;

      if (evt) {
        const winnerPred = predictionByKey.get(predictionKey(evt.id, "winner"));
        if (winnerPred) {
          // The /picks UI stores { value: teamName }; the bracket wizard stores
          // { selection: teamName }. Accept both — scoring engine does the same.
          const data = winnerPred.prediction_data ?? {};
          const selection = (data["selection"] ?? data["value"]) as string | undefined;
          if (selection === home_team) result = "home_win";
          else if (selection === away_team) result = "away_win";
          else if (selection === "Draw" || selection === "draw") result = "draw";
          // Any other value (stale team name etc.) leaves result null — safer
          // than guessing.
        }

        const scorePred = predictionByKey.get(predictionKey(evt.id, "exact_score"));
        if (scorePred && scorePred.prediction_data) {
          const data = scorePred.prediction_data as {
            home_score?: unknown;
            away_score?: unknown;
          };
          if (typeof data.home_score === "number" && typeof data.away_score === "number") {
            exact_score = {
              home_score: data.home_score,
              away_score: data.away_score,
            };
            anyExactScore = true;
          }
        }
      }

      matches.push({
        match_id: `${group.groupId}-m${n}`,
        home_team,
        away_team,
        result,
        exact_score,
      });
    }
  }

  return {
    group_id: group.groupId,
    group_name: group.name,
    teams: group.teams,
    matches,
    has_tiebreaker_scores: anyExactScore,
  };
}

/**
 * Load every WC group event for the competition, keyed by
 * "{group}::{home}::{away}". The group letter is parsed from the stable
 * `external_event_id` (`wc2026-grp-{X}-md{N}-{n}`); the team-pair signature
 * comes from `event_name` ("Mexico vs South Africa"). This decoupling is
 * deliberate — the event name format has changed over time (an earlier
 * version of the seed used "Group A: Mexico vs South Africa") and parsing
 * a single field for two pieces of information silently failed when the
 * format moved on.
 */
async function loadGroupEventsBySignature(
  supabase: SupabaseClient,
  competitionId: string,
): Promise<Map<string, EventRow>> {
  const map = new Map<string, EventRow>();

  // Resolve tournament_id for shared fixture lookup
  const { data: comp } = await supabase
    .from("competitions")
    .select("tournament_id")
    .eq("id", competitionId)
    .single();

  const { data, error } = comp?.tournament_id
    ? await supabase
        .from("events")
        .select("id, external_event_id, event_name")
        .eq("tournament_id", comp.tournament_id)
        .like("external_event_id", "manual:wc2026-grp-%")
    : await supabase
        .from("events")
        .select("id, external_event_id, event_name")
        .eq("competition_id", competitionId)
        .like("external_event_id", "manual:wc2026-grp-%");

  if (error || !data) return map;

  for (const row of data as EventRow[]) {
    // Group letter from the external id (authoritative).
    const idMatch = row.external_event_id?.match(/^manual:wc2026-grp-([A-L])-/i);
    if (!idMatch) continue;
    const group = idMatch[1].toUpperCase();

    // Team pair from the event name. Tolerate "X vs Y" and "Group A: X vs Y".
    const nameMatch = row.event_name.match(/(?:Group\s+[A-L][:\s]+)?(.+?)\s+vs\s+(.+)$/i);
    if (!nameMatch) continue;
    const home = nameMatch[1].trim();
    const away = nameMatch[2].trim();

    map.set(signatureKey(group, home, away), row);
  }

  return map;
}

/**
 * Load the user's winner + exact_score predictions for the given event ids.
 * Returned map is keyed by "{event_id}::{prediction_type}".
 */
async function loadUserPredictionsByEventAndType(
  supabase: SupabaseClient,
  userId: string,
  eventIds: string[],
): Promise<Map<string, PredictionRow>> {
  const map = new Map<string, PredictionRow>();
  if (eventIds.length === 0) return map;

  const { data, error } = await supabase
    .from("predictions")
    .select("event_id, prediction_type, prediction_data")
    .eq("user_id", userId)
    .in("event_id", eventIds)
    .in("prediction_type", ["winner", "exact_score"]);

  if (error || !data) return map;

  for (const row of data as PredictionRow[]) {
    map.set(predictionKey(row.event_id, row.prediction_type), row);
  }
  return map;
}

function signatureKey(group: string, home: string, away: string): string {
  return `${group}::${home}::${away}`;
}

function predictionKey(eventId: string, predictionType: string): string {
  return `${eventId}::${predictionType}`;
}

/**
 * Map a wizard match selection back to the value `/api/predictions` expects.
 * The wizard speaks `home_win | away_win | draw` plus team names; the
 * predictions store records the `selection` as the actual team name (or
 * "Draw"). Centralised here so the wizard tap-handler and any future
 * tests/utilities agree on the format.
 */
export function selectionForResult(
  result: MatchResult,
  home_team: string,
  away_team: string,
): string {
  if (result === "home_win") return home_team;
  if (result === "away_win") return away_team;
  return "Draw";
}
