import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/cron/detect-contradictions
 *
 * Detects prediction contradictions: users whose winner prediction
 * disagrees with the winner implied by their exact_score prediction.
 *
 * Runs daily at 06:00 UTC via pg_cron (job `detect-contradictions`,
 * see migration 20260619200000). Can also be triggered manually.
 *
 * Read-only — never writes to the database. Logs contradictions to
 * console (visible in Vercel function logs) for admin triage.
 *
 * SECURITY: Protected by CRON_SECRET (Vault secret `cron_secret`).
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

interface Contradiction {
  user_id: string;
  display_name: string;
  event_id: string;
  event_name: string;
  result_confirmed: boolean;
  home_score: number;
  away_score: number;
  implied_winner: string;
  stored_winner: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Single SQL query: find all users where winner != implied winner from score
  const { data, error } = await supabase.rpc("detect_prediction_contradictions");

  if (error) {
    console.error("[detect-contradictions] RPC failed:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const contradictions = (data ?? []) as Contradiction[];

  if (contradictions.length > 0) {
    const resulted = contradictions.filter((c) => c.result_confirmed);
    const upcoming = contradictions.filter((c) => !c.result_confirmed);

    console.error(
      `[detect-contradictions] FOUND ${contradictions.length} contradiction(s):`,
      {
        resulted: resulted.map(
          (c) =>
            `${c.display_name}: ${c.event_name} — stored=${c.stored_winner}, implied=${c.implied_winner} (${c.home_score}-${c.away_score})`,
        ),
        upcoming: upcoming.map(
          (c) =>
            `${c.display_name}: ${c.event_name} — stored=${c.stored_winner}, implied=${c.implied_winner} (${c.home_score}-${c.away_score})`,
        ),
      },
    );
  }

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    contradictions_found: contradictions.length,
    resulted_contradictions: contradictions
      .filter((c) => c.result_confirmed)
      .map((c) => ({
        user: c.display_name,
        event: c.event_name,
        stored_winner: c.stored_winner,
        implied_winner: c.implied_winner,
        score: `${c.home_score}-${c.away_score}`,
      })),
    upcoming_contradictions: contradictions
      .filter((c) => !c.result_confirmed)
      .map((c) => ({
        user: c.display_name,
        event: c.event_name,
        stored_winner: c.stored_winner,
        implied_winner: c.implied_winner,
        score: `${c.home_score}-${c.away_score}`,
      })),
  });
}
