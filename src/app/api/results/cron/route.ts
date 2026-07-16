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
 * PRIMARY SCHEDULE: pg_cron `wc-results` every 15 min
 *   — see migration 20260612100000_results_cron_15min.sql
 * FALLBACK: Vercel Cron daily at 07:00 UTC (see vercel.json)
 *
 * Polls for locked events that need auto-result resolution and scores
 * predictions when a final result is found from the sports provider
 * chain. Also flips WC competitions' entry_closes_at once the soft
 * cutoff passes.
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
  // Archive mode: no cron processing on the display site.
  if (process.env.NEXT_PUBLIC_PRODUCT_MODE === "world_cup_2026_archive") {
    return NextResponse.json({ skipped: true, reason: "archive_mode" });
  }

  // Verify cron secret -- Vercel sends this automatically for cron jobs
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();

  // Query: events from the last 7 days that are past lock_time and not yet confirmed.
  // Uses lock_time < now() instead of status = "locked" because WC events use
  // per-fixture locking (lock_time is authoritative) and stay status "upcoming"
  // until resulted — nothing transitions them to "locked" at the event level.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000);

  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id, event_name, sport, start_time, lock_time, external_event_id, provider_league, result_data, competition_id"
    )
    .eq("result_confirmed", false)
    .lte("lock_time", now.toISOString())
    .gte("start_time", sevenDaysAgo.toISOString())
    .not("status", "in", '("cancelled","postponed")');

  if (error) {
    console.error("Results cron: failed to fetch events:", error.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  // Filter in JS for conditions that can't be expressed in the Supabase query
  const candidates = (events ?? []).filter((e) => {
    const rd = e.result_data as Record<string, unknown> | null;

    // Skip events with no result_data AND no external_event_id —
    // these are admin-UI-created events without auto-result setup.
    // Events with external_event_id (including manual:wc2026-*) CAN be
    // auto-resolved via provider search even with null result_data.
    if (!rd && !e.external_event_id) return false;

    // Skip if already terminal
    const autoStatus = rd?.auto_result_status as string | undefined;
    if (autoStatus === "window_expired" || autoStatus === "confirmed") {
      return false;
    }

    // Skip if too early (quick check before calling autoResolveEvent)
    const checkAfter = rd?.auto_result_check_after as string | undefined;
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
    .select("id, event_name, competition_id, start_time, competitions(tournament_id)")
    .eq("status", "locked")
    .eq("result_confirmed", false)
    .is("external_event_id", null)
    .lt("start_time", twoHoursAgo.toISOString())
    .gt("start_time", sevenDaysAgoAlert.toISOString());

  // Cache: tournament_id → all sibling competition IDs
  const manualSiblingCache = new Map<string, string[]>();

  for (const evt of manualEvents ?? []) {
    const startTime = new Date(evt.start_time);
    const hoursAgo = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60 * 60));

    // Fetch competition admins (including sibling instances for tournaments)
    const comps = (evt as Record<string, unknown>).competitions as { tournament_id: string | null } | { tournament_id: string | null }[] | null;
    const tournamentId = Array.isArray(comps) ? comps[0]?.tournament_id : comps?.tournament_id;
    let adminCompIds: string[];
    if (tournamentId) {
      let cached = manualSiblingCache.get(tournamentId);
      if (!cached) {
        const { data: siblings } = await supabase
          .from("competitions")
          .select("id")
          .eq("tournament_id", tournamentId)
          .in("status", ["active", "draft"]);
        cached = (siblings ?? []).map((c) => c.id);
        manualSiblingCache.set(tournamentId, cached);
      }
      adminCompIds = cached;
    } else {
      adminCompIds = [evt.competition_id];
    }

    const { data: adminMembers } = await supabase
      .from("competition_members")
      .select("user_id")
      .in("competition_id", adminCompIds)
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
          "result_notifications",
          { competitionId: evt.competition_id },
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

  // ── Auto-conclude rounds where all events are confirmed ──────────────────
  // Find rounds in "open" or "locked" status where every event has
  // result_confirmed = true. Transition them to "scored".
  let roundsConcluded = 0;

  const { data: openRounds } = await supabase
    .from("rounds")
    .select("id, name, competition_id")
    .in("status", ["open", "locked"]);

  for (const round of openRounds ?? []) {
    // Count total events and confirmed events in this round
    const { count: totalEvents } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("round_id", round.id);

    if (!totalEvents || totalEvents === 0) continue;

    const { count: confirmedEvents } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("round_id", round.id)
      .eq("result_confirmed", true);

    if (confirmedEvents === totalEvents) {
      const { error: roundErr } = await supabase
        .from("rounds")
        .update({ status: "scored" })
        .eq("id", round.id);

      if (roundErr) {
        console.error(
          `[results-cron] Failed to conclude round "${round.name}": ${roundErr.message}`
        );
      } else {
        console.log(
          `[results-cron] Auto-concluded round "${round.name}" (${round.id}) → scored`
        );
        roundsConcluded++;
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
    rounds_concluded: roundsConcluded,
  });
}
