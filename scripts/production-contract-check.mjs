import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function requireText(file, text, reason) {
  const content = read(file);
  if (!content.includes(text)) failures.push(`${file}: ${reason}`);
}

function forbidText(file, text, reason) {
  const content = read(file);
  if (content.includes(text)) failures.push(`${file}: ${reason}`);
}

// Supabase must remain the authoritative data path for the shared data layer.
requireText("src/lg/data.js", 'supabase.from(t).select("*")', "shared reads no longer use the Supabase table path");
requireText("src/lg/data.js", "await supabase.from(t).insert(payload)", "shared inserts no longer write through Supabase");
requireText("src/lg/data.js", "await supabase.from(t).update(payload)", "shared updates no longer write through Supabase");
requireText("src/lg/data.js", "await supabase.from(t).delete()", "shared deletes no longer write through Supabase");
requireText("src/lg/data.js", "if(error){console.error(`Supabase insert failed", "write failures are not surfaced from the shared insert path");

// Returning to a frozen mobile page must clear cache and remount the portal.
requireText("src/routes/app.tsx", "portalRefreshKey", "mobile lifecycle refresh guard is missing");
requireText("src/routes/app.tsx", "clearCache();", "restored-page cache is not cleared");
requireText("src/routes/app.tsx", "if (event.persisted) refreshAfterRestore();", "BFCache restore is not handled");

// Student tests/results use the canonical tables, not the privileged helper RPCs.
forbidText("src", "supabase.rpc(\"get_student_tests\"", "student tests must not depend on the revoked helper RPC");
forbidText("src", "supabase.rpc(\"get_student_test_results\"", "student results must not depend on the revoked helper RPC");

// The production migration must remain present in source control.
requireText("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql", "drop extension if exists pg_graphql", "GraphQL hardening migration is missing");
requireText("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql", "get_student_tests()", "unused student RPC hardening migration is missing");

// Prevent accidental client-side service-role exposure.
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, "src"));
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (/service[_-]?role/i.test(content) && /eyJ[A-Za-z0-9_-]{20,}/.test(content)) {
    failures.push(`${path.relative(root, file)}: possible service-role JWT embedded in frontend source`);
  }
}

if (failures.length) {
  console.error("Production contract checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production contract checks passed: Supabase source-of-truth, mobile restore recovery, privileged RPC boundaries, migrations and client-secret guard are intact.");
