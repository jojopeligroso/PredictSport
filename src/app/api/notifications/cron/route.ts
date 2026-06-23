import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendPushToUser,
  getUserReminderLead,
  alreadyNotifiedWithTag,
  getMutedCompetitionIds,
} from "@/lib/push/send";
import { serverT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";

/**
 * GET /api/notifications/cron
 *
 * Scheduled HOURLY at :00 by Supabase pg_cron (job `wc-notifications-hourly`,
 * see migration 20260528000100). Sends push deadline reminders to members
 * of competitions whose events lock soon.
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

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";

  const now = new Date();
  // 4-hour lookahead covers the longest user-configurable lead time (240min).
  // Per-user filtering happens below so users with shorter leads skip events.
  const maxLookaheadMs = 4 * 60 * 60 * 1000;
  const lookaheadEnd = new Date(now.getTime() + maxLookaheadMs);

  // Find events that lock within the max lookahead window, joined to their
  // competition so we can filter out personal comps and pick the right URL.
  const { data: rawEvents, error } = await supabase
    .from("events")
    .select(
      "id, event_name, lock_time, status, competition_id, competitions(id, type, product_mode)"
    )
    .eq("status", "upcoming")
    .gt("lock_time", now.toISOString())
    .lte("lock_time", lookaheadEnd.toISOString());

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

  // ── Web Push deadline reminders to competition members ─────────────
  // Batched: each user gets at most ONE notification listing all events
  // that fall within their configured reminder lead time. sendPushToUser
  // handles quiet hours, daily cap, and per-event dedup internally.
  let pushSent = 0;
  let pushThrottled = 0;
  const memberCache = new Map<string, string[]>();

  // Build userId → [events] map: which events each user should hear about
  const userEvents = new Map<string, EventRow[]>();

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
    for (const uid of userIds) {
      const list = userEvents.get(uid) ?? [];
      list.push(event);
      userEvents.set(uid, list);
    }
  }

  // Fetch notification_prefs for all affected users in one query
  const allUserIds = Array.from(userEvents.keys());
  const userPrefsMap = new Map<string, Record<string, unknown> | null>();
  if (allUserIds.length > 0) {
    const { data: userRows } = await supabase
      .from("users")
      .select("id, notification_prefs")
      .in("id", allUserIds);
    for (const u of userRows ?? []) {
      userPrefsMap.set(u.id, u.notification_prefs as Record<string, unknown> | null);
    }
  }

  // ── Prediction completeness check ──────────────────────────────────
  // Only remind users who haven't fully predicted the locking events.
  // For each event, count the required prediction types vs what the user
  // has submitted. Skip users who are fully done.
  const allEventIds = events.map((e) => e.id);

  // How many prediction types each event requires
  const requiredCountByEvent = new Map<string, number>();
  if (allEventIds.length > 0) {
    const { data: eptRows } = await supabase
      .from("event_prediction_types")
      .select("event_id")
      .in("event_id", allEventIds);
    for (const row of eptRows ?? []) {
      requiredCountByEvent.set(
        row.event_id,
        (requiredCountByEvent.get(row.event_id) ?? 0) + 1
      );
    }
  }

  // What each user has already predicted for these events
  // Map of `userId:eventId` → count of submitted predictions
  const submittedMap = new Map<string, number>();
  if (allEventIds.length > 0 && allUserIds.length > 0) {
    const { data: predRows } = await supabase
      .from("predictions")
      .select("user_id, event_id")
      .in("event_id", allEventIds)
      .in("user_id", allUserIds);
    for (const row of predRows ?? []) {
      const key = `${row.user_id}:${row.event_id}`;
      submittedMap.set(key, (submittedMap.get(key) ?? 0) + 1);
    }
  }

  // Send batched notification per user — only for events they haven't
  // fully predicted
  for (const [userId, allEvents] of userEvents) {
    const prefs = userPrefsMap.get(userId) ?? null;
    const leadMinutes = getUserReminderLead(prefs);

    // Filter to events within this user's lead time
    const cutoff = new Date(now.getTime() + leadMinutes * 60 * 1000);
    const inWindow = allEvents.filter((e) => new Date(e.lock_time) <= cutoff);
    if (inWindow.length === 0) continue;

    // Only keep events where the user's predictions are incomplete
    const incompleteRaw = inWindow.filter((e) => {
      const required = requiredCountByEvent.get(e.id) ?? 0;
      if (required === 0) return false; // no prediction types configured
      const submitted = submittedMap.get(`${userId}:${e.id}`) ?? 0;
      return submitted < required;
    });
    // Drop events from competitions the user has muted in their settings.
    // This is a batched cross-competition reminder, so we can't gate it inside
    // sendPushToUser via a single competitionId — filter upstream instead.
    const mutedComps = getMutedCompetitionIds(prefs);
    const incomplete =
      mutedComps.size === 0
        ? incompleteRaw
        : incompleteRaw.filter((e) => !mutedComps.has(e.competition_id));
    if (incomplete.length === 0) continue;

    // Pick the URL for the notification tap target
    const firstWc = incomplete.find(
      (e) => e.competitions?.product_mode === WC_PRODUCT_MODE
    );
    const url = firstWc ? "/wc" : `/predictions/${incomplete[0].id}`;

    // Resolve user's locale for translated push text
    const userLocale: Locale = prefs?.locale === "es" ? "es" : "en";
    const t = (key: string, vars?: Record<string, string | number>) =>
      serverT(userLocale, key, vars);

    // Build message body
    let body: string;
    if (incomplete.length === 1) {
      const lt = formatLeadTime(new Date(incomplete[0].lock_time), now);
      body = t("push.single_event_body", { event: incomplete[0].event_name, time: lt });
    } else {
      const names = incomplete.slice(0, 3).map((e) => e.event_name);
      const lt = formatLeadTime(new Date(incomplete[0].lock_time), now);
      body =
        incomplete.length <= 3
          ? t("push.multi_event_body", { events: names.join(", "), time: lt })
          : t("push.multi_event_more_body", {
              events: names.join(", "),
              extra: incomplete.length - 3,
            });
    }

    // Dedup: one reminder per user per calendar day (UTC).
    // Previously used the first event's ID, which shifted when the user
    // completed that event between cron runs — causing repeat notifications.
    // Now: stable daily tag checked server-side before sending.
    const todayIso = now.toISOString().slice(0, 10);
    const dailyTag = `deadline-${todayIso}`;

    const alreadySent = await alreadyNotifiedWithTag(supabase, userId, dailyTag);
    if (alreadySent) {
      pushThrottled++;
      continue;
    }

    try {
      const result = await sendPushToUser(
        userId,
        {
          title:
            incomplete.length === 1
              ? t("push.single_event_title")
              : t("push.multi_event_title", { count: incomplete.length }),
          body,
          url,
          tag: dailyTag,
        },
        "prediction_reminders"
      );
      pushSent += result.sent;
      if (result.throttled) pushThrottled++;
    } catch (err) {
      console.error(`Push: failed for batch/${userId}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    events_found: events.length,
    push_sent: pushSent,
    push_throttled: pushThrottled,
  });
}
