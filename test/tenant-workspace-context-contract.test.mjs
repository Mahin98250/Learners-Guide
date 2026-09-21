import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tenant = fs.readFileSync("src/lg/tenant.ts", "utf8");
const context = fs.readFileSync("src/lg/tenant-context.tsx", "utf8");
const queries = fs.readFileSync("src/lg/data/queries.js", "utf8");
const mutations = fs.readFileSync("src/lg/data/mutations.js", "utf8");
const recordsAuth = fs.readFileSync("src/admin/records/AdminRecordsAuth.ts", "utf8");

test("tenant context persists and restores an explicit active institute", () => {
  assert.match(tenant, /ACTIVE_INSTITUTE_STORAGE_KEY/);
  assert.match(tenant, /getPreferredInstituteId/);
  assert.match(tenant, /setPreferredInstituteId/);
  assert.match(tenant, /preferredId/);
});

test("admin workspace is gated until an active institute membership is selected", () => {
  assert.match(context, /InstituteWorkspaceProvider/);
  assert.match(context, /InstituteWorkspaceGate/);
  assert.match(context, /Choose an institute/);
  assert.match(context, /No active institute membership/);
});

test("legacy reads are explicitly scoped to the active institute", () => {
  assert.match(queries, /TENANT_TABLES=new Set/);
  assert.match(queries, /scopeTenantQuery/);
  assert.match(queries, /\.eq\("institute_id",context\.membership\.institute_id\)/);
});

test("legacy writes are explicitly scoped to the active institute", () => {
  assert.match(mutations, /withTenantScope/);
  assert.match(mutations, /An active institute workspace must be selected before saving this record/);
  assert.match(mutations, /\.eq\("institute_id",payload\.institute_id\)/);
  assert.match(recordsAuth, /sync_institute_account_membership/);
  assert.match(recordsAuth, /remove_institute_account_membership/);
});