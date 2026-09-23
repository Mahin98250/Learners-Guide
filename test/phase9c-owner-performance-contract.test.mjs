import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const controlPlane = read("src/platform/PlatformOwnerControlPlane.tsx");
const client = read("src/platform/platform-tenant-data.ts");
const directoryMigration = read("supabase/migrations/20260923010000_phase9_platform_institute_directory.sql");
const detailMigration = read("supabase/migrations/20260923020000_phase9b_owner_lazy_tenant_detail.sql");

test("Owner search is debounced and stale responses cannot overwrite newer results", () => {
  assert.match(controlPlane, /setTimeout\(\(\) => \{/);
  assert.match(controlPlane, /}, 250\)/);
  assert.match(controlPlane, /directoryRequestRef\.current/);
  assert.match(controlPlane, /requestId !== directoryRequestRef\.current/);
});

test("Owner refreshes do not refetch status aggregates on every directory search", () => {
  const searchEffect = controlPlane.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[query, status, authenticated\]\);/);
  assert.ok(searchEffect, "Missing debounced directory search effect");
  assert.doesNotMatch(searchEffect[0], /getPlatformInstituteStatusCounts/);
  assert.match(client, /STATUS_COUNTS_CACHE_TTL_MS = 5_000/);
  assert.match(client, /statusCountsPromise/);
});

test("Owner mutation refreshes invalidate cached aggregate counts", () => {
  assert.match(controlPlane, /invalidatePlatformInstituteStatusCounts\(\);/);
});

test("Directory and lazy-detail queries have scale-oriented indexes", () => {
  assert.match(directoryMigration, /institutes_created_id_idx/);
  assert.match(directoryMigration, /institutes_status_created_id_idx/);
  assert.match(directoryMigration, /pg_trgm/);
  assert.match(detailMigration, /institute_domains_institute_created_id_idx/);
  assert.match(detailMigration, /institute_feature_entitlements_institute_feature_idx/);
  assert.match(detailMigration, /institute_memberships_institute_status_idx/);
});

test("The heavy legacy Owner operations stay out of the initial control-plane bundle", () => {
  assert.match(controlPlane, /lazy\(\(\) => import\("@\/platform\/PlatformOwnerPortal"\)\)/);
});
