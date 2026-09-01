import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const has = (source, token) => source.includes(token);
const compact = source => source.replace(/\s+/g, "");
const hasAll = (source, tokens) => tokens.every(token => source.includes(token));
const check = (condition, message) => { if (!condition) failures.push(message); };
const data = read("src/lg/data.js");
const teacher = read("src/lg/teacherHomeworkApp.jsx");
const app = read("src/routes/app.tsx");
const dataCompact = compact(data);
const teacherCompact = compact(teacher);

// Centralized projection contract. Validate the contract itself, not a particular formatter layout.
check(has(data, "TABLE_SELECTS"), "src/lg/data.js: table projection map is missing");
check(hasAll(dataCompact, ["TABLE_SELECTS=", "students:"]), "src/lg/data.js: students projection is missing");
check(hasAll(dataCompact, ["TABLE_SELECTS=", "users:"]), "src/lg/data.js: users projection is missing");
check(has(data, "selectForTable"), "src/lg/data.js: table projection resolver is missing");
check(hasAll(dataCompact, ["gdb=async", "selectForTable(t)"]), "src/lg/data.js: shared gdb does not use the centralized projection resolver");
check(!/supabase\.from\(\s*t\s*\)\.select\(\s*["']\*["']\s*\)/.test(data), "src/lg/data.js: shared gdb must not issue wildcard reads");

// CRUD boundary.
check(has(data, "export const addR"), "src/lg/data.js: shared insert path missing");
check(has(data, "export const updR"), "src/lg/data.js: shared update path missing");
check(has(data, "export const delR"), "src/lg/data.js: shared delete path missing");
check(has(data, "Supabase insert failed"), "src/lg/data.js: shared insert failures are not surfaced");
check(has(data, "Supabase update failed"), "src/lg/data.js: shared update failures are not surfaced");
check(has(data, "Supabase delete failed"), "src/lg/data.js: shared delete failures are not surfaced");

// Timetable: projection, active filter, and role/membership scoping.
check(hasAll(dataCompact, ["constselect=", "id,batch_id,teacher_id,subject_id,subject_name,day_of_week,start_time,end_time,status"]), "src/lg/data.js: timetable projection is missing");
check(hasAll(dataCompact, ["from(\"timetable_entries\").select(select)"]), "src/lg/data.js: timetable loader must use its verified projection");
check(hasAll(dataCompact, ["eq(\"status\",\"active\")"]), "src/lg/data.js: timetable loader must keep active-status filtering");
check(/role===(["'])teacher\1[\s\S]*?eq\((["'])teacher_id\2/.test(dataCompact), "src/lg/data.js: teacher timetable access must remain scoped");
check(/role===(["'])student\1\|\|role===(["'])parent\2[\s\S]*?batch_students/.test(dataCompact), "src/lg/data.js: student timetable access must remain membership-scoped");

// Parent route/lifecycle.
check(has(app, "ParentApp") && has(app, "@/lg/parentWorkflows"), "src/routes/app.tsx: active parent route must use the scoped workflow");
check(has(app, "event.persisted"), "src/routes/app.tsx: BFCache restore handling is missing");
check(!/addEventListener\(\s*["']visibilitychange["']/.test(app), "src/routes/app.tsx: visibility changes must not remount the whole portal");

// Teacher payload contracts. Find the table and required projection independently so harmless formatting/import changes cannot break the gate.
check(has(teacherCompact, "from(\"teachers\")") && has(teacherCompact, ".select(\"id,name,tid,subject,phone,classes,status\")"), "src/lg/teacherHomeworkApp.jsx: teacher profile read is missing");
check(!/from\(["']teachers["']\)\.select\(\s*["']\*["']\s*\)/.test(teacher), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard profile read");
check(has(teacherCompact, "from(\"homework\")") && has(teacherCompact, ".select(\"id,batch_id,cls,sec,subject,desc,given,due,tid,pdfname,storage_path,file_size,mime_type,created_at\")"), "src/lg/teacherHomeworkApp.jsx: teacher homework read is missing");
check(!/from\(["']homework["']\)\.select\(\s*["']\*["']\s*\)/.test(teacher), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard homework read");

// Login gateway.
const config = read("supabase/config.toml");
check(/\[functions\.auth-login\][\s\S]*?verify_jwt\s*=\s*false/i.test(config), "supabase/config.toml: auth-login must allow anonymous invocation before a session exists");

// Required security hardening migrations.
check(/drop extension if exists pg_graphql/i.test(read("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql")), "GraphQL hardening migration is missing");
check(/get_student_tests\(\)/i.test(read("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql")), "unused student RPC hardening migration is missing");

// Frontend security guards.
const sourceFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
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
  if (/service[_-]?role/i.test(content) && /eyJ[A-Za-z0-9_-]{20,}/.test(content)) failures.push(`${path.relative(root, file)}: possible service-role JWT embedded in frontend source`);
  if (/supabase\.rpc\(\s*["']get_student_(tests|test_results)["']/i.test(content)) failures.push(`${path.relative(root, file)}: revoked student helper RPC is still called by frontend code`);
}

if (failures.length) {
  console.error("Production contract checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Production contract checks passed.");
