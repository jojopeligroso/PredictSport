import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyDeadline } from "@/lib/telegram/notify";

/**
 * GET /api/notifications/cron
 *
 * Called hourly by Vercel Cron. Checks for events locking soon
 * and sends reminder notifications to linked Telegram groups.
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

  if (!telegramGroupId) {
    return NextResponse.json({ error: "TELEGRAM_GROUP_CHAT_ID not set" }, { status: 500 });
  }

  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  // Find events that lock within the next 2 hours and haven't been notified yet.
  // We check lock_time > oneHourAgo to avoid re-notifying events from previous cron runs
  // (cron runs hourly, so anything with lock_time > now - 1h hasn't been covered).
  const { data: events, error } = await supabase
    .from("events")
    .select("id, event_name, lock_time, status")
    .eq("status", "upcoming")
    .gt("lock_time", now.toISOString())
    .lte("lock_time", twoHoursFromNow.toISOString());

  if (error) {
    console.error("Cron: failed to fetch events:", error.message);
    return NextResponse.json({ error: "DB query failed" }, { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const event of events ?? []) {
    const lockTime = new Date(event.lock_time);
    const hoursLeft = (lockTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    try {
      await notifyDeadline(telegramGroupId, event.event_name, hoursLeft, appUrl);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Cron: failed to notify for ${event.event_name}: ${msg}`);
      errors.push(event.event_name);
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    events_found: (events ?? []).length,
    notifications_sent: sent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
