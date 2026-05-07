import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * E2E tests for the Wexford FC Prediction Quiz 2026 seeded data.
 * Tests authenticate as seeded quiz participants directly.
 */

function loadEnv(): Record<string, string> {
  const content = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

async function loginAs(page: Page, email: string, password: string) {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] ?? "";

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabaseKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Auth failed for ${email}: ${await res.text()}`);

  const session = await res.json();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const sessionData = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: "bearer",
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  });

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
}

test.describe("Wexford FC Quiz 2026", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "jay@wexfordfc-quiz.test", "testpassword123");
  });

  test("predictions page loads with events visible", async ({ page }) => {
    await page.goto("/predictions");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "My Predictions" })
    ).toBeVisible({ timeout: 10000 });

    // Jay is auto-selected into the quiz (only competition)
    // Events should be visible immediately
    await expect(
      page.getByText("Will Ireland have 18 winners or more", { exact: false })
    ).toBeVisible({ timeout: 10000 });
  });

  test("predictions page shows multiple quiz events", async ({ page }) => {
    await page.goto("/predictions");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("Winner of Rugby Six Nations", { exact: false })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText("US Masters Winner", { exact: false })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText("World Snooker Championship", { exact: false })
    ).toBeVisible({ timeout: 5000 });
  });

  test("Jay's existing predictions are visible", async ({ page }) => {
    await page.goto("/predictions");
    await page.waitForLoadState("networkidle");

    // Jay's prediction for Q2 (Six Nations) was "France"
    await expect(
      page.getByText("France", { exact: false }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("leaderboard page shows participants", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Leaderboard" })
    ).toBeVisible({ timeout: 10000 });

    // Jay should appear in the leaderboard
    await expect(page.getByText("Jay", { exact: false }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("can navigate between pages while logged in", async ({ page }) => {
    await page.goto("/predictions");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "My Predictions" })
    ).toBeVisible({ timeout: 10000 });

    // Navigate to leaderboard
    await page.getByRole("link", { name: /leaderboard/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Leaderboard" })
    ).toBeVisible({ timeout: 10000 });

    // Navigate back to predictions
    await page.getByRole("link", { name: /predictions/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "My Predictions" })
    ).toBeVisible({ timeout: 10000 });
  });
});
