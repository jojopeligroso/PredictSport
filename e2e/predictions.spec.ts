import { test, expect } from "@playwright/test";

/**
 * Predictions page structural tests.
 * Uses authenticated session from auth.setup.ts.
 */

test.describe("Predictions page (authenticated)", () => {
  test("renders predictions page with round heading", async ({ page }) => {
    await page.goto("/predictions");

    // When user has competitions, the page shows the round heading
    // When no competitions, it shows "My Predictions"
    const roundHeading = page.getByRole("heading", { name: /round/i });
    const fallbackHeading = page.getByRole("heading", {
      name: /my predictions/i,
    });
    await expect(roundHeading.or(fallbackHeading)).toBeVisible();
  });

  test("shows competition selector tabs", async ({ page }) => {
    await page.goto("/predictions");

    // Competition selector should be visible
    await expect(page.getByRole("tablist")).toBeVisible();
  });
});
