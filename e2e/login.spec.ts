import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders the login page with branding and OAuth button", async ({
    page,
  }) => {
    await page.goto("/login");

    // Main heading
    await expect(
      page.getByRole("heading", { name: "PREDICT" })
    ).toBeVisible();

    // Subheading text
    await expect(
      page.getByText("Sign in to make your predictions")
    ).toBeVisible();

    // Google OAuth button
    const googleButton = page.getByRole("button", {
      name: /continue with google/i,
    });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();

    // Disclaimer text
    await expect(
      page.getByText(/no betting or wagering involved/i)
    ).toBeVisible();
  });

  test("displays error message when error param is present", async ({
    page,
  }) => {
    await page.goto("/login?error=auth");

    await expect(
      page.getByText("Authentication failed. Please try again.")
    ).toBeVisible();
  });

  test("displays custom message when message param is present", async ({
    page,
  }) => {
    await page.goto("/login?message=You+have+been+logged+out");

    await expect(
      page.getByText("You have been logged out")
    ).toBeVisible();
  });
});
