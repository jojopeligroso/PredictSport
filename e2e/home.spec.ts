import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders the landing page with navigation links", async ({ page }) => {
    await page.goto("/");

    // Main heading
    await expect(
      page.getByRole("heading", { name: "PREDICT" })
    ).toBeVisible();

    // Tagline
    await expect(
      page.getByText(
        /sports prediction quiz for your group/i
      )
    ).toBeVisible();

    // CTA links
    const predictionsLink = page.getByRole("link", {
      name: "My Predictions",
    });
    await expect(predictionsLink).toBeVisible();
    await expect(predictionsLink).toHaveAttribute("href", "/predictions");

    const leaderboardLink = page.getByRole("link", {
      name: "Leaderboard",
    });
    await expect(leaderboardLink).toBeVisible();
    await expect(leaderboardLink).toHaveAttribute("href", "/leaderboard");
  });

  test("navbar shows Log in link when unauthenticated", async ({ page }) => {
    await page.goto("/");

    const loginLink = page.getByRole("link", { name: "Log in" });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });

  test("navbar contains desktop navigation links", async ({ page }) => {
    // Use a wide viewport to see desktop nav
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "My Predictions" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Leaderboard" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Admin" })
    ).toBeVisible();
  });
});
