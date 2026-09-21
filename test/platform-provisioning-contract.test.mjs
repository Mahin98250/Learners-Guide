import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "supabase/migrations/20260921170000_platform_provisioning_primitives.sql",
  "utf8",
).toLowerCase();

test("platform provisioning is protected by platform membership", () => {
  assert.match(source, /public\.is_platform_member\(\)/);
  assert.match(source, /platform membership required/);
});

test("institute provisioning initializes settings, roles and audit", () => {
  assert.match(source, /insert into public\.institute_settings/);
  assert.match(source, /perform public\.seed_institute_defaults/);
  assert.match(source, /institute\.created/);
});

test("domain registration stores verification metadata and audit", () => {
  assert.match(source, /public\.register_institute_domain/);
  assert.match(source, /verification_token/);
  assert.match(source, /domain\.registered/);
});
