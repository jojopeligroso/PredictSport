import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/team-suggestions?q=query
 *
 * Autocomplete for team/participant names. Parses historical event_name values
 * (splitting on " vs " and " v ") to build a deduplicated list of team tokens
 * that contain the query string.
 *
 * No competition_id filter — suggestions are drawn from all past events for
 * cross-competition learning.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  // Fetch distinct event names containing the query (case-insensitive)
  const { data: rows, error } = await supabase
    .from("events")
    .select("event_name")
    .ilike("event_name", `%${q}%`)
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch suggestions", details: error.message },
      { status: 500 }
    );
  }

  const qLower = q.toLowerCase();
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const row of rows ?? []) {
    // Split on " vs " and " v " (case-insensitive)
    const tokens = row.event_name.split(/\s+vs?\s+/i);
    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key) && key.includes(qLower)) {
        seen.add(key);
        suggestions.push(trimmed);
      }
    }
  }

  // Sort alphabetically, return up to 10
  suggestions.sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ suggestions: suggestions.slice(0, 10) });
}
