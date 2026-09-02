import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const compact = (value) => value.replace(/\s+/g, "");
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const data = read("src/lg/data.js");
const teacher = read("src/lg/teacherHomeworkApp.jsx");
const app = read("src/routes/app.tsx");
const config = read("supabase/config.toml");
const dc = compact(data);
const tc = compact(teacher);

// Centralized read projections.
check(/(?:const|let|var)\s+TABLE_SELECTS\s*=/.test(data), "src/lg/data.js: table projection map is missing");
check(/TABLE_SELECTS[\s\S]*students\s*:/.test(data), "src/lg/data.js: students projection is missing");
check(/TABLE_SELECTS[\s\S]*users\s*:/.test(data), "src/lg/data.js: users projection is missing");
check(/(?:const|let|var)\s+selectForTable\s*=/.test(data), "src/lg/data.js: table projection resolver is missing");
check(/selectForTable\s*\(\s*t\s*\)/.test(data), "src/lg/data.js: shared gdb does not use the centralized projection resolver");
check(!/from\(t\)\.select\(\s*["']\*["']\s*\)/.test(dc), "src/lg/data.js: shared gdb must not issue wildcard reads");

for (const [token, message] of [
  ["export const addR", "shared insert path missing"],
  ["export const updR", "shared update path missing"],
  ["export const delR", "shared delete path missing"],
  ["Supabase insert failed", "shared insert failures are not surfaced"],
  ["Supabase update failed", "shared update failures are not surfaced"],
  ["Supabase delete failed", "shared delete failures are not surfaced"],
]) {
  check(data.includes(token), `src/lg/data.js: ${message}`);
}

// Timetable has a dedicated projection because it enriches rows after the read.
const timetableProjection = "id,batch_id,teacher_id,subject_id,subject_name,day_of_week,start_time,end_time,status";
check(dc.includes(`constselect="${timetableProjection}"`), "src/lg/data.js: timetable loader projection is missing");
check(dc.includes('from("timetable_entries").select(select)'), "src/lg/data.js: timetable loader must use its verified projection");
check(dc.includes('.eq("status","active")'), "src/lg/data.js: timetable loader must keep active-status filtering");
check(
  dc.includes('role==="teacher"&&ref') && dc.includes('query=query.eq("teacher_id",ref)'),
  "src/lg/data.js: teacher timetable access must remain scoped",
);
check(
  dc.includes('role==="student"||role==="parent"') && dc.includes('from("batch_students").select("batch_id")'),
  "src/lg/data.js: student timetable access must remain membership-scoped",
);

// Parent lifecycle.
check(app.includes("ParentApp") && app.includes("@/lg/parentWorkflows"), "src/routes/app.tsx: active parent route must use the scoped workflow");
check(app.includes("event.persisted"), "src/routes/app.tsx: BFCache restore handling is missing");
check(!app.includes('addEventListener("visibilitychange"'), "src/routes/app.tsx: visibility changes must not remount the whole portal");

// Teacher reads. Validate the exact optimized projections after whitespace normalization.
const profileProjection = "id,name,tid,subject,phone,classes,status";
const homeworkProjection = "id,batch_id,cls,sec,subject,desc,given,due,tid,pdfname,storage_path,file_size,mime_type,created_at";
check(tc.includes(`supabase.from("teachers").select("${profileProjection}")`), "src/lg/teacherHomeworkApp.jsx: teacher profile read is missing");
check(!tc.includes('supabase.from("teachers").select("*")'), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard profile read");
check(tc.includes(`supabase.from("homework").select("${homeworkProjection}")`), "src/lg/teacherHomeworkApp.jsx: teacher homework projection is incomplete");
check(!tc.includes('supabase.from("homework").select("*")'), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard homework read");

// Login gateway.
check(
  /\[functions\.auth-login\][\s\S]*?verify_jwt\s*=\s*false/i.test(config),
  "supabase/config.toml: auth-login must allow anonymous invocation before a session exists",
);

// Security migrations.
check(
  /drop extension if exists pg_graphql/i.test(read("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql")),
  "GraphQL hardening migration is missing",
);
check(
  /get_student_tests\(\)/i.test(read("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql")),
  "unused student RPC hardening migration is missing",
);

// Frontend security guards.
const files = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(file);
  }
};
walk(path.join(root, "src"));
for (const file of files) {
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

console.log("Production contract checks passed.");
