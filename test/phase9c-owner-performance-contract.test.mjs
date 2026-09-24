import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const controlPlane = read("src/platform/PlatformOwnerControlPlane.tsx");
const client = read("src/platform/platform-tenant-data.ts");
const performanceMigration = read("supabase/migrations/20260923030000_phase9c_owner_performance_indexes.sql");
const directoryMigration = read("supabase/migrations/20260923010000_phase9_platform_institute_directory.sql");
const legacyPortal = read("src/platform/PlatformOwnerPortal.tsx");

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
  assert.match(directoryMigration, /institutes_status_created_id_idx/);
  assert.match(directoryMigration, /pg_trgm/);
  assert.match(performanceMigration, /institutes_created_id_idx/);
  assert.match(performanceMigration, /institute_domains_institute_created_id_idx/);
  assert.match(performanceMigration, /institute_feature_entitlements_institute_feature_idx/);
  assert.match(performanceMigration, /institute_memberships_institute_status_idx/);
});

test("The initial Owner control plane does not load the legacy institute operations surface", () => {
  assert.doesNotMatch(controlPlane, /PlatformOwnerPortal/);
  assert.doesNotMatch(controlPlane, /lazy\(\(\) => import\("@\/platform\/PlatformOwnerPortal"\)\)/);
});

test("The full Owner operations surface does not poll every 30 seconds in the background", () => {
  assert.doesNotMatch(legacyPortal, /setInterval\(\(\) => void load\(true\), 30000\)/);
});
