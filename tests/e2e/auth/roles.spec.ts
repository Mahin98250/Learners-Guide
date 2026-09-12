import { test, expect } from "../helpers/observability";
import { e2ePassword, loginAs, logout } from "../helpers/auth";

test.describe("authenticated role journeys", () => {
  for (const role of ["student", "teacher", "parent"] as const) {
    test(`${role} can authenticate, persist a session across refresh, and logout`, async ({ page }) => {
      await loginAs(page, role);
      await expect(page.locator(`[data-portal="${role}"]`)).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-portal="${role}"]`)).toBeVisible();
      await logout(page);
    });
  }

  test("admin can authenticate, reach the admin shell, and logout", async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: "viewport", description: testInfo.project.name });
    test.skip(testInfo.project.name === "mobile-chromium", "Admin sidebar/logout are desktop-only; mobile admin navigation is covered by the portal smoke suite.");
    await loginAs(page, "admin");
    await expect(page.getByText("● ADMIN PANEL")).toBeVisible();
    await logout(page);
  });

  for (const role of ["student", "teacher", "parent"] as const) {
    test(`${role} rejects an invalid password`, async ({ page }) => {
      await page.goto(`/auth?role=${role}`);
      const email = role === "student" ? "e2e.student.a@example.invalid" : role === "teacher" ? "e2e.teacher.a@example.invalid" : "e2e.parent.multichild@example.invalid";
      await page.getByLabel("Phone / Email").fill(email);
      await page.getByLabel("Password").fill(`${e2ePassword()}-wrong`);
      await page.getByRole("button", { name: /login/i }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page).toHaveURL(/\/auth\?role=/);
    });
  }

  test("admin rejects an invalid password", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.getByLabel("ADMIN EMAIL").fill("e2e.admin@example.invalid");
    await page.getByLabel("PASSWORD").fill(`${e2ePassword()}-wrong`);
    await page.getByRole("button", { name: /sign in as administrator/i }).click();
    await expect(page.getByText(/administrator access was not granted|invalid admin login|invalid login/i)).toBeVisible();
  });
});
