import { test, expect } from "@playwright/test";

test.describe("Admin page (authenticated)", () => {
  test("renders Match Day Desk heading and description", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: /match day desk/i })
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

  test("shows create competition button", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("button", { name: "Create Competition" })
    ).toBeVisible();
  });
});
