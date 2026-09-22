import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("100x tenant migration uses restrictive RLS for tenant boundary", () => {
  const sql = read("supabase/migrations/20260922080000_tenant_boundary_100x.sql");
  assert.match(sql, /as restrictive for all to authenticated/i);
  assert.match(sql, /alter table public\.%I alter column institute_id set not null/i);
  assert.match(sql, /tenant_scope_%I/i);
  assert.match(sql, /set_and_validate_tenant_id/i);
});

test("tenant login gateway receives and validates hostname membership", () => {
  const auth = read("src/lg/auth.js");
  const gateway = read("supabase/functions/auth-login/index.ts");
  assert.ok(auth.includes('hostname: typeof window !== "undefined" ? getCurrentHostname() : ""'));
  assert.match(gateway, /normalizeHostname/);
  assert.match(gateway, /resolveTenant/);
  assert.match(gateway, /hasTenantMembership/);
  assert.match(gateway, /does not belong to this institute portal/i);
});

test("private tenant host cannot open platform control routes", () => {
  const rootRoute = read("src/routes/__root.tsx");
  assert.match(rootRoute, /location\.pathname === "\/owner"/);
  assert.match(rootRoute, /location\.pathname === "\/admin"/);
  assert.match(rootRoute, /throw redirect\(\{ to: "\/" \}\)/);
});

test("visible login branding never falls back to the legacy product name", () => {
  const role = read("src/lg/authscreens.tsx");
  const login = read("src/lg/LoginScreen.jsx");
  assert.doesNotMatch(role, /"Learner's Guide"/);
  assert.doesNotMatch(login, /"Learner's Guide"/);
});
