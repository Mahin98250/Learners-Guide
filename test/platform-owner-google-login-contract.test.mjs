import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const login = fs.readFileSync("src/platform/PlatformOwnerLogin.tsx", "utf8");
const portal = fs.readFileSync("src/platform/PlatformOwnerPortal.tsx", "utf8");

test("owner login is restricted to the configured owner email", () => {
  assert.match(login, /const OWNER_EMAIL = "patelmahin140@gmail.com"/);
  assert.match(login, /sessionData\.session\.user\.email/);
  assert.match(login, /email !== OWNER_EMAIL/);
});

test("owner login uses Google OAuth only", () => {
  assert.match(login, /signInWithOAuth/);
  assert.match(login, /provider: "google"/);
  assert.match(login, /prompt: "select_account"/);
  assert.doesNotMatch(login, /signInWithPassword/);
});

test("owner login still requires database platform membership", () => {
  assert.match(login, /current_platform_roles/);
  assert.match(login, /next\.length/);
  assert.match(portal, /current_platform_roles/);
});

test("owner login redirects back to the owner route", () => {
  assert.match(login, /redirectTarget/);
  assert.match(login, /BASE_URL/);
  assert.match(login, /owner/);
});
