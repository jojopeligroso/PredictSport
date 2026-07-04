import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchResult } from "@/lib/sports/fetch-result";
import { searchEvents } from "@/lib/sports/search-events";
import { getProvidersForSport } from "@/lib/sports/registry";
import { getTimingForSport } from "@/lib/sports/timing";
import {
  tokenOverlapScore,
  generateSearchVariants,
} from "@/lib/sports/auto-result";
import type { Sport } from "@/lib/sports/types";

/**
 * GET /api/results/live
 *
 * SCHEDULE: pg_cron `wc-live-scores` every 1 min, guarded in SQL so it only
 * fires while at least one event is inside its live window
 * — see migration 20260703120000_live_scores_cron.sql
 *
 * Polls the sports provider chain for in-progress scores of live events and
 * writes them to `events.result_data.live` as
 * `{ homeScore, awayScore, status, fetchedAt }`.
 *
 * IMPORTANT: this route NEVER confirms results and NEVER writes
 * `predictions.points_awarded`. Confirmed scoring remains exclusively the job
 * of the existing 15-min results cron (`/api/results/cron` → autoResolveEvent).
 * The `live` sub-key only feeds provisional leaderboard computation
 * (`/api/tournament/standings?live=true`), which scores in memory.
 *
 * Fixtures shared across competition instances (same canonical external id)
 * are fetched once and the live payload is written to every sibling row.
 *
 * SECURITY: Protected by CRON_SECRET (same pattern as /api/results/cron).
 */

interface LiveEventRow {
  id: string;
  event_name: string;
  sport: string;
  start_time: string;
  external_event_id: string | null;
  provider_league: string | null;
  result_data: Record<string, unknown> | null;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mirrors getLiveWindowMs in dashboard-utils: match duration + 1h buffer. */
function liveWindowMs(sport: string): number {
  return (getTimingForSport(sport).checkAfterHours + 1) * 3600000;
}

/** Canonical fixture key: strip the `manual:` prefix used by WC fixtures. */
function canonicalExternalId(id: string | null): string | null {
  if (!id) return null;
  return id.startsWith("manual:") ? id.slice("manual:".length) : id;
}

/**
 * Resolve the provider event id for a fixture. Order:
 * 1. cached `result_data.provider_event_id` on any sibling row
 * 2. a real (non-`manual:`) `external_event_id`
 * 3. provider text search scored by token overlap (same rules as
 *    autoResolveEvent: >= 0.6, within +/- 1 day, single confident match)
 */
async function resolveProviderId(rows: LiveEventRow[]): Promise<string | null> {
  for (const row of rows) {
    const cached = row.result_data?.provider_event_id as string | undefined;
    if (cached) return cached;
  }

  for (const row of rows) {
    if (row.external_event_id && !row.external_event_id.startsWith("manual:")) {
      return row.external_event_id;
    }
  }

  const rep = rows[0];
  const startDate = rep.start_time.slice(0, 10);
  const eventStartMs = new Date(rep.start_time).getTime();
  const oneDayMs = 24 * 3600000;

  const isUsableCandidate = (c: { provider: string; external_event_id: string }) =>
    c.provider !== "fixture_pool" &&
    c.provider !== "manual" &&
    !!c.external_event_id &&
    c.external_event_id !== "undefined" &&
    !c.external_event_id.startsWith("manual:");

  const searchAndScore = async (searchName: string) => {
    // First try the standard search chain (may return fixturePool results)
    const candidates = await searchEvents(rep.sport as Sport, searchName, {
      date: startDate,
      providerLeague: rep.provider_league ?? undefined,
    });
    const usable = candidates.filter(isUsableCandidate);

    // If standard search only returned fixturePool/manual results, try each
    // external provider directly (ESPN, TheSportsDB, etc.)
    let allCandidates = usable;
    if (usable.length === 0) {
      const providers = getProvidersForSport(rep.sport as Sport);
      for (const provider of providers) {
        if (provider.name === "fixture_pool" || provider.name === "manual") continue;
        try {
          const results = await provider.searchEvents(rep.sport as Sport, searchName, {
            date: startDate,
            providerLeague: rep.provider_league ?? undefined,
          });
          const filtered = results.filter(isUsableCandidate);
          if (filtered.length > 0) {
            allCandidates = filtered;
            break; // take first provider with usable results
          }
        } catch {
          /* skip provider errors */
        }
      }
    }

    return allCandidates
      .map((c) => ({
        candidate: c,
        score: tokenOverlapScore(rep.event_name, c.event_name),
      }))
      .filter((c) => {
        if (c.score < 0.6) return false;
        const candidateMs = new Date(c.candidate.start_time).getTime();
        return Math.abs(candidateMs - eventStartMs) <= oneDayMs;
      })
      .sort((a, b) => b.score - a.score);
  };

  let scored = await searchAndScore(rep.event_name);
  if (scored.length === 0) {
    for (const variant of generateSearchVariants(rep.event_name)) {
      scored = await searchAndScore(variant);
      if (scored.length > 0) break;
    }
  }

  // Only trust a single confident match (ambiguity = skip this tick).
  // Guard against providers that return undefined/empty external_event_id.
  if (scored.length === 1) {
    const id = scored[0].candidate.external_event_id;
    return id && id !== "undefined" ? id : null;
  }
  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();
  const nowMs = now.getTime();

  // Widest live window across sports is golf (8h + 1h buffer); 10h back
  // bounds the query, then we filter per-sport below.
  const tenHoursAgo = new Date(nowMs - 10 * 3600000);

  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id, event_name, sport, start_time, external_event_id, provider_league, result_data"
    )
    .eq("result_confirmed", false)
    .lte("start_time", now.toISOString())
    .gte("start_time", tenHoursAgo.toISOString())
    .not("status", "in", '("cancelled","postponed")')
    .limit(500);

