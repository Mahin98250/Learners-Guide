import { expect, test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    const http5xx: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "unknown network failure";
      requestFailures.push(`${request.method()} ${request.url()} — ${failure}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 500) http5xx.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    });

    await use(page);

    expect(requestFailures, `Unexpected failed network requests in ${testInfo.title}:\n${requestFailures.join("\n")}`).toEqual([]);
    expect(http5xx, `Unexpected HTTP 5xx responses in ${testInfo.title}:\n${http5xx.join("\n")}`).toEqual([]);
    expect(pageErrors, `Unhandled browser exceptions in ${testInfo.title}:\n${pageErrors.join("\n")}`).toEqual([]);
    expect(consoleErrors, `Unexpected console errors in ${testInfo.title}:\n${consoleErrors.join("\n")}`).toEqual([]);
  },
});

export { expect };
