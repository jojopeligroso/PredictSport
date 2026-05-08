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

  // Debug: respond to ANY message so we can confirm the bot is processing
  bot.on("message", async (ctx, next) => {
    console.log(`INCOMING: chat=${ctx.chat.id} type=${ctx.chat.type} text=${ctx.message?.text}`);
    await next();
  });

  bot.command("start", async (ctx) => {
    // Simple text reply first — no inline keyboard — to isolate the issue
    await ctx.reply("PredictSport bot is alive! Commands: /predict /standings /results");
  });

  bot.command("predict", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp(
      "Make Predictions",
      `${appUrl}/telegram?startapp=predict`
    );

    await ctx.reply("Tap below to make your predictions:", {
      reply_markup: keyboard,
    });
  });

  bot.command("standings", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp(
      "View Full Leaderboard",
      `${appUrl}/telegram?startapp=standings`
    );

    await ctx.reply("Tap below to see the full leaderboard:", {
      reply_markup: keyboard,
    });
  });

  bot.command("results", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp(
      "View Results",
      `${appUrl}/telegram?startapp=results`
    );

    await ctx.reply("Tap below to see the latest results:", {
      reply_markup: keyboard,
    });
  });
}
