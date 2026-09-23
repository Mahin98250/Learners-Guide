import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const controlPlane = read("src/platform/PlatformOwnerControlPlane.tsx");
const client = read("src/platform/platform-tenant-data.ts");
const migration = read("supabase/migrations/20260923020000_phase9b_owner_lazy_tenant_detail.sql");
const route = read("src/routes/owner.tsx");

test("Phase 9B routes Owner through a bounded control plane", () => {
  assert.match(route, /PlatformOwnerControlPlane/);
  assert.match(controlPlane, /listPlatformInstitutes/);
  assert.match(controlPlane, /getPlatformInstituteStatusCounts/);
  assert.match(controlPlane, /limit: 50/);
});

test("Owner directory does not materialize institute collections through direct browser reads", () => {
  assert.doesNotMatch(controlPlane, /\.from\(["']institutes["']\)/);
  assert.doesNotMatch(controlPlane, /\.from\(["']institute_domains["']\)/);
  assert.doesNotMatch(controlPlane, /\.from\(["']audit_logs["']\)/);
  assert.match(client, /platform_list_institutes/);
  assert.match(client, /platform_institute_status_counts/);
});

test("Fast Owner onboarding exposes the real institute creation flow", () => {
  assert.match(controlPlane, /Create institute/);
  assert.match(controlPlane, /platform_provision_institute/);
  assert.match(controlPlane, /Custom domain/);
  assert.doesNotMatch(controlPlane, /provisionTimezone|provisionLocale/);
});

test("Fast Owner status control uses the protected platform operation", () => {
  assert.match(controlPlane, /changeInstituteStatus/);
  assert.match(controlPlane, /platform_set_institute_status/);
});

test("Tenant details are loaded only on demand", () => {
  assert.match(controlPlane, /getPlatformInstituteDetail/);
  assert.match(controlPlane, /onClick=\{\(\) => void openDetail\(institute\)\}/);
  assert.match(controlPlane, /lazy\(\(\) => import\("@\/platform\/PlatformOwnerPortal"\)\)/);
  assert.match(controlPlane, /Open full platform operations/);
});

test("Tenant detail RPC is owner-gated and excludes verification secrets", () => {
  assert.match(migration, /platform_owner_access_ok\(\)/);
  assert.match(migration, /platform_get_institute_detail/);
  assert.match(migration, /revoke all on function public\.platform_get_institute_detail/);
  assert.doesNotMatch(migration, /'verification_token'/);
});
