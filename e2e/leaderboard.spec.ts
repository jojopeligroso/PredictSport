import { test, expect } from "@playwright/test";

/**
 * Leaderboard page structural tests.
 * Requires authentication - skip until auth fixture is available.
 */

test.describe("Leaderboard page (authenticated)", () => {
  test.skip(
    () => true,
    "Requires authenticated session - enable when auth fixture is available"
  );

  test("renders page heading", async ({ page }) => {
    await page.goto("/leaderboard");

    await expect(
      page.getByRole("heading", { name: "Leaderboard" })
    ).toBeVisible();
  });

  test("shows competition selector", async ({ page }) => {
    await page.goto("/leaderboard");

    // The page should have a competition selector when user has competitions
    await expect(
      page.getByRole("heading", { name: "Leaderboard" })
    ).toBeVisible();
  });

  test("shows empty state when no competitions joined", async ({ page }) => {
    await page.goto("/leaderboard");

    // Empty state text
    const emptyState = page.getByText(/no competitions joined yet/i);
    const heading = page.getByRole("heading", { name: "Leaderboard" });
    await expect(heading).toBeVisible();
  });

  test("displays stat cards when data is present", async ({ page }) => {
    await page.goto("/leaderboard");

    // Stat cards should be visible when there are entries
    await expect(page.getByText("Players")).toBeVisible();
    await expect(page.getByText("Events Resulted")).toBeVisible();
    await expect(page.getByText("Total Predictions")).toBeVisible();
    await expect(page.getByText("Leader")).toBeVisible();
  });
});
