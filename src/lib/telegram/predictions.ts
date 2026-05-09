import { createClient } from "@supabase/supabase-js";
import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { getBot } from "./bot";

/**
 * Telegram in-chat prediction flow.
 *
 * Design constraints:
 * - Predictions are SECRET until lock time (no one sees others' picks)
 * - After lock, predictions cannot be changed
 * - Picks happen in DM (private), event cards posted to group
 *
 * Flow:
 * 1. Admin posts event to group → card with "Make Your Pick" deep link
 * 2. User taps → opens DM → bot shows options as inline keyboard
 * 3. User picks → bot stores in Supabase, confirms in DM
 * 4. At lock time → bot reveals all picks to the group
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

// ─── Post Event to Group ────────────────────────────────────────────────────

/**
 * Post an event card to a group chat with a "Make Your Pick" button.
 * The button deep-links to the bot DM to keep predictions private.
 */
export async function postEventToGroup(
  chatId: number | string,
  event: { id: string; event_name: string; lock_time: string; sport?: string },
  botUsername: string
) {
  const lockDate = new Date(event.lock_time);
  const lockStr = lockDate.toLocaleString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });

  const keyboard = new InlineKeyboard().url(
    "Make Your Pick",
    `https://t.me/${botUsername}?start=pick_${event.id}`
  );

  const bot = getBot();
  return bot.api.sendMessage(
    chatId,
    `${event.event_name}\n` +
      `Predictions lock: ${lockStr}\n\n` +
      `Tap below to make your pick (sent privately):`,
    { reply_markup: keyboard }
  );
}

// ─── Handle Deep Link Start ─────────────────────────────────────────────────

/**
 * Handle /start pick_EVENT_ID — show prediction options in DM.
 */
export async function handlePickStart(ctx: Context, eventId: string) {
  const supabase = getServiceClient();
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Look up linked Supabase user
  const { data: user } = await supabase
    .from("users")
    .select("id, display_name")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (!user) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";
    const keyboard = new InlineKeyboard().url(
      "Link Account",
      `${appUrl}/telegram`
    );
    await ctx.reply(
      "You need to link your Telegram account first. Tap below to sign in:",
      { reply_markup: keyboard }
    );
    return;
  }

  // Fetch event
  const { data: event } = await supabase
    .from("events")
    .select("id, event_name, lock_time, status, competition_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    await ctx.reply("Event not found.");
    return;
  }

  // Check if locked
  const now = new Date();
  const lockTime = new Date(event.lock_time);
  if (lockTime <= now || event.status !== "upcoming") {
    await ctx.reply("This event is locked. Predictions can no longer be changed.");
    return;
  }

  // Check if user is a member of the competition
  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", event.competition_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    await ctx.reply("You're not a member of this competition.");
    return;
  }

  // Check for existing prediction
  const { data: existing } = await supabase
    .from("predictions")
    .select("id, prediction_data")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .eq("prediction_type", "winner")
    .maybeSingle();

  // Parse teams from event name ("Team A vs Team B")
  const options = parseWinnerOptions(event.event_name);

  // Build inline keyboard with one button per option
  const keyboard = new InlineKeyboard();
  for (const option of options) {
    keyboard.text(option, `pick:${eventId}:${option}`).row();
  }

  const existingPick = existing
    ? String((existing.prediction_data as Record<string, unknown>)?.winner ?? "")
    : null;
  const currentPickText = existingPick
    ? `\n\nYour current pick: ${existingPick}`
    : "";

  await ctx.reply(
    `${event.event_name}${currentPickText}\n\nWho wins?`,
    { reply_markup: keyboard }
  );
}

// ─── Handle Pick Callback ───────────────────────────────────────────────────

/**
 * Handle callback query from prediction inline keyboard.
 * callback_data format: "pick:EVENT_UUID:OPTION"
 */
