import { test, expect } from "@playwright/test";

// Auth redirect tests — authenticated user visiting / should redirect to /predictions
test.describe("Authenticated redirects", () => {
  test("authenticated user visiting / is redirected to /predictions", async ({
    page,
  }) => {
    await page.goto("/");

    // The landing page redirects authenticated users to /predictions
    await expect(page).toHaveURL(/\/predictions/);
  });
});

test.describe("Unauthenticated page access", () => {
  // Override to run without auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated user visiting / sees landing page", async ({
    page,
  }) => {
    await page.goto("/");

    // Should stay on / and show the landing page
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: /predict/i })
    ).toBeVisible();
  });
});
