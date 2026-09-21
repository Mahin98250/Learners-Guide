import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260922110000_reduce_unnecessary_security_definer_helpers.sql",
  ),
  "utf8",
);

test("safe identity/owner helpers are SECURITY INVOKER", () => {
  for (const name of [
    "current_person_id",
    "current_platform_roles",
    "lg_is_admin",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `alter\\s+function\\s+public\\.${name.replaceAll("_", "\\_")}\\(\\)\\s+security\\s+invoker`,
        "i",
      ),
    );
  }
});

test("unused current institute helper is not client-callable", () => {
  assert.match(
    migration,
    /revoke execute on function public\.current_institute_ids\(\)\s+from public, anon, authenticated/i,
  );
});

test("RLS-critical privilege bridges are intentionally left untouched", () => {
  assert.match(migration, /app_role\(\)/i);
  assert.match(migration, /current_ref\(\)/i);
  assert.match(migration, /is_platform_member\(\)/i);
  assert.match(migration, /user_is_institute_member\(\)/i);
});
