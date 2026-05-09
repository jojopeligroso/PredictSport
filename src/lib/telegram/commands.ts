import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";

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
  // Use webApp in private chats (opens inside Telegram), URL in groups (opens browser).
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

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Welcome to PredictSport! Make predictions, compete with friends, and track the leaderboard.\n\n" +
        "Commands:\n" +
        "/predict - Make your predictions\n" +
        "/standings - View the leaderboard\n" +
        "/results - Latest round results",
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
}
