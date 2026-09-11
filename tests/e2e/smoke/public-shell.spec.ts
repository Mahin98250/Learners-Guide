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

  await expect(page.getByRole("button", { name: /student/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /teacher/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /parent/i })).toBeVisible();

  expect(httpFailures, `Unexpected HTTP 5xx responses:\n${httpFailures.join("\n")}`).toEqual([]);
  expect(consoleErrors, `Unexpected browser errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
