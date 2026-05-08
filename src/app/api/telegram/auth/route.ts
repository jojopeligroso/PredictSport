import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateInitData } from "@/lib/telegram/validate";

/**
 * POST /api/telegram/auth
 *
 * Validates Telegram Mini App initData and links the Telegram user
 * to an existing Supabase account, or returns the linked user if
 * already connected.
 *
 * Two flows:
 * 1. initData only → look up by telegram_id, return user if found
 * 2. initData + supabase_token → link telegram_id to authenticated Supabase user
 *
 * SECURITY:
 * - initData is validated via HMAC-SHA256 using the bot token
 * - 5-minute replay window prevents token reuse
 * - Uses service role client for writes (bypasses RLS)
 * - Bot token never leaves the server
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service config missing");
  return createClient(url, key);
}

interface AuthRequestBody {
  init_data: string;
  supabase_token?: string;
}

export async function POST(request: Request) {
  let body: AuthRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.init_data) {
    return NextResponse.json({ error: "init_data is required" }, { status: 400 });
  }

  // Validate initData signature and expiry
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const validated = validateInitData(body.init_data, botToken);
  if (!validated) {
    return NextResponse.json({ error: "Invalid or expired init_data" }, { status: 401 });
  }

  // Parse the Telegram user from validated data
  const userJson = validated.user;
  if (!userJson) {
    return NextResponse.json({ error: "No user in init_data" }, { status: 400 });
  }

  let telegramUser: { id: number; first_name: string; last_name?: string; username?: string };
  try {
    telegramUser = JSON.parse(userJson);
  } catch {
    return NextResponse.json({ error: "Invalid user data" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Flow 1: Look up existing linked user
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, email, display_name, avatar_url, telegram_id, telegram_username")
    .eq("telegram_id", telegramUser.id)
    .maybeSingle();

  if (existingUser) {
    // Update telegram_username if it changed
    if (telegramUser.username && telegramUser.username !== existingUser.telegram_username) {
      await supabase
        .from("users")
        .update({ telegram_username: telegramUser.username })
        .eq("id", existingUser.id);
    }

    return NextResponse.json({
      linked: true,
      user: {
        id: existingUser.id,
        display_name: existingUser.display_name,
        telegram_id: existingUser.telegram_id,
      },
    });
  }

  // Flow 2: Link Telegram to Supabase account using a valid session token
  if (body.supabase_token) {
    // Create a per-request client with the user's token to verify identity
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${body.supabase_token}` } } }
    );

    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: "Invalid Supabase token" }, { status: 401 });
    }

    // Check this telegram_id isn't already linked to a different account
    const { data: conflict } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramUser.id)
      .neq("id", authUser.id)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json(
        { error: "This Telegram account is already linked to another user" },
        { status: 409 }
      );
    }

    // Link the accounts
    const { error: updateError } = await supabase
      .from("users")
      .update({
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username ?? null,
      })
      .eq("id", authUser.id);

    if (updateError) {
      console.error(`Failed to link Telegram: ${updateError.message}`);
      return NextResponse.json({ error: "Failed to link account" }, { status: 500 });
    }

    return NextResponse.json({
      linked: true,
      user: {
        id: authUser.id,
        telegram_id: telegramUser.id,
      },
    });
  }

  // No existing link and no supabase_token — user needs to log in first
  return NextResponse.json({
    linked: false,
    telegram_user: {
      id: telegramUser.id,
      first_name: telegramUser.first_name,
      username: telegramUser.username,
    },
  });
}
