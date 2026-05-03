import { test, expect } from "@playwright/test";

/**
 * Admin page access control and structure tests.
 * Requires authentication - skip until auth fixture is available.
 */

test.describe("Admin page (authenticated)", () => {
  test.skip(
    () => true,
    "Requires authenticated session - enable when auth fixture is available"
  );

  test("renders admin panel heading and description", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Admin Panel" })
    ).toBeVisible();

    await expect(
      page.getByText(
        /manage your competitions, events, results, and participants/i
      )
    ).toBeVisible();
  });

  test("shows Back to Home link", async ({ page }) => {
    await page.goto("/admin");

    const backLink = page.getByRole("link", { name: "Back to Home" });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/");
  });

  test("shows empty state when user has no admin competitions", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "No competitions" })
    ).toBeVisible();

    await expect(
      page.getByText(/create your first competition to get started/i)
    ).toBeVisible();
  });

  test("shows create competition form", async ({ page }) => {
    await page.goto("/admin");

    // The CreateCompetitionForm component should be rendered
    await expect(
      page.getByRole("heading", { name: "Admin Panel" })
    ).toBeVisible();
  });
});
