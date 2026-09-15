import { test, expect } from "../helpers/observability";
import { loginAs } from "../helpers/auth";

test.describe("Student portal", () => {
  test("loads own dashboard and own homework without sibling leakage", async ({ page }) => {
    await loginAs(page, "student");
    await expect(page.locator("[data-portal=student]")).toContainText(/E2E Student A|Student/);
    await page.getByRole("button", { name: /^HW$/i }).first().click();
    await expect(page.getByText("E2E Student A homework")).toBeVisible();
    await expect(page.getByText("E2E Student B homework")).toHaveCount(0);
    await expect(page.getByText("E2E Student C homework")).toHaveCount(0);
  });
});

test.describe("Teacher portal", () => {
  test("loads assigned teaching data and does not expose another batch", async ({ page }) => {
    await loginAs(page, "teacher");
    await expect(page.locator("[data-portal=teacher]")).toBeVisible();
    await page.getByRole("button", { name: /^HW$/i }).first().click();
    await expect(page.getByText("E2E Student A homework")).toBeVisible();
    await expect(page.getByText("E2E Student B homework")).toHaveCount(0);
    await expect(page.getByText("E2E Student C homework")).toHaveCount(0);
  });
});

test.describe("Parent multi-child portal", () => {
  test("switches child context and isolates child-specific homework", async ({ page }) => {
    await loginAs(page, "parent");
    const child = page.getByLabel("Select child");
    await expect(child).toBeVisible();
    await expect(child.locator("option")).toHaveCount(2);

    await page.getByRole("button", { name: /^Homework$/i }).click();
    await expect(page.getByText("E2E Student A homework")).toBeVisible();
    await expect(page.getByText("E2E Student B homework")).toHaveCount(0);
    await expect(page.getByText("E2E Student C homework")).toHaveCount(0);

    await child.selectOption("e2e-student-b");
    await expect(page.getByText("E2E Student B")).toBeVisible();
    await expect(page.getByText("E2E Student B homework")).toBeVisible();
    await expect(page.getByText("E2E Student A homework")).toHaveCount(0);
    await expect(page.getByText("E2E Student C homework")).toHaveCount(0);
  });
});

test.describe("Admin portal", () => {
  test("loads the administrative shell and exposes the implemented management areas", async ({ page }, testInfo) => {
    await loginAs(page, "admin");
    if (testInfo.project.name === "mobile-chromium") {
      for (const label of ["Dashboard", "Students", "Teachers", "Batches & Timetable", "Teacher Assignments"]) {
        await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
      }
      return;
    }
    const labels = [
      "Dashboard", "Students", "Teachers", "Batches & Timetable", "Teacher Assignments", "Tests & Results",
      "Search Profiles", "Homework", "Study Materials", "Announcements", "User Accounts",
    ];
    for (const label of labels) await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
  });
});
