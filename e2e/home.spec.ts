import { test, expect } from "@playwright/test";

// These tests run as unauthenticated — override the default auth state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Home page (unauthenticated)", () => {
  test("renders the landing page with heading and tagline", async ({ page }) => {
    await page.goto("/");

    // Main heading — "Predict" + "Sport" split across two spans
    await expect(
      page.getByRole("heading", { name: /predict/i })
    ).toBeVisible();

    // Tagline
    await expect(
      page.getByText(/sports prediction quiz for your group/i)
    ).toBeVisible();
  });

  test("landing page CTA links to /login", async ({ page }) => {
    await page.goto("/");

    const getStartedLink = page.getByRole("link", { name: "Get started" });
    await expect(getStartedLink).toBeVisible();
    await expect(getStartedLink).toHaveAttribute("href", "/login");
  });

  test("navbar shows Log in link when unauthenticated", async ({ page }) => {
    await page.goto("/");

    const loginLink = page.getByRole("link", { name: "Log in" });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });

  test("navbar contains desktop navigation links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "Predictions" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Table" }).first()
    ).toBeVisible();

    // Admin link only visible to admin users
    await expect(
      page.getByRole("link", { name: "Admin" })
    ).not.toBeVisible();
  });
});
