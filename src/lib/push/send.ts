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

function getServiceClient() {
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

type NotifCategory =
  | "prediction_reminders"
  | "result_notifications"
  | "leaderboard_updates"
  | "chat_mentions"
  | "chat_member_join";

/**
 * Send push notification to a specific user (all their subscribed devices).
 * Automatically removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  category: NotifCategory
): Promise<{ sent: number; failed: number; cleaned: number }> {
  ensureVapid();
  const supabase = getServiceClient();

  // Check user notification prefs
  const { data: user } = await supabase
    .from("users")
    .select("notification_prefs")
    .eq("id", userId)
    .single();

  const prefs = user?.notification_prefs as Record<string, boolean> | null;
  // Default to true for reminders and results, false for leaderboard
  const defaultPrefs: Record<NotifCategory, boolean> = {
    prediction_reminders: true,
    result_notifications: true,
    leaderboard_updates: false,
    chat_mentions: true,
    chat_member_join: true,
  };
  const enabled = prefs?.[category] ?? defaultPrefs[category];
  if (!enabled) return { sent: 0, failed: 0, cleaned: 0 };

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
