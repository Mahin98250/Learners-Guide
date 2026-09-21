import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260922130000_make_app_role_auth_source_of_truth.sql",
  "utf8",
);

test("app_role reads authorization role only from Supabase Auth metadata/JWT", () => {
  assert.match(migration, /raw_app_meta_data\s*->>\s*'role'/i);
  assert.match(migration, /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/i);
  assert.doesNotMatch(migration, /from\s+public\.users\s+pu/i);
});

test("app_role remains protected for the RLS policy graph", () => {
  assert.match(migration, /security\s+definer/i);
  assert.match(
    migration,
    /set\s+search_path\s*=\s*public,\s*pg_temp/i,
  );
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.app_role\(\)\s+from\s+public,\s*anon/i,
  );
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.app_role\(\)\s+to\s+authenticated/i,
  );
});
