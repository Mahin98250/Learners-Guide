import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/lg/tenant.ts", "utf8");

test("tenant resolver exposes hostname normalization", () => {
  assert.ok(source.includes("export function normalizeHostname(value: unknown)"));
  assert.ok(source.includes(".toLowerCase()"));
  assert.ok(source.includes(`.replace(/^https?:\\/\\//, "")`));
  assert.ok(source.includes(`.replace(/\\/$/, "")`));
});

test("tenant resolver calls the server-side domain lookup RPC", () => {
  assert.ok(source.includes('supabase.rpc("resolve_institute_domain"'));
  assert.ok(source.includes("p_hostname: hostname"));
});