  if (error) {
    console.error("[live-cron] failed to fetch events:", error.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  // Per-sport live window filter (soccer: 3h, rugby: 3.5h, golf: 9h, ...)
  const live = ((events ?? []) as LiveEventRow[]).filter((e) => {
    const startMs = new Date(e.start_time).getTime();
    return nowMs < startMs + liveWindowMs(e.sport);
  });

  // Group sibling rows by canonical external id so each shared fixture is
  // fetched from the provider exactly once.
  const groups = new Map<string, LiveEventRow[]>();
  for (const e of live) {
    const key = canonicalExternalId(e.external_event_id) ?? `row:${e.id}`;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  let fixturesChecked = 0;
  let liveWrites = 0;
  let noResult = 0;
  let unresolved = 0;

  let first = true;
  for (const [, rows] of groups) {
    if (!first) await sleep(150); // provider rate-limit courtesy
    first = false;
    fixturesChecked++;

    const rep = rows[0];

    let providerId: string | null = null;
    try {
      providerId = await resolveProviderId(rows);
    } catch (err) {
      console.error(`[live-cron] resolve failed for "${rep.event_name}":`, err);
    }
    if (!providerId) {
      unresolved++;
      continue;
    }

    let result;
    try {
      result = await fetchResult(
        rep.sport as Sport,
        providerId,
        rep.provider_league ?? undefined
      );
    } catch (err) {
      console.error(`[live-cron] fetch failed for "${rep.event_name}":`, err);
    }

    if (!result?.score) {
      // Not started / provider has no score yet — nothing to write
      noResult++;
      continue;
    }

    const raw = result.raw as { strStatus?: string; status?: { type?: { description?: string } } } | null;
    const providerStatus = raw?.strStatus ?? "";
    const espnDescription = raw?.status?.type?.description ?? "";
    const resolvedStatus = providerStatus || (result.is_final ? "FT" : "LIVE");

    // Detect if the match is in extra time / penalties.
    // During regulation, snapshot the current score as ftScore.
    // Once ET/PEN starts, preserve the last regulation ftScore.
    const isOvertime =
      /^(ET|AET|PEN)$/i.test(providerStatus) ||
      (/^\d+$/.test(providerStatus) && Number(providerStatus) > 90) ||
      espnDescription === "Overtime" ||
      espnDescription === "Penalty Kicks";

    for (const row of rows) {
      const existingLive = (row.result_data as Record<string, unknown> | null)?.live as Record<string, unknown> | undefined;

      // During regulation, snapshot the current score as ftScore.
      // During overtime, preserve the last regulation snapshot.
      const ftScore = isOvertime
        ? (existingLive?.ftScore ?? null)
        : { home: result.score.home_score, away: result.score.away_score };

      const livePayload: Record<string, unknown> = {
        homeScore: result.score.home_score,
        awayScore: result.score.away_score,
        status: resolvedStatus,
        fetchedAt: result.fetched_at,
      };
      if (ftScore) livePayload.ftScore = ftScore;
      if (result.score.periods) livePayload.periods = result.score.periods;

      // `.eq("result_confirmed", false)` guards against clobbering a result
      // confirmed by the 15-min cron between our read and this write.
      const { error: updateError } = await supabase
        .from("events")
        .update({
          result_data: {
            ...(row.result_data ?? {}),
            provider_event_id: providerId,
            live: livePayload,
          },
        })
        .eq("id", row.id)
        .eq("result_confirmed", false);

      if (updateError) {
        console.error(
          `[live-cron] write failed for event ${row.id}:`,
          updateError.message
        );
      } else {
        liveWrites++;
      }
    }

    console.log(
      `[live-cron] "${rep.event_name}" ${result.score.home_score}-${result.score.away_score} (${resolvedStatus}) → ${rows.length} row(s)`
    );
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    fixtures_checked: fixturesChecked,
    live_writes: liveWrites,
    no_result: noResult,
    unresolved,
  });
}
