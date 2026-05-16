import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ACTIVE_CRICKET_LEAGUES, ALL_CRICKET_LEAGUES } from "@/lib/sports/cricket-leagues";
import type { CricketLeague } from "@/lib/sports/cricket-leagues";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/cricket";
const FETCH_TIMEOUT_MS = 8_000;

interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  status: { type: { state?: string; description?: string } };
  competitions: Array<{
    competitors: Array<{
      team?: { displayName: string };
      athlete?: { displayName: string };
    }>;
  }>;
}

interface ESPNScoreboardResponse {
  events?: ESPNEvent[];
}

/**
 * POST /api/admin/cricket-seed
 *
 * Seeds upcoming cricket fixtures from all active ESPN/Cricinfo leagues
 * into the sporting_events pool table. Safe to re-run — upserts on
 * external_event_id to avoid duplicates.
 *
 * Body (optional JSON):
 *   { leagueIds?: string[] }  — override active leagues; probe these IDs instead
 *   { all?: true }            — include inactive leagues too (full refresh)
 *
 * Returns: { seeded: number, leagues: { id, name, fetched, inserted }[] }
 */
export async function POST(request: Request) {
  // Auth — admin only (any authenticated user for now, tighten with role check if needed)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    leagueIds?: string[];
    all?: boolean;
  };

  // Determine which leagues to seed
  let leagues: CricketLeague[];
  if (body.leagueIds?.length) {
    // Caller specified explicit IDs — look them up in the manifest, or create ad-hoc entries
    leagues = body.leagueIds.map((id) => {
      const known = ALL_CRICKET_LEAGUES.find((l) => l.id === id);
      return known ?? { id, name: `Cricket (${id})`, permanent: false, active: true };
    });
  } else if (body.all) {
    leagues = ALL_CRICKET_LEAGUES;
  } else {
    leagues = ACTIVE_CRICKET_LEAGUES;
  }

  // Service-role client — bypasses RLS for upserts
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const results: { id: string; name: string; fetched: number; inserted: number; error?: string }[] = [];
  let totalSeeded = 0;

  for (const league of leagues) {
    try {
      const events = await fetchLeagueEvents(league.id);

      if (!events.length) {
        results.push({ id: league.id, name: league.name, fetched: 0, inserted: 0 });
        continue;
      }

      // Filter to upcoming/live only — no point seeding finished events
      const relevant = events.filter((e) => {
        const state = e.status.type.state;
        return state === "pre" || state === "in";
      });

      if (!relevant.length) {
        results.push({ id: league.id, name: league.name, fetched: events.length, inserted: 0 });
        continue;
      }

      const rows = relevant.map((e) => {
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
          added_by: user.id,
        };
      });

      // Upsert on external_event_id — safe to re-run
      const { error, data: upserted } = await svc
        .from("sporting_events")
        .upsert(rows, { onConflict: "external_event_id" })
        .select("id");

      if (error) {
        results.push({ id: league.id, name: league.name, fetched: relevant.length, inserted: 0, error: error.message });
      } else {
        const inserted = upserted?.length ?? rows.length;
        totalSeeded += inserted;
        results.push({ id: league.id, name: league.name, fetched: relevant.length, inserted });
      }
    } catch (err) {
      results.push({
        id: league.id,
        name: league.name,
        fetched: 0,
        inserted: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ seeded: totalSeeded, leagues: results });
}

/**
 * GET /api/admin/cricket-seed
 *
 * Returns the current cricket league manifest so the admin UI can show
 * which leagues are configured and let the user probe/add custom IDs.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const probeId = searchParams.get("probe");

  if (probeId) {
    // Probe a specific league ID to check if it exists and has events
    const events = await fetchLeagueEvents(probeId);
    const upcoming = events.filter((e) => {
      const state = e.status.type.state;
      return state === "pre" || state === "in";
    });
    return NextResponse.json({
      id: probeId,
      found: events.length > 0,
      total: events.length,
      upcoming: upcoming.length,
      sample: upcoming.slice(0, 3).map((e) => ({
        name: e.name,
        date: e.date,
        state: e.status.type.state,
        description: e.status.type.description,
      })),
    });
  }

  return NextResponse.json({ leagues: ALL_CRICKET_LEAGUES });
}

async function fetchLeagueEvents(leagueId: string): Promise<ESPNEvent[]> {
  const url = `${ESPN_BASE}/${leagueId}/scoreboard`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PredictSport/1.0", Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ESPNScoreboardResponse;
    return data.events ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
