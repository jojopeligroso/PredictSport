import * as webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  const subject =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseServiceClient = ReturnType<typeof createClient<any>>;

function getServiceClient(): SupabaseServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export type NotifCategory =
  | "prediction_reminders"
  | "result_notifications"
  | "leaderboard_updates"
  | "chat_mentions"
  | "chat_member_join"
  | "reputation_tags";

/** Default reminder lead time in minutes. Users can override in notification_prefs. */
export const DEFAULT_REMINDER_LEAD_MINUTES = 60;

const VALID_LEADS = [30, 60, 120, 240, 720, 1440];

/** Returns the user's reminder lead times as a sorted array of minutes. */
export function getUserReminderLeads(prefs: Record<string, unknown> | null): number[] {
  const val = prefs?.reminder_lead_minutes;
  if (Array.isArray(val)) {
    const valid = val.filter((v): v is number => typeof v === "number" && VALID_LEADS.includes(v));
    return valid.length > 0 ? valid.sort((a, b) => a - b) : [DEFAULT_REMINDER_LEAD_MINUTES];
  }
  // Legacy: single number
  if (typeof val === "number" && VALID_LEADS.includes(val)) return [val];
  return [DEFAULT_REMINDER_LEAD_MINUTES];
}

/** @deprecated Use getUserReminderLeads — returns max lead for backwards compat. */
export function getUserReminderLead(prefs: Record<string, unknown> | null): number {
  return Math.max(...getUserReminderLeads(prefs));
}

export type LeaderboardTrigger = "rising" | "any_change";

/** Whether to notify on rank rise only (default) or any change. */
export function getLeaderboardTrigger(prefs: Record<string, unknown> | null): LeaderboardTrigger {
  const val = prefs?.leaderboard_trigger;
  if (val === "rising" || val === "any_change") return val;
  return "rising";
}

/** No hard cap by default. Users can optionally set one in notification_prefs.daily_cap */
function getUserDailyCap(prefs: Record<string, unknown> | null): number | null {
  const val = prefs?.daily_cap;
  if (typeof val === "number" && [5, 8, 12, 20].includes(val)) return val;
  return null; // no limit
}

/**
 * Competitions the user has muted in their profile settings. Stored as an
 * array of UUIDs under notification_prefs.muted_competition_ids. Any push
 * tagged with a muted competition_id is silently dropped server-side.
 *
 * Returned as a Set for O(1) lookup; never null — missing/invalid yields {}.
 */
export function getMutedCompetitionIds(
  prefs: Record<string, unknown> | null,
): Set<string> {
  const raw = prefs?.muted_competition_ids;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((v): v is string => typeof v === "string"));
}

interface QuietHoursConfig {
  enabled: boolean;
  start: number; // 0-23
  end: number;   // 0-23
}

function isQuietHours(
  timezone: string | null,
  config: QuietHoursConfig
): boolean {
  if (!config.enabled) return false;
  const tz = timezone ?? "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    // Handle wrapping (e.g. 22:00 → 07:00)
    if (config.start > config.end) {
      return hour >= config.start || hour < config.end;
    }
    return hour >= config.start && hour < config.end;
  } catch {
    return false; // invalid timezone, don't block
  }
}

