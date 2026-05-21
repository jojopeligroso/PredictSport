import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProvidersForSport } from "@/lib/sports/registry";
import type { Sport } from "@/lib/sports/types";

const TEST_QUERIES: { sport: Sport; query: string }[] = [
  { sport: "soccer", query: "Premier League" },
  { sport: "formula_1", query: "Grand Prix" },
  { sport: "rugby", query: "URC" },
  { sport: "rugby_league", query: "NRL" },
  { sport: "tennis", query: "Wimbledon" },
  { sport: "golf", query: "PGA" },
  { sport: "gaa", query: "All-Ireland" },
  { sport: "cricket", query: "Test" },
  { sport: "nba", query: "Lakers" },
  { sport: "nfl", query: "Super Bowl" },
  { sport: "mlb", query: "Yankees" },
  { sport: "nhl", query: "Stanley Cup" },
  { sport: "horse_racing", query: "Ascot" },
  { sport: "snooker", query: "World Championship" },
  { sport: "athletics", query: "Diamond League" },
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check super admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: {
    provider: string;
    sport: Sport;
    status: "ok" | "fail" | "disabled";
    events: number;
    latencyMs: number;
    error?: string;
  }[] = [];

  const tested = new Set<string>();

  for (const tc of TEST_QUERIES) {
    const providers = getProvidersForSport(tc.sport);

    for (const provider of providers) {
      if (provider.name === "Manual" || provider.name === "FixturePool") continue;

      const key = `${provider.name}:${tc.sport}`;
      if (tested.has(key)) continue;
      tested.add(key);

      if (!provider.supportedSports.includes(tc.sport)) continue;

      const start = Date.now();
      try {
        const events = await provider.searchEvents(tc.sport, tc.query, {
          limit: 3,
        });
        results.push({
          provider: provider.name,
          sport: tc.sport,
          status: events.length > 0 ? "ok" : "disabled",
          events: events.length,
          latencyMs: Date.now() - start,
        });
      } catch (err) {
        results.push({
          provider: provider.name,
          sport: tc.sport,
          status: "fail",
          events: 0,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Rate limit courtesy
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
  });
}