export async function handlePickCallback(
  ctx: Context,
  eventId: string,
  pick: string
) {
  const supabase = getServiceClient();
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Look up linked user
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (!user) {
    await ctx.answerCallbackQuery({ text: "Link your account first!", show_alert: true });
    return;
  }

  // Fetch event + check lock
  const { data: event } = await supabase
    .from("events")
    .select("id, event_name, lock_time, status, competition_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    await ctx.answerCallbackQuery({ text: "Event not found", show_alert: true });
    return;
  }

  const now = new Date();
  const lockTime = new Date(event.lock_time);
  if (lockTime <= now || event.status !== "upcoming") {
    await ctx.answerCallbackQuery({ text: "This event is locked!", show_alert: true });
    return;
  }

  // Check competition allows updates
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, allow_prediction_updates")
    .eq("id", event.competition_id)
    .maybeSingle();

  // Check for existing prediction
  const { data: existing } = await supabase
    .from("predictions")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .eq("prediction_type", "winner")
    .maybeSingle();

  if (existing && !competition?.allow_prediction_updates) {
    await ctx.answerCallbackQuery({
      text: "You've already picked and changes aren't allowed.",
      show_alert: true,
    });
    return;
  }

  const predictionData = { winner: pick };

  if (existing) {
    // Update
    await supabase
      .from("predictions")
      .update({
        prediction_data: predictionData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Insert
    await supabase.from("predictions").insert({
      event_id: eventId,
      user_id: user.id,
      competition_id: event.competition_id,
      prediction_type: "winner",
      prediction_data: predictionData,
    });
  }

  // Update the message to show confirmation
  await ctx.editMessageText(
    `${event.event_name}\n\nYour pick: ${pick}`,
    { reply_markup: undefined }
  );
  await ctx.answerCallbackQuery({ text: `Picked: ${pick}` });
}

// ─── Reveal Predictions ─────────────────────────────────────────────────────

/**
 * Reveal all predictions for an event to the group chat.
 * Called at lock time by the cron job.
 */
export async function revealPredictions(
  chatId: number | string,
  eventId: string
) {
  const supabase = getServiceClient();

  // Fetch event
  const { data: event } = await supabase
    .from("events")
    .select("id, event_name")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return;

  // Fetch all predictions for this event
  const { data: predictions } = await supabase
    .from("predictions")
    .select("user_id, prediction_data, prediction_type")
    .eq("event_id", eventId);

  if (!predictions || predictions.length === 0) {
    const bot = getBot();
    await bot.api.sendMessage(
      chatId,
      `${event.event_name}\n\nNo predictions were made!`
    );
    return;
  }

  // Fetch display names
  const userIds = [...new Set(predictions.map((p) => p.user_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map(
    (users ?? []).map((u) => [u.id, u.display_name])
  );

  // Build reveal message
  const lines = predictions.map((p) => {
    const name = nameMap.get(p.user_id) ?? "Unknown";
    const data = p.prediction_data as Record<string, unknown>;
    const pick = data?.winner ?? data?.selection ?? data?.value ?? "?";
    return `${name}: ${pick}`;
  });

  const bot = getBot();
  await bot.api.sendMessage(
    chatId,
    `Predictions locked for ${event.event_name}!\n\n${lines.join("\n")}`
  );
}

// ─── Post All Open Events ───────────────────────────────────────────────────

/**
 * Post all open (upcoming, unlocked) events for a competition to the group.
 */
export async function postOpenEvents(
  chatId: number | string,
  competitionId: string,
  botUsername: string
) {
  const supabase = getServiceClient();

  const now = new Date();
  const { data: events } = await supabase
    .from("events")
    .select("id, event_name, lock_time, sport, status")
    .eq("competition_id", competitionId)
    .eq("status", "upcoming")
    .gt("lock_time", now.toISOString())
    .order("lock_time", { ascending: true });

  if (!events || events.length === 0) {
    const bot = getBot();
    await bot.api.sendMessage(chatId, "No open events right now.");
    return;
  }

  for (const event of events) {
    await postEventToGroup(chatId, event, botUsername);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse winner options from an event name.
 * "Team A vs Team B" → ["Team A", "Draw", "Team B"]
 * Falls back to generic options if no "vs" found.
 */
function parseWinnerOptions(eventName: string): string[] {
  // Try "vs", "v", "VS", "-"
  const separators = [" vs ", " v ", " VS ", " V "];
  for (const sep of separators) {
    const idx = eventName.indexOf(sep);
    if (idx !== -1) {
      const teamA = eventName.substring(0, idx).trim();
      const teamB = eventName.substring(idx + sep.length).trim();
      return [teamA, "Draw", teamB];
    }
  }

  // No separator found — return the whole name as the event
  return [eventName, "Draw"];
}
