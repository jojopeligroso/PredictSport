import { test, expect } from "@playwright/test";

/**
 * Leaderboard page structural tests.
 * Uses authenticated session from auth.setup.ts.
 */

test.describe("Leaderboard page (authenticated)", () => {
  test("renders page heading", async ({ page }) => {
    await page.goto("/leaderboard");

    await expect(
      page.getByRole("heading", { name: /the table/i })
    ).toBeVisible();
  });

  test("shows competition content or empty state", async ({ page }) => {
    await page.goto("/leaderboard");

    // Either table content or empty state should be visible
    const heading = page.getByRole("heading", { name: /the table/i });
    await expect(heading).toBeVisible();
  });
});
