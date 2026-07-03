import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/events/live-scores?ids=a,b,c
 *
 * Returns the in-progress live payload (`events.result_data.live`) for the
 * requested event ids. The payload is written every minute by the
 * `wc-live-scores` pg_cron job (see /api/results/live) as
 * `{ homeScore, awayScore, status, fetchedAt }`.
 *
 * Only unconfirmed events are returned — once the 15-min results cron
 * confirms a result the live payload is superseded and clients fall back to
 * the confirmed result via the normal dashboard refresh.
 *
 * Auth: any signed-in user (events are readable under RLS anyway; this
 * endpoint just avoids shipping full rows to the client).
 */

export interface LiveScorePayload {
  homeScore: number;
  awayScore: number;
  status: string;
  fetchedAt: string;
}

const MAX_IDS = 50;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json(
      { error: "ids query parameter is required" },
      { status: 400 }
    );
  }

  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ scores: {} });
  }

  const { data: events, error } = await supabase
    .from("events")
    .select("id, result_data")
    .in("id", ids)
    .eq("result_confirmed", false)
    .limit(MAX_IDS);

  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const scores: Record<string, LiveScorePayload> = {};
  for (const event of events ?? []) {
    const live = (event.result_data as { live?: LiveScorePayload } | null)
      ?.live;
    if (
      live &&
      typeof live.homeScore === "number" &&
      typeof live.awayScore === "number"
    ) {
      scores[event.id] = {
        homeScore: live.homeScore,
        awayScore: live.awayScore,
        status: typeof live.status === "string" ? live.status : "LIVE",
        fetchedAt: live.fetchedAt,
      };
    }
  }

  return NextResponse.json({ scores });
}
