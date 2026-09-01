import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function requireText(file, text, reason) {
  const content = read(file);
  if (!content.includes(text)) failures.push(`${file}: ${reason}`);
}

function requirePattern(file, pattern, reason) {
  const content = read(file);
  if (!pattern.test(content)) failures.push(`${file}: ${reason}`);
}

function forbidPattern(file, pattern, reason) {
  const content = read(file);
  if (pattern.test(content)) failures.push(`${file}: ${reason}`);
}

// Shared data layer: verify the real Supabase CRUD path is intact. These are
// intentionally semantic rather than formatter-sensitive checks.
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.select\(\s*["']\*["']\s*\)/, "shared reads no longer use the Supabase table path");
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.insert\(\s*payload\s*\)/, "shared inserts no longer write through Supabase");
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.update\(\s*payload\s*\)/, "shared updates no longer write through Supabase");
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.delete\(\s*\)/, "shared deletes no longer write through Supabase");
requireText("src/lg/data.js", "Supabase insert failed", "write failures are not surfaced from the shared insert path");

// Portal restore/lifecycle safety: only genuine BFCache restores should
// invalidate portal state. Ordinary visibility changes must not remount the
// portal or cause repeated Supabase reads.
requireText("src/routes/app.tsx", "portalRefreshKey", "mobile lifecycle refresh guard is missing");
requireText("src/routes/app.tsx", "clearCache();", "restored-page cache is not cleared");
requireText("src/routes/app.tsx", "event.persisted", "BFCache restore is not handled");
forbidPattern("src/routes/app.tsx", /addEventListener\(\s*["']visibilitychange["']/, "visibility changes must not trigger full portal remounts");

// Teacher portal payloads.
requirePattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']teachers["']\s*\)\.select\(\s*["']id,name,tid,subject,phone,classes,status["']\s*\)/, "teacher profile read must stay payload-scoped");
requirePattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']homework["']\s*\)\.select\(\s*["']id,batch_id,cls,sec,subject,desc,given,due,tid,pdfname,storage_path,file_size,mime_type,created_at["']\s*\)/, "teacher homework read must stay payload-scoped");
forbidPattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']teachers["']\s*\)\.select\(\s*["']\*["']\s*\)/, "teacher portal still contains a wildcard profile read");
forbidPattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']homework["']\s*\)\.select\(\s*["']\*["']\s*\)/, "teacher portal still contains a wildcard homework read");
forbidPattern("src/lg/data.js", /from\(\s*["']timetable_entries["']\s*\)\.select\(\s*["']\*["']\s*\)/, "shared timetable loader still contains a wildcard read");
requirePattern("src/lg/data.js", /const\s+select\s*=\s*["']id,batch_id,teacher_id,subject_id,subject_name,day_of_week,start_time,end_time,status["']/, "shared timetable loader must use the verified field set");

// Active parent route boundary.
requireText("src/routes/app.tsx", 'import { ParentApp } from "@/lg/parentWorkflows";', "active parent route must use the scoped parent workflow");
forbidPattern("src/routes/app.tsx", /import\s*\{\s*ParentApp\s*\}\s*from\s*["']@\/lg\/parent["'];/, "legacy parent workflow must not become the active route");

// Required hardening migrations.
requireText("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql", "drop extension if exists pg_graphql", "GraphQL hardening migration is missing");
requireText("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql", "get_student_tests()", "unused student RPC hardening migration is missing");

// Frontend must never contain privileged credentials or revoked helper RPCs.
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
  if (/supabase\.rpc\(\s*["']get_student_(tests|test_results)["']/i.test(content)) {
    failures.push(`${path.relative(root, file)}: revoked student helper RPC is still called by frontend code`);
  }
}

if (failures.length) {
  console.error("Production contract checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production contract checks passed: scoped portal payloads, active route boundaries, BFCache recovery, privileged RPC boundaries, migrations and client-secret guard are intact.");
