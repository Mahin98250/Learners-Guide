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

function forbidText(file, text, reason) {
  const content = read(file);
  if (content.includes(text)) failures.push(`${file}: ${reason}`);
}

requireText("src/lg/data.js", 'supabase.from(t).select("*")', "shared reads no longer use the Supabase table path");
requireText("src/lg/data.js", 'supabase.from(t).insert(payload)', "shared inserts no longer write through Supabase");
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.update\(payload\)/, "shared updates no longer write through Supabase");
requireText("src/lg/data.js", 'supabase.from(t).delete()', "shared deletes no longer write through Supabase");
requireText("src/lg/data.js", "Supabase insert failed", "write failures are not surfaced from the shared insert path");

requireText("src/routes/app.tsx", "portalRefreshKey", "mobile lifecycle refresh guard is missing");
requireText("src/routes/app.tsx", "clearCache();", "restored-page cache is not cleared");
requireText("src/routes/app.tsx", "if (event.persisted) refreshAfterRestore();", "BFCache restore is not handled");

requirePattern("src/lg/teacherHomeworkApp.jsx", /from\("teachers"\)\.select\("id,name,tid,subject,phone,classes,status"\)/, "teacher profile read must stay payload-scoped");
requirePattern("src/lg/teacherHomeworkApp.jsx", /from\("homework"\)\.select\("id,batch_id,cls,sec,subject,desc,given,due,tid,pdfname,storage_path,file_size,mime_type,created_at"\)/, "teacher homework read must stay payload-scoped");
forbidText("src/lg/teacherHomeworkApp.jsx", 'from("teachers").select("*")', "teacher portal still contains a wildcard profile read");
forbidText("src/lg/teacherHomeworkApp.jsx", 'from("homework").select("*")', "teacher portal still contains a wildcard homework read");
forbidText("src/lg/data.js", 'from("timetable_entries").select("*")', "shared timetable loader still contains a wildcard read");
requirePattern("src/lg/data.js", /const select\s*=\s*"id,batch_id,teacher_id,subject_id,subject_name,day_of_week,start_time,end_time,status"/, "shared timetable loader must use the verified field set");

requireText("src/routes/app.tsx", 'import { ParentApp } from "@/lg/parentWorkflows";', "active parent route must use the scoped parent workflow");
forbidText("src/routes/app.tsx", 'import { ParentApp } from "@/lg/parent";', "legacy parent workflow must not become the active route");

requireText("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql", "drop extension if exists pg_graphql", "GraphQL hardening migration is missing");
requireText("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql", "get_student_tests()", "unused student RPC hardening migration is missing");

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

console.log("Production contract checks passed: scoped portal payloads, active route boundaries, mobile restore recovery, privileged RPC boundaries, migrations and client-secret guard are intact.");
