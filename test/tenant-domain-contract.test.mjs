import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/lg/tenant.ts", "utf8");

test("tenant resolver exposes hostname normalization", () => {
  assert.match(source, /export function normalizeHostname\(value: unknown\)/);
  assert.match(source, /\.toLowerCase\(\)/);
  assert.match(source, /replace\(\/\^https\?:\\/\\///);
  assert.match(source, /replace\(\/\\\/$\//);
});

test("tenant resolver calls the server-side domain lookup RPC", () => {
  assert.match(source, /supabase\.rpc\("resolve_institute_domain"/);
  assert.match(source, /p_hostname: hostname/);
});
