import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ACTIVE_CRICKET_LEAGUES } from "@/lib/sports/cricket-leagues";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/cricket";
const FETCH_TIMEOUT_MS = 8_000;

interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  status: { type: { state?: string } };
  competitions: Array<{
    competitors: Array<{
      team?: { displayName: string };
      athlete?: { displayName: string };
    }>;
  }>;
}

/**
 * GET /api/cricket-seed/cron
 *
 * MANUAL TRIGGER ONLY (not scheduled). Seeds upcoming cricket fixtures
 * from all active ESPN/Cricinfo leagues into the sporting_events pool
 * table. The FixturePool provider serves these in fixture searches,
 * giving multi-week visibility without relying on ESPN's broken
 * date-range behaviour for cricket.
 *
 * Schedule via pg_cron when the first cricket competition ships. The
 * pattern is the same as wc-lock-windows et al — see migration
 * 20260528000100 for the helper + Vault usage.
 *
 * SECURITY: Protected by CRON_SECRET (Vault secret `cron_secret`).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase service config missing" }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date();

  // First: delete sporting_events rows that have already started, to keep the
  // pool clean. Rows linked to actual events (via external_event_id) are kept
  // by the events table — this only cleans the browsable pool.
  await supabase
    .from("sporting_events")
    .delete()
    .eq("source", "espn")
    .eq("sport", "cricket")
    .lt("start_time", now.toISOString());

  const results: {
    id: string;
    name: string;
    fetched: number;
    upserted: number;
    error?: string;
  }[] = [];
  let totalUpserted = 0;

  for (const league of ACTIVE_CRICKET_LEAGUES) {
    try {
      const events = await fetchLeagueEvents(league.id);

      // Only seed upcoming/live events — no point storing finished fixtures
      const upcoming = events.filter(
        (e) => e.status.type.state === "pre" || e.status.type.state === "in"
      );

      if (!upcoming.length) {
        results.push({ id: league.id, name: league.name, fetched: events.length, upserted: 0 });
        continue;
      }

      const rows = upcoming.map((e) => {
        const competitors = (e.competitions[0]?.competitors ?? []).map(
          (c) => c.team?.displayName ?? c.athlete?.displayName ?? "Unknown"
        );
        return {
          event_name: e.name,
          sport: "cricket" as const,
          start_time: e.date,
          participants: competitors,
          competition_name: league.name,
          external_event_id: `espn:cricket:${e.id}`,
          source: "espn",
        };
      });

      const { error, data: upserted } = await supabase
        .from("sporting_events")
        .upsert(rows, { onConflict: "external_event_id" })
        .select("id");

      if (error) {
        console.error(`[cricket-seed-cron] upsert failed for league ${league.id}:`, error.message);
        results.push({ id: league.id, name: league.name, fetched: upcoming.length, upserted: 0, error: error.message });
      } else {
        const count = upserted?.length ?? rows.length;
        totalUpserted += count;
        results.push({ id: league.id, name: league.name, fetched: upcoming.length, upserted: count });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cricket-seed-cron] league ${league.id} failed:`, msg);
      results.push({ id: league.id, name: league.name, fetched: 0, upserted: 0, error: msg });
    }
  }

  console.log(`[cricket-seed-cron] done: ${totalUpserted} rows upserted across ${ACTIVE_CRICKET_LEAGUES.length} leagues`);

  return NextResponse.json({
    ok: true,
    seeded_at: now.toISOString(),
    total_upserted: totalUpserted,
    leagues: results,
  });
}

async function fetchLeagueEvents(leagueId: string): Promise<ESPNEvent[]> {
  // No date param — ESPN returns the next upcoming fixtures per league.
  // Cricket rejects date-range params (YYYYMMDD-YYYYMMDD) with 404.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${ESPN_BASE}/${leagueId}/scoreboard`, {
      headers: { "User-Agent": "PredictSport/1.0", Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 0 }, // always fresh in cron context
    });
    if (!res.ok) return [];
    const data = await res.json() as { events?: ESPNEvent[] };
    return data.events ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
