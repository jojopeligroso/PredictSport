import { test, expect } from "@playwright/test";

// Login page tests run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login page", () => {
  test("renders the login page with branding and auth options", async ({
    page,
  }) => {
    await page.goto("/login");

    // Brand name (scoped to main to avoid matching the nav too)
    await expect(page.getByRole("main").getByText("PredictSport")).toBeVisible();

    // Subheading
    await expect(
      page.getByText("Predict. Compete. Have the craic.")
    ).toBeVisible();

    // Google OAuth button
    const googleButton = page.getByRole("button", {
      name: /continue with google/i,
    });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();

    // Magic link email input
    await expect(page.getByPlaceholder("Email address")).toBeVisible();

    // Magic link send button
    const magicLinkButton = page.getByRole("button", {
      name: /send magic link/i,
    });
    await expect(magicLinkButton).toBeVisible();
    await expect(magicLinkButton).toBeEnabled();
  });

  test("displays error message when error param is present", async ({
    page,
  }) => {
    await page.goto("/login?error=auth");

    await expect(
      page.getByText("Authentication failed. Please try again.")
    ).toBeVisible();
  });

  test("displays custom message when message param is present", async ({
    page,
  }) => {
    await page.goto("/login?message=You+have+been+logged+out");

    await expect(page.getByText("You have been logged out")).toBeVisible();
  });
});
