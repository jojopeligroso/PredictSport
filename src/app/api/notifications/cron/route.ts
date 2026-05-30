import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyDeadline } from "@/lib/telegram/notify";
import { revealPredictions } from "@/lib/telegram/predictions";
import { sendPushToUser } from "@/lib/push/send";

/**
 * GET /api/notifications/cron
 *
 * Scheduled HOURLY at :00 by Supabase pg_cron (job `wc-notifications-hourly`,
 * see migration 20260528000100). Two responsibilities:
 *   1. Push deadline reminders to members of competitions whose events lock soon.
 *   2. Reveal predictions in the linked Telegram group when events lock.
 *
 * SECURITY: Protected by CRON_SECRET. Stored in Supabase Vault as secret
 * `cron_secret` (for pg_cron) AND in Vercel project env (kept in sync).
 *
 * Personal competitions are excluded — those are single-user pick journals
 * that don't need broadcast reminders, and broadcasting their events to
 * unrelated subscribers produced 404s when the URL pointed at a route the
 * subscriber had no membership for.
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

const WC_PRODUCT_MODE = "world_cup_2026_shell";

function formatLeadTime(lockTime: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((lockTime.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 90) return "1h";
  return `${Math.round(minutes / 60)}h`;
}

export async function GET(request: Request) {
  // Verify cron secret — Vercel sends this automatically for cron jobs
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";
  const telegramGroupId = process.env.TELEGRAM_GROUP_CHAT_ID;

  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Find events that lock within the next 2 hours, joined to their competition
  // so we can filter out personal comps and pick the right destination URL.
  const { data: rawEvents, error } = await supabase
    .from("events")
    .select(
      "id, event_name, lock_time, status, competition_id, competitions(id, type, product_mode)"
    )
    .eq("status", "upcoming")
    .gt("lock_time", now.toISOString())
    .lte("lock_time", twoHoursFromNow.toISOString());

  if (error) {
    console.error("Cron: failed to fetch events:", error.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  type EventRow = {
    id: string;
    event_name: string;
    lock_time: string;
    competition_id: string;
    competitions: { id: string; type: string | null; product_mode: string | null } | null;
  };

  const events = ((rawEvents ?? []) as unknown as EventRow[]).filter(
    (e) => e.competitions && e.competitions.type !== "personal"
  );

  // ── Telegram deadline pings ────────────────────────────────────────
  // Only run if a group chat is configured. Earlier this returned 500
  // when unset, which silently disabled the push block below it too.
  let telegramSent = 0;
  const telegramErrors: string[] = [];

  if (telegramGroupId) {
    for (const event of events) {
      const lockTime = new Date(event.lock_time);
      const hoursLeft = (lockTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const isWc = event.competitions?.product_mode === WC_PRODUCT_MODE;
      const targetPath = isWc ? "/wc" : "/predictions";

      try {
        await notifyDeadline(
          telegramGroupId,
          event.event_name,
          hoursLeft,
          appUrl,
          targetPath
        );
        telegramSent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Cron: failed to notify for ${event.event_name}: ${msg}`);
        telegramErrors.push(event.event_name);
      }
    }
  }

  // ── Web Push deadline reminders to competition members ─────────────
  // Scoped to actual members of the locking event's competition so users
  // never receive pings for competitions they can't access.
  let pushSent = 0;
  const memberCache = new Map<string, string[]>();

  for (const event of events) {
    let userIds = memberCache.get(event.competition_id);
    if (!userIds) {
      const { data: members } = await supabase
        .from("competition_members")
        .select("user_id")
        .eq("competition_id", event.competition_id);
      userIds = (members ?? []).map((m) => m.user_id);
      memberCache.set(event.competition_id, userIds);
    }

    if (userIds.length === 0) continue;

    const lockTime = new Date(event.lock_time);
    const leadTime = formatLeadTime(lockTime, now);
    const isWc = event.competitions?.product_mode === WC_PRODUCT_MODE;
    const url = isWc ? "/wc" : `/predictions/${event.id}`;

    for (const userId of userIds) {
      try {
        const result = await sendPushToUser(
          userId,
          {
            title: "Predictions closing soon",
            body: `${event.event_name} locks in ~${leadTime} — submit your picks!`,
            url,
            tag: `deadline-${event.id}`,
          },
          "prediction_reminders"
        );
        pushSent += result.sent;
      } catch (err) {
        console.error(`Push: failed for ${event.event_name}/${userId}:`, err);
      }
    }
  }

  // ── Reveal predictions for events that just locked ─────────────────
  // Telegram-only. Find events whose lock_time fell within the last hour.
  let revealed = 0;
  if (telegramGroupId) {
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const { data: lockedEvents } = await supabase
      .from("events")
      .select("id, event_name")
      .in("status", ["upcoming", "locked"])
      .lte("lock_time", now.toISOString())
      .gt("lock_time", oneHourAgo.toISOString());

    for (const event of lockedEvents ?? []) {
      try {
        await revealPredictions(telegramGroupId, event.id);
        revealed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Cron: failed to reveal ${event.event_name}: ${msg}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    events_found: events.length,
    push_sent: pushSent,
    telegram_sent: telegramSent,
    predictions_revealed: revealed,
    telegram_configured: !!telegramGroupId,
    telegram_errors: telegramErrors.length > 0 ? telegramErrors : undefined,
  });
}
