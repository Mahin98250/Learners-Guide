import { expect, test } from "@playwright/test";

test.describe("protected route smoke", () => {
  test("/app never exposes an unauthenticated portal", async ({ page }) => {
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /^🎓 Student View/i })).toBeVisible();
  });

  test("/admin presents the admin sign-in gate without an authenticated admin", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/admin/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /login|sign in/i }).first()).toBeVisible();
  });
});
