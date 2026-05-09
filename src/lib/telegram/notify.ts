import { InlineKeyboard } from "grammy";
import { getBot } from "./bot";

/**
 * Send a message to a Telegram chat (group or DM).
 * Used by the notification cron and admin actions.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: {
    keyboard?: InlineKeyboard;
    parseMode?: "HTML" | "MarkdownV2";
  }
) {
  const bot = getBot();
  return bot.api.sendMessage(chatId, text, {
    reply_markup: options?.keyboard,
    parse_mode: options?.parseMode,
  });
}

/**
 * Send a notification to a group about an upcoming deadline.
 */
export async function notifyDeadline(
  chatId: number | string,
  eventName: string,
  hoursLeft: number,
  appUrl: string
) {
  const timeText =
    hoursLeft < 1
      ? `${Math.round(hoursLeft * 60)} minutes`
      : hoursLeft === 1
        ? "1 hour"
        : `${Math.round(hoursLeft)} hours`;

  const keyboard = new InlineKeyboard().url(
    "Make Predictions",
    `${appUrl}/predictions`
  );

  await sendTelegramMessage(
    chatId,
    `Predictions for ${eventName} close in ${timeText}!`,
    { keyboard }
  );
}

/**
 * Send round results to a group.
 */
export async function notifyResults(
  chatId: number | string,
  roundName: string,
  topScorers: Array<{ name: string; points: number }>,
  appUrl: string
) {
  const leaderLines = topScorers
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.name} — ${s.points}pts`)
    .join("\n");

  const keyboard = new InlineKeyboard().url(
    "View Full Leaderboard",
    `${appUrl}/leaderboard`
  );

  await sendTelegramMessage(
    chatId,
    `Results are in for ${roundName}!\n\n${leaderLines}`,
    { keyboard }
  );
}
