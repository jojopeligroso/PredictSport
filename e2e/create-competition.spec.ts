import { test, expect } from "@playwright/test";

test.describe("Competition creation", () => {
  test("creates a competition and it appears in the admin list", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Admin Panel" })
    ).toBeVisible();

    // Open the create form
    await page.getByRole("button", { name: "Create Competition" }).click();
    await expect(
      page.getByRole("heading", { name: "New Competition" })
    ).toBeVisible();

    // Fill in competition details
    const uniqueName = `E2E Test Competition ${Date.now()}`;
    await page.getByLabel("Name *").fill(uniqueName);
    await page.getByLabel("Description").fill("Created by Playwright E2E test");

    // Set type to Open
    await page.getByLabel("Type *").selectOption("open");

    // Set visibility to Private
    await page.getByLabel("Visibility").selectOption("private");

    // Select scoring preset (Classic Quiz is default)
    // Leave as default

    // Set min rounds required
    await page.getByLabel("Min. Rounds Required").fill("4");

    // Verify allow prediction updates checkbox is checked by default
    const updatesCheckbox = page.getByLabel(
      "Allow prediction updates before lock"
    );
    await expect(updatesCheckbox).toBeChecked();

    // Submit the form and wait for API response
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/admin/competitions") && resp.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Create Competition" }).click();
    const response = await responsePromise;
    const body = await response.json();

    // If there's an error, fail with details
    if (!response.ok()) {
      throw new Error(`Competition creation failed: ${JSON.stringify(body)}`);
    }

    // Should navigate to the competition detail page
    await expect(page).toHaveURL(/\/admin\/competitions\/[a-f0-9-]+/, {
      timeout: 10000,
    });

    // Navigate back to admin to verify it's in the list
    await page.goto("/admin");
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test("creates a competition with prediction updates disabled", async ({
    page,
  }) => {
    await page.goto("/admin");

    await page.getByRole("button", { name: "Create Competition" }).click();

    const uniqueName = `E2E No Updates ${Date.now()}`;
    await page.getByLabel("Name *").fill(uniqueName);
    await page.getByLabel("Type *").selectOption("fixed");

    // Uncheck prediction updates
    await page.getByLabel("Allow prediction updates before lock").uncheck();

    const responsePromise2 = page.waitForResponse(
      (resp) => resp.url().includes("/api/admin/competitions") && resp.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Create Competition" }).click();
    const response2 = await responsePromise2;
    const body2 = await response2.json();

    if (!response2.ok()) {
      throw new Error(`Competition creation failed: ${JSON.stringify(body2)}`);
    }

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/admin\/competitions\/[a-f0-9-]+/, {
      timeout: 10000,
    });
  });
});
