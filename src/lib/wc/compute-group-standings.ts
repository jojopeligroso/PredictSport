/**
 * Compute live FIFA-style group standings from confirmed event results.
 *
 * Queries all confirmed WC2026 group-stage events, extracts scores from
 * result_data, and feeds them into the bracket engine's
 * calculateGroupStandings() with FIFA tiebreakers.
 *
 * Returns a Map<groupLetter, TeamWithStats[]> — empty groups are omitted.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { WC2026_FIXTURES } from "@/lib/wc/fixtures";
import { WC2026_GROUPS } from "@/lib/bracket/adapters/fifa-world-cup-2026";
import { calculateGroupStandings } from "@/lib/tournament/bracket/engine";
import { FIFA_TIEBREAKERS } from "@/lib/tournament/bracket/tiebreakers/fifa";
import type { MatchPrediction, TeamWithStats } from "@/lib/tournament/bracket/types";

/** Fixture lookup keyed by external_event_id. */
const fixtureByExternalId = new Map(
  WC2026_FIXTURES.filter((f) => f.stage === "group").map((f) => [f.externalId, f]),
);

/** Group teams lookup keyed by group letter. */
const teamsByGroup = new Map(
  WC2026_GROUPS.map((g) => [g.groupId, g.teams]),
);

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract home_score / away_score from result_data.
 * Handles both top-level and nested `score` shapes.
 */
function extractScores(
  rd: Record<string, unknown>,
): { home: number; away: number } | null {
  // Top-level shape (used by fetchDashboardData / manual entry)
  let home = numOrNull(rd.home_score ?? rd.homeScore);
  let away = numOrNull(rd.away_score ?? rd.awayScore);
  if (home !== null && away !== null) return { home, away };

  // Nested score shape (used by scoring engine / providers)
  const score = rd.score as Record<string, unknown> | undefined;
  if (score) {
    home = numOrNull(score.home_score ?? score.home);
    away = numOrNull(score.away_score ?? score.away);
    if (home !== null && away !== null) return { home, away };
  }

  return null;
}

export async function computeGroupStandings(
  supabase: SupabaseClient,
  competitionId: string,
): Promise<Map<string, TeamWithStats[]>> {
  // Resolve tournament_id for shared fixture lookup
  const { data: comp } = await supabase
    .from("competitions")
    .select("tournament_id")
    .eq("id", competitionId)
    .single();

  const eventQuery = supabase
    .from("events")
    .select("external_event_id, result_data")
    .eq("result_confirmed", true)
    .like("external_event_id", "manual:wc2026-grp-%");

  const { data: events } = comp?.tournament_id
    ? await eventQuery.eq("tournament_id", comp.tournament_id)
    : await eventQuery.eq("competition_id", competitionId);

  if (!events?.length) return new Map();

  // Build match predictions per group
  const matchesByGroup = new Map<string, MatchPrediction[]>();

  for (const event of events) {
    const extId = event.external_event_id as string;
    const fixture = fixtureByExternalId.get(extId);
    if (!fixture?.group) continue;

    const rd = (event.result_data ?? {}) as Record<string, unknown>;
    const scores = extractScores(rd);
    if (!scores) continue;

    const match: MatchPrediction = {
      match_id: extId,
      home_team: fixture.home,
      away_team: fixture.away,
      outcome:
        scores.home > scores.away
          ? "home"
          : scores.away > scores.home
            ? "away"
            : "draw",
      home_score: scores.home,
      away_score: scores.away,
    };

    const existing = matchesByGroup.get(fixture.group) ?? [];
    existing.push(match);
    matchesByGroup.set(fixture.group, existing);
  }

  // Calculate standings per group
  const standings = new Map<string, TeamWithStats[]>();

  for (const [groupId, matches] of matchesByGroup) {
    const teams = teamsByGroup.get(groupId);
    if (!teams) continue;

    const groupStandings = calculateGroupStandings(
      matches,
      FIFA_TIEBREAKERS,
      teams,
    );
    standings.set(groupId, groupStandings);
  }

  return standings;
}
