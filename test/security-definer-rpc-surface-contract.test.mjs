import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationDir = path.join(root, "supabase", "migrations");
const migrations = fs
  .readdirSync(migrationDir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => fs.readFileSync(path.join(migrationDir, f), "utf8"))
  .join("\n")
  .toLowerCase();

const exposedLegacyRpc = [
  "assign_institute_membership",
  "create_compression_tenant",
  "retry_pdf_compression_job",
];

test("legacy SECURITY DEFINER RPCs are not exposed to API roles", () => {
  for (const name of exposedLegacyRpc) {
    assert.match(
      migrations,
      new RegExp(
        `revoke\\s+execute\\s+on\\s+function\\s+public\\.${name.replaceAll("_", "\\_")}\\([^;]+\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
        "i",
      ),
    );
  }
});

test("future public-schema functions default to least-privilege execution grants", () => {
  assert.match(
    migrations,
    /alter default privileges for role postgres in schema public\s+revoke execute on functions from public, anon, authenticated/i,
  );
});
