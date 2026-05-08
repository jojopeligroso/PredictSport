import { Bot, InlineKeyboard } from "grammy";

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

  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard().url(
      "Open PredictSport",
      appUrl
    );

    await ctx.reply(
      "Welcome to PredictSport! Make predictions, compete with friends, and track the leaderboard.\n\n" +
        "Commands:\n" +
        "/predict - Make your predictions\n" +
        "/standings - View the leaderboard\n" +
        "/results - Latest round results",
      { reply_markup: keyboard }
    );
  });

  bot.command("predict", async (ctx) => {
    const keyboard = new InlineKeyboard().url(
      "Make Predictions",
      `${appUrl}/predictions`
    );

    await ctx.reply("Tap below to make your predictions:", {
      reply_markup: keyboard,
    });
  });

  bot.command("standings", async (ctx) => {
    const keyboard = new InlineKeyboard().url(
      "View Full Leaderboard",
      `${appUrl}/leaderboard`
    );

    await ctx.reply("Tap below to see the full leaderboard:", {
      reply_markup: keyboard,
    });
  });

  bot.command("results", async (ctx) => {
    const keyboard = new InlineKeyboard().url(
      "View Results",
      `${appUrl}/predictions`
    );

    await ctx.reply("Tap below to see the latest results:", {
      reply_markup: keyboard,
    });
  });
}
