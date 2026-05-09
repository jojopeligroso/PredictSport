import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { handlePickStart, handlePickCallback, postOpenEvents } from "./predictions";

/**
 * Register all bot command handlers.
 *
 * Each handler is stateless — it reads from Supabase and replies.
 * No conversation state is stored in memory.
 */
export function registerCommands(bot: Bot): void {
  // Catch errors within grammY's handler pipeline — single-line log for Vercel
  bot.catch((err) => {
    console.error(`BOT_ERROR: ${err.message} | update: ${JSON.stringify(err.ctx?.update)}`);
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://predictsport-rust.vercel.app";

  // Web App buttons only work in DMs, not group chats.
  function appButton(ctx: Context, label: string, path: string): InlineKeyboard {
    const isPrivate = ctx.chat?.type === "private";
    const kb = new InlineKeyboard();
    if (isPrivate) {
      kb.webApp(label, `${appUrl}${path}`);
    } else {
      kb.url(label, `${appUrl}${path}`);
    }
    return kb;
  }

  // ── Prediction callbacks (must be registered before commands) ──────────

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("pick:")) {
      const parts = data.split(":");
      // Format: pick:EVENT_UUID:OPTION (option may contain colons, so rejoin)
      const eventId = parts[1];
      const pick = parts.slice(2).join(":");
      if (eventId && pick) {
        await handlePickCallback(ctx, eventId, pick);
        return;
      }
    }

    await ctx.answerCallbackQuery();
  });

  // ── Commands ───────────────────────────────────────────────────────────

  bot.command("start", async (ctx) => {
    const payload = ctx.match;

    // Deep link: /start pick_EVENT_UUID
    if (typeof payload === "string" && payload.startsWith("pick_")) {
      const eventId = payload.substring(5);
      await handlePickStart(ctx, eventId);
      return;
    }

    await ctx.reply(
      "Welcome to PredictSport! Make predictions, compete with friends, and track the leaderboard.\n\n" +
        "Commands:\n" +
        "/predict - Make your predictions\n" +
        "/standings - View the leaderboard\n" +
        "/results - Latest round results\n" +
        "/post - Post open events to the group (admin)",
      { reply_markup: appButton(ctx, "Open PredictSport", "/telegram") }
    );
  });

  bot.command("predict", async (ctx) => {
    await ctx.reply("Tap below to make your predictions:", {
      reply_markup: appButton(ctx, "Make Predictions", "/predictions"),
    });
  });

  bot.command("standings", async (ctx) => {
    await ctx.reply("Tap below to see the full leaderboard:", {
      reply_markup: appButton(ctx, "View Full Leaderboard", "/leaderboard"),
    });
  });

  bot.command("results", async (ctx) => {
    await ctx.reply("Tap below to see the latest results:", {
      reply_markup: appButton(ctx, "View Results", "/predictions"),
    });
  });

  // ── Admin: post open events to the group ──────────────────────────────

  bot.command("post", async (ctx) => {
    // Only works in group chats
    if (ctx.chat?.type === "private") {
      await ctx.reply("Use this command in the group chat.");
      return;
    }

    // Get the competition ID from the argument, or find the active one
    const competitionId = typeof ctx.match === "string" ? ctx.match.trim() : "";

    if (!competitionId) {
      // Find the first active competition
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: comp } = await supabase
        .from("competitions")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!comp) {
        await ctx.reply("No active competitions found.");
        return;
      }

      await postOpenEvents(ctx.chat.id, comp.id, bot.botInfo.username);
    } else {
      await postOpenEvents(ctx.chat.id, competitionId, bot.botInfo.username);
    }
  });
}
