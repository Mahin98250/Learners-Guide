import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const login = fs.readFileSync(
  path.join(root, "src", "platform", "PlatformOwnerLogin.tsx"),
  "utf8",
);
const migrationDir = path.join(root, "supabase", "migrations");
const migrations = fs
  .readdirSync(migrationDir)
  .filter((file) => file.endsWith(".sql"))
  .map((file) => fs.readFileSync(path.join(migrationDir, file), "utf8"))
  .join("\n");

const ownerRpc = [
  "platform_update_settings",
  "platform_set_institute_status",
  "platform_set_primary_domain",
  "platform_disable_domain",
  "platform_assign_institute_membership",
  "platform_remove_institute_membership",
  "create_institute",
  "register_institute_domain",
];

test("owner login requires Google OAuth and MFA", () => {
  assert.match(login, /signInWithOAuth/);
  assert.match(login, /provider:\s*"google"/);
  assert.match(login, /Continue with Google/);
  assert.match(login, /getAuthenticatorAssuranceLevel/);
  assert.match(login, /listFactors/);
  assert.match(login, /mfa\.challenge/);
  assert.match(login, /mfa\.verify/);
  assert.doesNotMatch(login, /signInWithPassword/);
});

test("owner login cannot grant access before AAL2", () => {
  assert.match(login, /currentLevel\s*===\s*"aal2"/);
  assert.match(login, /nextLevel\s*===\s*"aal2"/);
  assert.match(login, /MFA verification did not promote this session to AAL2/);
});

test("owner enrollment supports a TOTP authenticator", () => {
  assert.match(login, /factorType:\s*"totp"/);
  assert.match(login, /friendlyName:\s*"Learner's Guide Owner"/);
  assert.match(login, /qr_code/);
  assert.match(login, /secret/);
});

test("database owner guard requires the authorized identity, role, and AAL2", () => {
  const start = migrations.lastIndexOf(
    "create or replace function public.platform_owner_access_ok()",
  );
  assert.ok(start >= 0, "owner access helper is missing");
  const block = migrations.slice(start, start + 1800);
  assert.match(block, /security invoker/i);
  assert.match(block, /patelmahin140@gmail\.com/i);
  assert.match(block, /auth\.jwt\(\)\s*->>\s*'aal'/i);
  assert.match(block, /=\s*'aal2'/i);
  assert.match(block, /pm\.role\s*=\s*'platform_owner'/i);
  assert.match(block, /pm\.status\s*=\s*'active'/i);
  assert.match(
    block,
    /revoke all on function public\.platform_owner_access_ok\(\) from public, anon, authenticated/i,
  );
});

test("every privileged platform mutation calls the owner guard", () => {
  for (const name of ownerRpc) {
    const start = migrations.lastIndexOf(
      "create or replace function public." + name,
    );
    assert.ok(start >= 0, "missing owner RPC: " + name);
    const next = migrations.indexOf(
      "create or replace function public.",
      start + 1,
    );
    const block = migrations.slice(start, next < 0 ? migrations.length : next);
    assert.match(
      block,
      /platform_owner_access_ok\(\)[\s\S]{0,180}Platform owner MFA verification required/i,
      name + " must enforce owner MFA and role authorization",
    );
  }
});
