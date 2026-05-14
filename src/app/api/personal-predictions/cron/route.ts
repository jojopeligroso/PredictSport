import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchResult } from "@/lib/sports/fetch-result";
import type { Sport } from "@/lib/sports/types";

/**
 * GET /api/personal-predictions/cron
 *
 * Called nightly by Vercel Cron. Re-fetches results for all personal
 * predictions where result_value IS NULL and start_time < now() - 3 hours.
 *
 * SECURITY: Protected by CRON_SECRET — Vercel sets the Authorization
 * header automatically for cron invocations.
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function determineIsCorrect(
  predictionValue: string,
  winner: string | null,
  participants: string[]
): boolean {
  if (predictionValue === "draw") return winner === null;
  if (predictionValue === "home") {
    const home = participants[0] ?? "";
    return (
      winner !== null &&
      (winner.toLowerCase() === home.toLowerCase() ||
        winner.toLowerCase().includes(home.toLowerCase()) ||
        home.toLowerCase().includes(winner.toLowerCase()))
    );
  }
  if (predictionValue === "away") {
    const away = participants[1] ?? "";
    return (
      winner !== null &&
      (winner.toLowerCase() === away.toLowerCase() ||
        winner.toLowerCase().includes(away.toLowerCase()) ||
        away.toLowerCase().includes(winner.toLowerCase()))
    );
  }
  // Direct name match (race sports)
  return winner !== null && winner.toLowerCase() === predictionValue.toLowerCase();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  // Don't chase results older than 14 days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const { data: picks, error } = await supabase
    .from("personal_predictions")
    .select("id, external_event_id, sport, prediction_value, participants, provider_league, start_time")
    .is("result_value", null)
    .lt("start_time", threeHoursAgo.toISOString())
    .gte("start_time", fourteenDaysAgo.toISOString());

  if (error) {
    console.error("personal-predictions cron: DB query failed:", error.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  const candidates = picks ?? [];
  let resolved = 0;
  let no_result = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i++) {
    const pick = candidates[i]!;

    try {
      const result = await fetchResult(
        pick.sport as Sport,
        pick.external_event_id,
        pick.provider_league ?? undefined
      );

      if (!result?.is_final) {
        no_result++;
        console.log(`[personal-predictions-cron] no_result: ${pick.external_event_id}`);
      } else {
        const participants: string[] = Array.isArray(pick.participants)
          ? (pick.participants as string[])
          : [];
        const isCorrect = determineIsCorrect(pick.prediction_value, result.winner, participants);

        const { error: updateError } = await supabase
          .from("personal_predictions")
          .update({ result_value: result.winner ?? "draw", is_correct: isCorrect })
          .eq("id", pick.id);

        if (updateError) {
          console.error(`[personal-predictions-cron] update failed for ${pick.id}:`, updateError.message);
          errors++;
        } else {
          resolved++;
          console.log(`[personal-predictions-cron] resolved: ${pick.external_event_id} → ${result.winner ?? "draw"} (correct: ${isCorrect})`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[personal-predictions-cron] error for ${pick.external_event_id}: ${msg}`);
      errors++;
    }

    if (i < candidates.length - 1) {
      await sleep(300);
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    candidates: candidates.length,
    resolved,
    no_result,
    errors,
  });
}
