import { expect, type Page } from "@playwright/test";

export type E2ERole = "student" | "teacher" | "parent" | "admin";

const USERS = {
  student: process.env.E2E_STUDENT_EMAIL || "e2e.student.a@example.invalid",
  teacher: process.env.E2E_TEACHER_EMAIL || "e2e.teacher.a@example.invalid",
  parent: process.env.E2E_PARENT_EMAIL || "e2e.parent.multichild@example.invalid",
  admin: process.env.E2E_ADMIN_EMAIL || "e2e.admin@example.invalid",
} as const;

export function e2ePassword() {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) throw new Error("[E2E] E2E_TEST_PASSWORD is required for authenticated tests.");
  return password;
}

export async function loginAs(page: Page, role: E2ERole) {
  const password = e2ePassword();
  if (role === "admin") {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.getByLabel("ADMIN EMAIL").fill(USERS.admin);
    await page.getByLabel("PASSWORD").fill(password);
    await page.getByRole("button", { name: /sign in as administrator/i }).click();
    await expect(page.locator(".admin").first()).toBeVisible();
    return;
  }

  await page.goto(`/auth?role=${role}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Phone / Email").fill(USERS[role]);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /login/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(`[data-portal="${role}"]`)).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /logout/i }).last().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /student/i }).first()).toBeVisible();
}
