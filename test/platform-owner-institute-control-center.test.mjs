import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const portal=fs.readFileSync("src/platform/PlatformOwnerPortal.tsx","utf8");
const migration=fs.readFileSync("supabase/migrations/20260922210000_platform_institute_control_center.sql","utf8");

test("owner portal exposes a dedicated institute control center",()=>{
  assert.match(portal,/INSTITUTE CONTROL CENTER/);
  assert.match(portal,/platform_update_institute_settings/);
  assert.match(portal,/Control center/);
  assert.match(portal,/institute_settings/);
});

test("institute settings writes use a protected owner RPC",()=>{
  assert.match(migration,/create or replace function public\.platform_update_institute_settings/);
  assert.match(migration,/platform_owner_access_ok\(\)/);
  assert.match(migration,/set search_path = ''/);
  assert.match(migration,/institute\.settings\.updated/);
  assert.match(migration,/revoke all on function public\.platform_update_institute_settings/);
  assert.doesNotMatch(portal,/\.from\(["']institute_settings["']\)\.(insert|update|upsert|delete)/);
});
