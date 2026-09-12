import { expect, test as base } from "@playwright/test";

const BENIGN_STATUS_REQUESTS = [
  /\/favicon\.ico(?:\?|$)/i,
  /\/\.well-known\/[^/]+$/i,
];

function isBenignResponse(response: import("@playwright/test").Response) {
  const url = response.url();
  return BENIGN_STATUS_REQUESTS.some((pattern) => pattern.test(url));
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    const httpFailures: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    page.on("pageerror", (error) => pageErrors.push(error.message));

    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "unknown network failure";
      requestFailures.push(`${request.method()} ${request.url()} — ${failure}`);
    });

    page.on("response", (response) => {
      const status = response.status();
      if (status < 400 || isBenignResponse(response)) return;

      // 401/403 usually indicate an authentication/authorization defect in an
      // authenticated flow; 429/5xx are reliability failures. Other 4xx responses
      // are recorded for diagnostics but are not automatically fatal because an
      // application may intentionally use 404/409/422 responses in normal flows.
      if (status === 401 || status === 403 || status === 429 || status >= 500) {
        httpFailures.push(`${status} ${response.request().method()} ${response.url()}`);
      }
    });

    await use(page);

    expect(
      requestFailures,
      `Unexpected failed network requests in ${testInfo.title}:\n${requestFailures.join("\n")}`,
    ).toEqual([]);

    expect(
      httpFailures,
      `Unexpected critical HTTP failures in ${testInfo.title}:\n${httpFailures.join("\n")}`,
    ).toEqual([]);

    expect(
      pageErrors,
      `Unhandled browser exceptions in ${testInfo.title}:\n${pageErrors.join("\n")}`,
    ).toEqual([]);

    expect(
      consoleErrors,
      `Unexpected console errors in ${testInfo.title}:\n${consoleErrors.join("\n")}`,
    ).toEqual([]);
  },
});

export { expect };
