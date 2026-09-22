import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const architecture = fs.readFileSync("docs/phase9-multi-tenant-architecture.md", "utf8");
const tenant = fs.readFileSync("src/lg/tenant.ts", "utf8");
const tenantContext = fs.readFileSync("src/lg/tenant-context.tsx", "utf8");
const queries = fs.readFileSync("src/lg/data/queries.js", "utf8");
const mutations = fs.readFileSync("src/lg/data/mutations.js", "utf8");
const adminRoute = fs.readFileSync("src/routes/admin.tsx", "utf8");
const ownerRoute = fs.readFileSync("src/routes/owner.tsx", "utf8");
const ownerPortal = fs.readFileSync("src/platform/PlatformOwnerPortal.tsx", "utf8");

test("Phase 9 architecture keeps the existing institute portals as the data plane", () => {
  assert.match(architecture, /Existing institute application \/ data plane/);
  assert.match(architecture, /Do not:/);
  assert.match(architecture, /duplicate Student portal code/);
  assert.match(architecture, /create per-tenant databases/);
});

test("shared tenant context remains the canonical institute workspace boundary", () => {
  assert.match(tenant, /getCurrentInstituteContext/);
  assert.match(tenant, /resolveInstituteForCurrentHostname/);
  assert.match(tenant, /getPreferredInstituteId/);
  assert.match(tenantContext, /InstituteWorkspaceProvider/);
  assert.match(tenantContext, /InstituteWorkspaceGate/);
  assert.match(adminRoute, /<InstituteWorkspaceProvider>/);
  assert.match(adminRoute, /<InstituteWorkspaceGate>/);
});

test("existing shared data architecture scopes reads and writes to the active tenant", () => {
  assert.match(queries, /const TENANT_TABLES=new Set/);
  assert.match(queries, /scopeTenantQuery/);
  assert.match(queries, /institute_id/);
  assert.match(mutations, /const TENANT_TABLES=new Set/);
  assert.match(mutations, /withTenantScope/);
  assert.match(mutations, /selected institute does not match this workspace/);
});

test("platform Owner remains a separate control-plane route", () => {
  assert.match(ownerRoute, /createFileRoute("\/owner")/);
  assert.match(ownerPortal, /PLATFORM OWNER/);
  assert.match(ownerPortal, /current_platform_roles/);
  assert.match(ownerPortal, /mfa\.getAuthenticatorAssuranceLevel/);
});

test("Phase 9 requires bounded control-plane reads instead of browser-wide materialization", () => {
  assert.match(architecture, /server-side search/);
  assert.match(architecture, /keyset\/cursor pagination/);
  assert.match(architecture, /Large control-plane collections must not be loaded completely into the browser/);
});
