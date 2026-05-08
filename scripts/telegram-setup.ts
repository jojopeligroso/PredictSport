/**
 * One-time setup script: registers the webhook URL with Telegram
 * and sets the bot's command menu.
 *
 * Usage:
 *   npx tsx scripts/telegram-setup.ts
 *
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local
 */

import "dotenv/config";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set in .env.local");
  process.exit(1);
}
if (!WEBHOOK_SECRET) {
  console.error("TELEGRAM_WEBHOOK_SECRET is not set in .env.local");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function apiCall(method: string, body?: Record<string, unknown>) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function main() {
  // 1. Delete any existing webhook first (clean slate)
  console.log("Removing existing webhook...");
  await apiCall("deleteWebhook");

  // 2. Set webhook with secret token
  const webhookUrl = `${APP_URL}/api/telegram/webhook`;
  console.log(`Setting webhook: ${webhookUrl}`);
  await apiCall("setWebhook", {
    url: webhookUrl,
    secret_token: WEBHOOK_SECRET,
    // Only receive message and callback_query updates — minimise attack surface
    allowed_updates: ["message", "callback_query"],
    // Drop pending updates from before this webhook was set
    drop_pending_updates: true,
  });

  // 3. Set bot commands (shown in Telegram's command menu)
  console.log("Setting bot commands...");
  await apiCall("setMyCommands", {
    commands: [
      { command: "predict", description: "Make your predictions" },
      { command: "standings", description: "View the leaderboard" },
      { command: "results", description: "Latest round results" },
      { command: "start", description: "Get started" },
    ],
  });

  // 4. Verify webhook info
  const info = await apiCall("getWebhookInfo");
  console.log("\nWebhook registered successfully:");
  console.log(`  URL: ${info.url}`);
  console.log(`  Has secret: ${info.has_custom_certificate ? "yes" : "no"}`);
  console.log(`  Pending updates: ${info.pending_update_count}`);
  console.log(`  Allowed updates: ${(info.allowed_updates ?? []).join(", ")}`);

  // 5. Get bot info
  const me = await apiCall("getMe");
  console.log(`\nBot: @${me.username} (${me.first_name})`);
  console.log("\nDone! Add the bot to your group chat and try /start");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
