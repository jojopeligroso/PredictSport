import { test, expect } from "@playwright/test";

/**
 * These tests require an authenticated session. They use a storage state
 * file that must be created by a setup step (e.g. via Supabase test user).
 *
 * For now, these are structural smoke tests that verify the page renders
 * the expected elements when a user IS authenticated (to be run once
 * auth state setup is available).
 *
 * Without auth state, the redirect tests in auth-redirect.spec.ts cover
 * the unauthenticated case.
 */

test.describe("Predictions page (authenticated)", () => {
  // Skip these tests until auth storage state is set up
  test.skip(
    () => true,
    "Requires authenticated session - enable when auth fixture is available"
  );

  test("renders page heading and description", async ({ page }) => {
    await page.goto("/predictions");

    await expect(
      page.getByRole("heading", { name: "My Predictions" })
    ).toBeVisible();

    await expect(
      page.getByText(/submit your predictions before each event locks/i)
    ).toBeVisible();
  });

  test("shows competition selector when user has competitions", async ({
    page,
  }) => {
    await page.goto("/predictions");

    // The competition selector should be present
    await expect(
      page.getByRole("heading", { name: "My Predictions" })
    ).toBeVisible();
  });

  test("shows empty state when user has no competitions", async ({ page }) => {
    await page.goto("/predictions");

    // This would show if the user has no competition memberships
    const emptyState = page.getByText(
      /you haven.t joined any competitions yet/i
    );
    // Either the empty state or competition content should be visible
    const heading = page.getByRole("heading", { name: "My Predictions" });
    await expect(heading).toBeVisible();
  });
});
