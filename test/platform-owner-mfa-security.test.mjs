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
  "platform_set_feature_enabled",
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
  assert.match(login, /friendlyName:\s*"Mahin Owner"/);
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


test("owner portal exposes feature entitlement controls", () => {
  const portal = fs.readFileSync(
    path.join(root, "src", "platform", "PlatformOwnerPortal.tsx"),
    "utf8",
  );
  assert.match(portal, /platform_features/);
  assert.match(portal, /institute_feature_entitlements/);
  assert.match(portal, /platform_set_feature_enabled/);
  assert.match(portal, /Feature entitlements/i);
});

test("feature entitlement mutation is MFA protected and dependency aware", () => {
  const start = migrations.lastIndexOf(
    "create or replace function public.platform_set_feature_enabled",
  );
  assert.ok(start >= 0, "feature entitlement RPC is missing");
  const block = migrations.slice(start, migrations.length);
  assert.match(block, /platform_owner_access_ok\(\)/i);
  assert.match(block, /Platform owner MFA verification required/i);
  assert.match(block, /depends_on/i);
  assert.match(block, /Disable dependent features before disabling/i);
});

test("owner portal does not render control-plane data before AAL2", () => {
  const portal = fs.readFileSync(
    path.join(root, "src", "platform", "PlatformOwnerPortal.tsx"),
    "utf8",
  );
  const sessionStart = portal.indexOf(
    "const session=await supabase.auth.getSession()",
  );
  assert.ok(sessionStart >= 0, "owner session gate is missing");
  const sessionBlock = portal.slice(sessionStart, sessionStart + 500);
  assert.match(sessionBlock, /getAuthenticatorAssuranceLevel/);
  assert.match(sessionBlock, /currentLevel!==["']aal2["']/);
  assert.match(sessionBlock, /setAuthenticated\(false\)/);
  assert.match(sessionBlock, /setAllowed\(false\)/);
});

test("platform-level RLS membership helper requires AAL2", () => {
  const hardening = fs.readFileSync(
    path.join(
      root,
      "supabase",
      "migrations",
      "20260922220000_platform_member_aal2_rls.sql",
    ),
    "utf8",
  );
  assert.match(hardening, /create or replace function public\.is_platform_member\(\)/);
  assert.match(hardening, /auth\.jwt\(\)\s*->>\s*'aal'/i);
  assert.match(hardening, /=\s*'aal2'/i);
  assert.match(hardening, /pm\.status\s*=\s*'active'/i);
  assert.match(
    hardening,
    /revoke all on function public\.is_platform_member\(\) from public, anon/i,
  );
  assert.match(
    hardening,
    /grant execute on function public\.is_platform_member\(\) to authenticated/i,
  );
});


test("owner MFA reconciles stale duplicate factors before enrollment", () => {
  assert.match(login, /const listMfaFactors = async \(\) =>/);
  assert.match(login, /factors = await listMfaFactors\(\);/);
  assert.match(login, /const staleFactors = \(factors\?\.totp \|\| \[\]\)\.filter/);
  assert.match(login, /for \(const staleFactor of staleFactors\)/);
  assert.match(login, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(login, /duplicateStaleFactors/);
  assert.doesNotMatch(login, /const staleUnverified/);
  assert.doesNotMatch(login, /const staleFactor = \(factors\?\.totp \|\| \[\]\)\.find/);
});


test("owner login keeps the email entry private and uses the backend as the security gate", () => {
  assert.match(login, /id="owner-email"/);
  assert.match(login, /type="email"/);
  assert.match(login, /value={ownerEmail}/);
  assert.match(login, /login_hint: normalizedEmail/);
  assert.match(login, /current_platform_roles/);
  assert.doesNotMatch(login, /const OWNER_EMAIL\s*=/);
  assert.doesNotMatch(login, /patelmahin140@gmail\.com/);
  assert.doesNotMatch(login, /AUTHORIZED GOOGLE ACCOUNT/);
});
