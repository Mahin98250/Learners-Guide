import { test, expect } from "@playwright/test";

test("public shell renders and exposes role entry points", async ({ page }) => {
  const consoleErrors: string[] = [];
  const httpFailures: string[] = [];

  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 500) httpFailures.push(`${response.status()} ${response.url()}`);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Learner's Guide/i);

  // Match the role-entry labels by their distinctive leading text. A broad
  // /student/i locator also matches the Teacher card's "students" hint.
  await expect(page.getByRole("button", { name: /^🎓 Student View/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^👨‍🏫 Teacher Manage/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /parent/i })).toBeVisible();

  expect(httpFailures, `Unexpected HTTP 5xx responses:\n${httpFailures.join("\n")}`).toEqual([]);
  expect(consoleErrors, `Unexpected browser errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
