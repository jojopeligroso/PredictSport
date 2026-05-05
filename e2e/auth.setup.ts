import { test as setup, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

const E2E_EMAIL = "e2e-test@predictsport.dev";
const E2E_PASSWORD = "devpassword123";

function loadEnv(): Record<string, string> {
  const content = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

setup("authenticate", async ({ page }) => {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] ?? "";

  // Sign in via REST
  const res = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseKey },
      body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
    }
  );
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);

  const session = await res.json();

  // Navigate to app first (need domain for cookies)
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Set the auth cookie in the format @supabase/ssr createBrowserClient uses.
  // The library stores the full session JSON as the cookie value, chunked.
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
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    });
  }
  await page.context().addCookies(cookies);

  await page.goto("/admin");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { name: "Admin Panel" })
  ).toBeVisible({ timeout: 15000 });

  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
