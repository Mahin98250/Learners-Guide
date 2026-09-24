import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const login = fs.readFileSync(
  "src/platform/PlatformOwnerLogin.tsx",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/20260922140000_lock_platform_owner_to_authorized_email.sql",
  "utf8",
);

test("owner panel exposes Google OAuth only", () => {
  assert.match(login, /signInWithOAuth/);
  assert.match(login, /provider:\s*"google"/);
  assert.match(login, /Continue with Google/);
  assert.doesNotMatch(login, /signInWithPassword/);
});

test("owner OAuth returns to the owner route using the configured app base", () => {
  assert.match(login, /import\.meta\.env\.BASE_URL/);
  assert.match(login, /owner/);
  assert.match(login, /prompt:\s*"select_account"/);
});

test("owner authorization stays server-side while the login screen does not expose the email", () => {
  assert.doesNotMatch(login, /patelmahin140@gmail\.com/);
  assert.doesNotMatch(login, /AUTHORIZED GOOGLE ACCOUNT/);
  assert.match(login, /current_platform_roles/);
  assert.match(login, /login_hint: normalizedEmail/);
  assert.match(
    migration,
    /lower\(coalesce\(auth\.jwt\(\)\s*->>\s*'email',\s*''\)\)\s*=\s*'patelmahin140@gmail\.com'/i,
  );
});

test("platform role lookup remains authenticated-only and SECURITY INVOKER", () => {
  assert.match(
    migration,
    /create or replace function public\.current_platform_roles\(\)[\s\S]*security invoker/i,
  );
  assert.match(
    migration,
    /revoke execute on function public\.current_platform_roles\(\) from public, anon/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.current_platform_roles\(\) to authenticated/i,
  );
});
