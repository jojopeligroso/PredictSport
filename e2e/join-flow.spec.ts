import { test, expect } from "@playwright/test";

test.describe("Join page — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("visiting /join without a token redirects to home", async ({
    page,
  }) => {
    await page.goto("/join");

    // Server-side redirect to /
    await expect(page).toHaveURL("/");
  });

  test("visiting /join?token=nonexistent shows sign-in prompt", async ({
    page,
  }) => {
    await page.goto("/join?token=nonexistent-token-12345");

    // Unauthenticated users see the login card
    await expect(
      page.getByText(/you've been invited to a competition/i)
    ).toBeVisible();

    // Google login option
    await expect(
      page.getByRole("button", { name: /continue with google/i })
    ).toBeVisible();

    // Magic link option
    await expect(
      page.getByRole("button", { name: /send magic link/i })
    ).toBeVisible();
  });

  test("join page shows PredictSport branding", async ({ page }) => {
    await page.goto("/join?token=nonexistent-token-12345");

    await expect(page.getByRole("main").getByText("PredictSport")).toBeVisible();
    await expect(page.getByText("Sign in to join", { exact: true })).toBeVisible();
  });
});

test.describe("Join page — authenticated", () => {
  // Uses default auth state from setup

  test("visiting /join?token=nonexistent shows invalid invite error", async ({
    page,
  }) => {
    await page.goto("/join?token=nonexistent-token-12345");

    await expect(
      page.getByText(/invalid or has been revoked/i)
    ).toBeVisible();
  });
});
