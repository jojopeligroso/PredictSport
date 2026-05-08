import { webhookCallback } from "grammy";
import { NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";
import { registerCommands } from "@/lib/telegram/commands";
import { validateWebhookSecret } from "@/lib/telegram/validate";

/**
 * POST /api/telegram/webhook
 *
 * Receives updates from Telegram via webhook. Every message, command, or
 * callback in the group chat arrives here as an HTTPS POST.
 *
 * SECURITY LAYERS:
 * 1. Secret token validation — Telegram includes X-Telegram-Bot-Api-Secret-Token
 *    header, set during webhook registration. Rejects requests without a valid token.
 * 2. grammY parses and validates the Update object structure.
 * 3. Bot token never appears in responses or logs.
 */

let _initialized = false;

function ensureInitialized() {
  if (_initialized) return;
  const bot = getBot();
  registerCommands(bot);
  _initialized = true;
}

export async function POST(request: Request) {
  // --- Layer 1: Validate webhook secret ---
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration — fail closed, don't process anything
    console.error("TELEGRAM_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!validateWebhookSecret(headerSecret, secret)) {
    // Do not reveal why it failed — just 401
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Layer 2: Process update via grammY ---
  try {
    ensureInitialized();
    const bot = getBot();

    // grammY's webhookCallback returns a fetch-compatible handler
    const handler = webhookCallback(bot, "std/http");
    return await handler(request);
  } catch (err) {
    // Log server-side only — never leak internals to the caller
    console.error("Telegram webhook error:", err instanceof Error ? err.message : "Unknown error");
    // Return 200 to Telegram so it doesn't retry with the same bad update.
    // Telegram retries on non-2xx, which could cause infinite loops on bad data.
    return NextResponse.json({ ok: true });
  }
}

// Telegram only sends POST — reject everything else
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
