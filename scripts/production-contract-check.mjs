import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const compact = (value) => value.replace(/\s+/g, "");
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const data = read("src/lg/data.js");
const teacher = read("src/lg/teacherHomeworkApp.jsx");
const app = read("src/routes/app.tsx");
const config = read("supabase/config.toml");
const dc = compact(data);
const tc = compact(teacher);
const ac = compact(app);

// Shared data layer: verify the implementation, not formatter-specific source text.
check(/(?:const|let|var)TABLE_SELECTS=/.test(dc), "src/lg/data.js: table projection map is missing");
check(dc.includes("students:"), "src/lg/data.js: students projection is missing");
check(dc.includes("users:"), "src/lg/data.js: users projection is missing");
check(dc.includes("selectForTable=table=>"), "src/lg/data.js: table projection resolver is missing");
check(dc.includes("selectForTable(t)"), "src/lg/data.js: shared gdb does not use the centralized projection resolver");
check(!/from\(t\)\.select\(["']\*["']\)/.test(dc), "src/lg/data.js: shared gdb must not issue wildcard reads");
check(dc.includes("exportconstaddR="), "src/lg/data.js: shared insert path missing");
check(dc.includes("exportconstupdR="), "src/lg/data.js: shared update path missing");
check(dc.includes("exportconstdelR="), "src/lg/data.js: shared delete path missing");
check(dc.includes("supabase.from(t).insert(payload)"), "src/lg/data.js: shared inserts no longer write through Supabase");
check(dc.includes("supabase.from(t).update(payload)"), "src/lg/data.js: shared updates no longer write through Supabase");
check(dc.includes("supabase.from(t).delete()"), "src/lg/data.js: shared deletes no longer write through Supabase");
check(dc.includes("Supabase insert failed"), "src/lg/data.js: shared insert failures are not surfaced");
check(dc.includes("Supabase update failed"), "src/lg/data.js: shared update failures are not surfaced");
check(dc.includes("Supabase delete failed"), "src/lg/data.js: shared delete failures are not surfaced");

// Timetable: dedicated projection plus server-side access scoping.
const timetableProjection = "id,batch_id,teacher_id,subject_id,subject_name,day_of_week,start_time,end_time,status";
check(dc.includes(`constselect=\"${timetableProjection}\"`), "src/lg/data.js: timetable loader projection is missing");
check(dc.includes('from("timetable_entries").select(select)'), "src/lg/data.js: timetable loader must use its verified projection");
check(dc.includes('.eq("status","active")'), "src/lg/data.js: timetable loader must keep active-status filtering");
check(dc.includes('role==="teacher"&&ref') && dc.includes('query=query.eq("teacher_id",ref)'), "src/lg/data.js: teacher timetable access must remain scoped");
check(dc.includes('role==="student"||role==="parent"') && dc.includes('from("batch_students").select("batch_id")'), "src/lg/data.js: student timetable access must remain membership-scoped");

// Parent lifecycle: only genuine BFCache restoration may invalidate portal state.
check(ac.includes("ParentApp") && ac.includes("@/lg/parentWorkflows"), "src/routes/app.tsx: active parent route must use the scoped workflow");
check(app.includes("event.persisted"), "src/routes/app.tsx: BFCache restore handling is missing");
check(!app.includes("visibilitychange"), "src/routes/app.tsx: visibility changes must not remount the whole portal");

// Teacher payloads: normalize whitespace, then verify exact field membership.
const projectionAfter = (source, table) => {
  const marker = `supabase.from(\"${table}\").select(\"`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf('\")', start + marker.length);
  return end < 0 ? "" : source.slice(start + marker.length, end);
};
const profileProjection = ["id", "name", "tid", "subject", "phone", "classes", "status"];
const homeworkProjection = ["id", "batch_id", "cls", "sec", "subject", "desc", "given", "due", "tid", "pdfname", "storage_path", "file_size", "mime_type", "created_at"];
const profileSelected = projectionAfter(tc, "teachers").split(",");
const homeworkSelected = projectionAfter(tc, "homework").split(",");
check(profileProjection.every((field) => profileSelected.includes(field)), "src/lg/teacherHomeworkApp.jsx: teacher profile read is missing required projection fields");
check(homeworkProjection.every((field) => homeworkSelected.includes(field)), "src/lg/teacherHomeworkApp.jsx: teacher homework projection is incomplete");
check(!tc.includes('supabase.from("teachers").select("*")'), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard profile read");
check(!tc.includes('supabase.from("homework").select("*")'), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard homework read");

// Login gateway.
check(/\[functions\.auth-login\][\s\S]*?verify_jwt\s*=\s*false/i.test(config), "supabase/config.toml: auth-login must allow anonymous invocation before a session exists");

// Required hardening migrations.
check(/drop extension if exists pg_graphql/i.test(read("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql")), "GraphQL hardening migration is missing");
check(/get_student_tests\(\)/i.test(read("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql")), "unused student RPC hardening migration is missing");

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
  if (/service[_-]?role/i.test(content) && /eyJ[A-Za-z0-9_-]{20,}/.test(content)) failures.push(`${path.relative(root, file)}: possible service-role JWT embedded in frontend source`);
  if (/supabase\.rpc\(\s*["']get_student_(tests|test_results)["']/i.test(content)) failures.push(`${path.relative(root, file)}: revoked student helper RPC is still called by frontend code`);
}

if (failures.length) {
  console.error("Production contract checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Production contract checks passed.");
