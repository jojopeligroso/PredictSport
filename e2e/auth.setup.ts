import { test as setup, expect } from "@playwright/test";

const E2E_EMAIL = "e2e-test@predictsport.dev";

setup("authenticate", async ({ page }) => {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  // Use the dev login API to get a session — works for any existing user,
  // no password needed (service-role generates + verifies an OTP server-side)
  const res = await fetch(`${baseURL}/api/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: E2E_EMAIL }),
  });
  if (!res.ok) throw new Error(`Dev login failed: ${await res.text()}`);

  const session = await res.json();
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] ??
    "wujgqjjddonxoddkgbxy";

  // Navigate to app first (need domain for cookies)
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const cookieDomain = new URL(baseURL).hostname;
  const isSecure = new URL(baseURL).protocol === "https:";

  // Set the auth cookie in the format @supabase/ssr uses
  const sessionData = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: "bearer",
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  });

  // @supabase/ssr prefixes with "base64-" then base64url-encodes the JSON
  const encoded = "base64-" + Buffer.from(sessionData).toString("base64url");
  const chunkSize = 3500;
  const cookies = [];
  for (let i = 0; i < encoded.length; i += chunkSize) {
    cookies.push({
      name: `sb-${projectRef}-auth-token.${Math.floor(i / chunkSize)}`,
      value: encoded.slice(i, i + chunkSize),
      domain: cookieDomain,
      path: "/",
      httpOnly: false,
      secure: isSecure,
      sameSite: "Lax" as const,
    });
  }
  await page.context().addCookies(cookies);

  // Reload so the app picks up the session
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Verify auth: authenticated users should not be on /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
