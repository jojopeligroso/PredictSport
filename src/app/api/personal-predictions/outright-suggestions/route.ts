import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePersonalCompetition } from "@/lib/personal-competition";

/** Minimum fixture picks in a league before suggesting an outright */
const SUGGESTION_THRESHOLD = 3;
/** Re-surface a dismissed suggestion once the user reaches this many picks */
const RESURFACE_THRESHOLD = 10;

/**
 * GET /api/personal-predictions/outright-suggestions
 *
 * Returns leagues where the user has >= 3 fixture picks but no outright
 * prediction, filtered to exclude dismissed leagues (unless they've since
 * reached 10+ picks).
 *
 * Response shape:
 * { suggestions: [{ provider_league, league_name, pick_count, sport }] }
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let competitionId: string;
  try {
    competitionId = await getOrCreatePersonalCompetition(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve personal competition", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Count fixture picks per league (excluding outright events themselves)
  const { data: leagueCounts, error: countError } = await supabase
    .from("events")
    .select("provider_league, sport")
    .eq("competition_id", competitionId)
    .not("provider_league", "is", null);

  if (countError) {
    return NextResponse.json(
      { error: "Failed to query events", details: countError.message },
      { status: 500 },
    );
  }

  // Aggregate picks per league
  const leagueMap = new Map<string, { sport: string; count: number }>();
  for (const row of leagueCounts ?? []) {
    const league = row.provider_league as string;
    const existing = leagueMap.get(league);
    if (existing) {
      existing.count++;
    } else {
      leagueMap.set(league, { sport: row.sport, count: 1 });
    }
  }

  // Filter to leagues meeting the threshold
  const candidates = Array.from(leagueMap.entries())
    .filter(([, v]) => v.count >= SUGGESTION_THRESHOLD);

  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Find leagues that already have an outright (final_standings EPT) in this competition
  const { data: outrightEvents } = await supabase
    .from("events")
    .select("provider_league, event_prediction_types!inner(prediction_type)")
    .eq("competition_id", competitionId)
    .not("provider_league", "is", null)
    .eq("event_prediction_types.prediction_type", "final_standings");

  const outrightLeagues = new Set(
    (outrightEvents ?? []).map((row) => row.provider_league as string).filter(Boolean),
  );

  // Load dismissed suggestions from user prefs
  const { data: userRow } = await supabase
    .from("users")
    .select("notification_prefs")
    .eq("id", user.id)
    .single();

  const prefs = (userRow?.notification_prefs ?? {}) as Record<string, unknown>;
  const dismissed = (prefs.dismissed_outright_suggestions ?? {}) as Record<string, number>;

  // Build suggestions: no existing outright, not dismissed (or resurface at threshold)
  const suggestions = candidates
    .filter(([league, { count }]) => {
      if (outrightLeagues.has(league)) return false;
      const dismissedAt = dismissed[league];
      if (dismissedAt && count < RESURFACE_THRESHOLD) return false;
      return true;
    })
    .map(([league, { sport, count }]) => ({
      provider_league: league,
      league_name: formatLeagueName(league),
      pick_count: count,
      sport,
    }))
    .sort((a, b) => b.pick_count - a.pick_count);

  return NextResponse.json({ suggestions });
}

/**
 * POST /api/personal-predictions/outright-suggestions
 *
 * Dismiss a suggestion. Stores the dismissal in user notification_prefs.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider_league: string; action: "dismiss" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.provider_league || body.action !== "dismiss") {
    return NextResponse.json(
      { error: "provider_league and action:'dismiss' are required" },
      { status: 400 },
    );
  }

  // Read current prefs
  const { data: userRow } = await supabase
    .from("users")
    .select("notification_prefs")
    .eq("id", user.id)
    .single();

  const prefs = (userRow?.notification_prefs ?? {}) as Record<string, unknown>;
  const dismissed = (prefs.dismissed_outright_suggestions ?? {}) as Record<string, number>;
  dismissed[body.provider_league] = Date.now();

  const { error: updateError } = await supabase
    .from("users")
    .update({
      notification_prefs: { ...prefs, dismissed_outright_suggestions: dismissed },
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save dismissal", details: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ dismissed: true });
}

/** Convert provider_league slug to readable name (e.g. "eng.1" → "eng.1") */
function formatLeagueName(league: string): string {
  // Provider leagues are already human-readable slugs like "eng.1", "esp.1".
  // The UI layer will map these to full names using the sports provider.
  return league;
}
