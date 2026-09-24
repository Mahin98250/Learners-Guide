import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260924090000_final_multitenant_default_subdomains.sql", import.meta.url),
  "utf8"
);
const portal = fs.readFileSync(
  new URL("../src/platform/PlatformOwnerPortal.tsx", import.meta.url),
  "utf8"
);

test("final multi-tenant provisioning creates platform-managed default subdomains when enabled", () => {
  assert.match(migration, /default_subdomains_enabled/);
  assert.match(migration, /v_slug \|\| '\.' \|\| v_default_domain/);
  assert.match(migration, /domain_type,.*default_subdomain/s);
  assert.match(migration, /status,.*verified/s);
  assert.match(migration, /tls_status,.*active/s);
  assert.match(migration, /is_primary/);
});

test("custom domains remain independently supported", () => {
  assert.match(migration, /p_hostname/);
  assert.match(migration, /'custom'/);
  assert.match(migration, /'dns_txt'/);
  assert.match(portal, /Register custom domain/);
});

test("Owner can enable automatic default subdomains from platform settings", () => {
  assert.match(portal, /defaultSubdomainsEnabled/);
  assert.match(portal, /default_subdomains_enabled/);
  assert.match(portal, /Enable automatic institute subdomains/);
});
