import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Dev-only login route. Generates a magic link OTP via the service-role key
 * and verifies it in one step, returning a session for any existing user.
 *
 * Security model:
 * - Runtime NODE_ENV guard: returns 404 in production
 * - Service-role key never leaves the server (Next.js API route)
 * - Error messages are generic to avoid leaking Supabase internals
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? (body as Record<string, unknown>).email
      : undefined;

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check user exists BEFORE generateLink — generateLink silently creates
  // new users with FK-constrained trigger records that can't be rolled back.
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!existingUser) {
    return NextResponse.json(
      { error: "No user found with that email" },
      { status: 404 }
    );
  }

  // Generate a magic link OTP via admin API
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData.properties?.email_otp) {
    console.error("[dev/login] generateLink failed:", linkError?.message);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 400 }
    );
  }

  // Immediately verify the OTP to get a session
  const { data: session, error: verifyError } =
    await supabase.auth.verifyOtp({
      type: "email",
      email,
      token: linkData.properties.email_otp,
    });

  if (verifyError || !session.session) {
    console.error("[dev/login] verifyOtp failed:", verifyError?.message);
    return NextResponse.json(
      { error: "Login failed — OTP verification error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    expires_in: session.session.expires_in,
    expires_at: session.session.expires_at,
    user: session.session.user,
  });
}
