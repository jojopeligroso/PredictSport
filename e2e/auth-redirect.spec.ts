import { test, expect } from "@playwright/test";

test.describe("Authentication redirects", () => {
  test("unauthenticated user visiting /predictions is redirected to login", async ({
    page,
  }) => {
    await page.goto("/predictions");

    // The predictions page redirects to /auth/login for unauthenticated users
    await expect(page).toHaveURL(/\/auth\/login|\/login/);
  });

  test("unauthenticated user visiting /leaderboard is redirected to login", async ({
    page,
  }) => {
    await page.goto("/leaderboard");

    // The leaderboard page redirects to /auth/login for unauthenticated users
    await expect(page).toHaveURL(/\/auth\/login|\/login/);
  });

  test("unauthenticated user visiting /admin is redirected to login", async ({
    page,
  }) => {
    await page.goto("/admin");

    // The admin page redirects to /auth/login for unauthenticated users
    await expect(page).toHaveURL(/\/auth\/login|\/login/);
  });
});
