import { createClient } from "@supabase/supabase-js";
import type { NormalizedResult, SearchableEvent, Sport, SportsProvider } from "../types";

/**
 * FixturePoolProvider — surfaces manually-added events from the sporting_events table.
 *
 * Used as the highest-priority provider in every sport chain so that handpicked
 * events always appear in the fixture browser, regardless of whether external
 * APIs have them.
 *
 * getResult() is intentionally a no-op: pool events don't carry live result data.
 * Results come from the other providers (or manual entry) after the event.
 */
export class FixturePoolProvider implements SportsProvider {
  readonly name = "fixture_pool";
  readonly supportedSports: readonly Sport[] = [
    "formula_1",
    "soccer",
    "golf",
    "rugby",
    "tennis",
    "gaa",
    "horse_racing",
    "snooker",
    "cricket",
    "athletics",
    "baseball",
    "american_football",
    "basketball",
    "ice_hockey",
  ];

  private getClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
  }

  async getResult(): Promise<NormalizedResult | null> {
    // Pool events don't carry live results — let other providers handle it
    return null;
  }

  async searchEvents(
    sport: Sport,
    query: string,
    options?: { date?: string; limit?: number }
  ): Promise<SearchableEvent[]> {
    const supabase = this.getClient();
    if (!supabase) return [];

    const limit = options?.limit ?? 20;
    const normalised = query.toLowerCase().trim();

    let q = supabase
      .from("sporting_events")
      .select("event_name, sport, start_time, participants, competition_name, external_event_id")
      .eq("sport", sport)
      .order("start_time", { ascending: true })
      .limit(limit * 3); // over-fetch; we'll filter by name match below

    // If a date hint is provided, restrict to ±7 days of that date
    if (options?.date) {
      const pivot = new Date(options.date);
      const lo = new Date(pivot.getTime() - 7 * 86_400_000).toISOString();
      const hi = new Date(pivot.getTime() + 7 * 86_400_000).toISOString();
      q = q.gte("start_time", lo).lte("start_time", hi);
    }

    const { data, error } = await q;
    if (error || !data) {
      console.error("[fixture_pool] searchEvents error:", error?.message);
      return [];
    }

    // Client-side relevance filter: keep rows whose event_name or participants
    // contain at least one token from the query
    const tokens = normalised
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const scored = data
      .map((row) => {
        const haystack =
          (row.event_name + " " + (row.participants ?? []).join(" ")).toLowerCase();
        const hits = tokens.filter((t) => haystack.includes(t)).length;
        return { row, hits };
      })
      .filter(({ hits }) => hits > 0 || tokens.length === 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);

    return scored.map(({ row }) => ({
      external_event_id: row.external_event_id ?? `manual:${row.event_name}`,
      event_name: row.event_name,
      sport: row.sport as Sport,
      start_time: row.start_time,
      competition_name: row.competition_name ?? "Manual",
      participants: row.participants ?? [],
      provider: "fixture_pool",
    }));
  }
}