async function getDailySendCount(
  supabase: SupabaseServiceClient,
  userId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("push_notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("sent_at", startOfDay.toISOString());

  return count ?? 0;
}

async function logNotification(
  supabase: SupabaseServiceClient,
  userId: string,
  category: NotifCategory,
  tag?: string,
  eventId?: string
): Promise<void> {
  await supabase.from("push_notification_log").insert({
    user_id: userId,
    category,
    tag: tag ?? null,
    event_id: eventId ?? null,
  });
}

export async function alreadyNotifiedWithTag(
  supabase: SupabaseServiceClient,
  userId: string,
  tag: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("push_notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tag", tag);

  return (count ?? 0) > 0;
}

async function alreadyNotifiedForEvent(
  supabase: SupabaseServiceClient,
  userId: string,
  eventId: string,
  category: NotifCategory
): Promise<boolean> {
  const { count } = await supabase
    .from("push_notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .eq("category", category);

  return (count ?? 0) > 0;
}

/**
 * Send push notification to a specific user (all their subscribed devices).
 * Automatically removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  category: NotifCategory,
  options?: { eventId?: string; competitionId?: string; skipThrottle?: boolean }
): Promise<{ sent: number; failed: number; cleaned: number; throttled?: string }> {
  ensureVapid();
  const supabase = getServiceClient();

  // Single query for prefs + timezone
  const { data: userRow } = await supabase
    .from("users")
    .select("notification_prefs, timezone")
    .eq("id", userId)
    .single();

  const prefs = userRow?.notification_prefs as Record<string, boolean> | null;
  // Conservative defaults: core categories on, low-value noise off.
  // leaderboard_updates defaults ON because it only fires on rank rises
  // (controlled by leaderboard_trigger pref, default "rising").
  const defaultPrefs: Record<NotifCategory, boolean> = {
    prediction_reminders: true,
    result_notifications: true,
    leaderboard_updates: true,
    chat_mentions: true,
    chat_member_join: false,
    reputation_tags: true,
  };
  const enabled = prefs?.[category] ?? defaultPrefs[category];
  if (!enabled) return { sent: 0, failed: 0, cleaned: 0 };

  if (options?.competitionId) {
    const muted = getMutedCompetitionIds(
      userRow?.notification_prefs as Record<string, unknown> | null,
    );
    if (muted.has(options.competitionId)) {
      return { sent: 0, failed: 0, cleaned: 0, throttled: "muted_competition" };
    }
  }

  if (!options?.skipThrottle) {
    // Quiet hours check — user-configurable, defaults to 22:00-07:00
    const allPrefs = userRow?.notification_prefs as Record<string, unknown> | null;
    const quietConfig: QuietHoursConfig = {
      enabled: typeof allPrefs?.quiet_hours_enabled === "boolean" ? allPrefs.quiet_hours_enabled : true,
      start: typeof allPrefs?.quiet_hours_start === "number" ? allPrefs.quiet_hours_start : 22,
      end: typeof allPrefs?.quiet_hours_end === "number" ? allPrefs.quiet_hours_end : 7,
    };
    if (isQuietHours(userRow?.timezone ?? null, quietConfig)) {
      return { sent: 0, failed: 0, cleaned: 0, throttled: "quiet_hours" };
    }

    // Daily cap check — only enforced if user has opted into a cap
    const dailyCap = getUserDailyCap(allPrefs);
    if (dailyCap !== null) {
      const todayCount = await getDailySendCount(supabase, userId);
      if (todayCount >= dailyCap) {
        return { sent: 0, failed: 0, cleaned: 0, throttled: "daily_cap" };
      }
    }

    // Per-event dedup check
    if (options?.eventId) {
      const already = await alreadyNotifiedForEvent(supabase, userId, options.eventId, category);
      if (already) {
        return { sent: 0, failed: 0, cleaned: 0, throttled: "already_sent" };
      }
    }
  }

  // Get all subscriptions for this user
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys_p256dh, keys_auth")
    .eq("user_id", userId);

  if (!subscriptions?.length) return { sent: 0, failed: 0, cleaned: 0 };

  let sent = 0;
  let failed = 0;
  let cleaned = 0;
  const staleIds: string[] = [];

  const jsonPayload = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        jsonPayload
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription no longer valid — mark for cleanup
        staleIds.push(sub.id);
        cleaned++;
      } else {
        failed++;
      }
    }
  }

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  if (sent > 0) {
    await logNotification(supabase, userId, category, payload.tag, options?.eventId);
  }

  return { sent, failed, cleaned };
}

/**
 * Send push to all users who have subscriptions (bulk).
 * Used for broadcast notifications like leaderboard updates.
 */
export async function sendPushToAll(
  payload: PushPayload,
  category: NotifCategory,
  excludeUserIds: string[] = []
): Promise<{ totalSent: number; totalFailed: number; totalCleaned: number }> {
  const supabase = getServiceClient();

  // Get distinct user IDs with push subscriptions
  let query = supabase.from("push_subscriptions").select("user_id");

  if (excludeUserIds.length > 0) {
    query = query.not(
      "user_id",
      "in",
      `(${excludeUserIds.join(",")})`
    );
  }

  const { data: subscriptions } = await query;

  const userIds = Array.from(
    new Set(subscriptions?.map((s) => s.user_id) ?? [])
  );

  let totalSent = 0;
  let totalFailed = 0;
  let totalCleaned = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload, category);
    totalSent += result.sent;
    totalFailed += result.failed;
    totalCleaned += result.cleaned;
  }

  return { totalSent, totalFailed, totalCleaned };
}
