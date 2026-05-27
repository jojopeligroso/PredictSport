import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  autoResolveEvent,
  type AutoResultEvent,
  type AutoResultStatus,
} from "@/lib/sports/auto-result";
import { sendPushToUser } from "@/lib/push/send";

/**
 * GET /api/results/cron
 *
 * Scheduled DAILY at 06:30 UTC (07:30 BST / 06:30 GMT) by Vercel Cron
 * (see vercel.json). Polls for locked events that need auto-result
 * resolution and scores predictions when a final result is found from
 * the sports provider chain. Also flips WC competitions' entry_closes_at
 * once the soft cutoff passes.
 *
 * SECURITY: Protected by CRON_SECRET — Vercel sets the Authorization
 * header automatically for cron invocations. Same secret is mirrored
 * into Supabase Vault (`cron_secret`) for the pg_cron jobs.
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  // Verify cron secret -- Vercel sends this automatically for cron jobs
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();

  // Query: locked events from the last 7 days that haven't been result-confirmed
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000);

  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id, event_name, sport, start_time, external_event_id, provider_league, result_data, competition_id"
    )
    .eq("status", "locked")
    .eq("result_confirmed", false)
    .gte("start_time", sevenDaysAgo.toISOString());

  if (error) {
    console.error("Results cron: failed to fetch events:", error.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  // Filter in JS for conditions that can't be expressed in the Supabase query
  const candidates = (events ?? []).filter((e) => {
    const rd = e.result_data as Record<string, unknown> | null;

    // Skip events with no result_data (admin-UI-created events without auto-result setup)
    if (!rd) return false;

    // Skip if already terminal
    const autoStatus = rd.auto_result_status as string | undefined;
    if (autoStatus === "window_expired" || autoStatus === "confirmed") {
      return false;
    }

    // Skip if too early (quick check before calling autoResolveEvent)
    const checkAfter = rd.auto_result_check_after as string | undefined;
    if (checkAfter && now.toISOString() < checkAfter) {
      return false;
    }

    return true;
  });

  // Process sequentially with 200ms sleep between events to avoid rate limits
  const counts: Record<AutoResultStatus, number> = {
    confirmed: 0,
    no_result: 0,
    window_expired: 0,
    skipped: 0,
    error: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const event = candidates[i] as AutoResultEvent;
    const outcome = await autoResolveEvent(supabase, event, now);

    counts[outcome.status]++;

    const detail = outcome.message ? ` (${outcome.message})` : "";
    const provider = outcome.provider ? ` [${outcome.provider}]` : "";
    console.log(
      `[results-cron] ${outcome.status}: "${outcome.event_name}"${provider}${detail}`
    );

    // Sleep between events to respect provider rate limits
    if (i < candidates.length - 1) {
      await sleep(200);
    }
  }

  // ── Notify competition admins about manual events missing results ─────────
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
  const sevenDaysAgoAlert = new Date(now.getTime() - 7 * 24 * 3600000);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";

  let manualAlertsSent = 0;

  const { data: manualEvents } = await supabase
    .from("events")
    .select("id, event_name, competition_id, start_time")
    .eq("status", "locked")
    .eq("result_confirmed", false)
    .is("external_event_id", null)
    .lt("start_time", twoHoursAgo.toISOString())
    .gt("start_time", sevenDaysAgoAlert.toISOString());

  for (const evt of manualEvents ?? []) {
    const startTime = new Date(evt.start_time);
    const hoursAgo = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60 * 60));

    // Fetch competition admins
    const { data: adminMembers } = await supabase
      .from("competition_members")
      .select("user_id")
      .eq("competition_id", evt.competition_id)
      .in("role", ["admin", "co_admin"]);

    for (const adminMember of adminMembers ?? []) {
      try {
        await sendPushToUser(
          adminMember.user_id,
          {
            title: "Result needed",
            body: `${evt.event_name} ended ${hoursAgo}h ago — enter the result`,
            url: `${appUrl}/competitions/${evt.competition_id}`,
            tag: `result-needed-${evt.id}`,
          },
          "result_notifications"
        );
        manualAlertsSent++;
      } catch (err) {
        console.error(
          `[results-cron] Failed to push alert for event "${evt.event_name}" to user ${adminMember.user_id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    events_checked: candidates.length,
    confirmed: counts.confirmed,
    no_result: counts.no_result,
    window_expired: counts.window_expired,
    skipped: counts.skipped,
    errors: counts.error,
    manual_alerts_sent: manualAlertsSent,
  });
}
