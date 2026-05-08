import { Bot } from "grammy";

/**
 * Singleton bot instance.
 *
 * SECURITY: The bot token is a bearer credential — it grants full control of the
 * bot account. It must NEVER appear in client bundles, logs, or error responses.
 * This module is server-only (imported only by API routes).
 */

function createBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not set. Create a bot via @BotFather and add the token to .env.local"
    );
  }
  return new Bot(token);
}

// Lazy singleton — created on first import, reused across invocations in the
// same serverless container (Vercel keeps warm containers for ~5-15 min).
let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) {
    _bot = createBot();
  }
  return _bot;
}
