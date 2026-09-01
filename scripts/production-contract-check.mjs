import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const has = (source, token) => source.includes(token);
const hasRegex = (source, regex) => regex.test(source);
const check = (condition, message) => { if (!condition) failures.push(message); };
const data = read("src/lg/data.js");
const teacher = read("src/lg/teacherHomeworkApp.jsx");
const app = read("src/routes/app.tsx");

// Centralized projection contract: validate semantic source tokens, not formatting.
check(has(data, "const TABLE_SELECTS={") || has(data, "const TABLE_SELECTS = {"), "src/lg/data.js: table projection map is missing");
check(hasRegex(data, /TABLE_SELECTS\s*=\s*\{[\s\S]*students\s*:/), "src/lg/data.js: students projection is missing");
check(hasRegex(data, /TABLE_SELECTS\s*=\s*\{[\s\S]*users\s*:/), "src/lg/data.js: users projection is missing");
check(hasRegex(data, /selectForTable\s*=\s*table\s*=>\s*TABLE_SELECTS\[table\]/), "src/lg/data.js: table projection resolver is missing");
check(hasRegex(data, /gdb\s*=\s*async\s+t\s*=>[\s\S]*?selectForTable\s*\(\s*t\s*\)/), "src/lg/data.js: shared gdb does not use the centralized projection resolver");
check(!hasRegex(data, /supabase\.from\(\s*t\s*\)\.select\(\s*["']\*["']\s*\)/), "src/lg/data.js: shared gdb must not issue wildcard reads");

// CRUD boundary.
check(hasRegex(data, /export const addR\s*=\s*async/), "src/lg/data.js: shared insert path missing");
check(hasRegex(data, /export const updR\s*=\s*async/), "src/lg/data.js: shared update path missing");
check(hasRegex(data, /export const delR\s*=\s*async/), "src/lg/data.js: shared delete path missing");
check(has(data, "Supabase insert failed"), "src/lg/data.js: shared insert failures are not surfaced");
check(has(data, "Supabase update failed"), "src/lg/data.js: shared update failures are not surfaced");
check(has(data, "Supabase delete failed"), "src/lg/data.js: shared delete failures are not surfaced");

// Timetable: projection, active filter, and role/membership scoping.
const timetableProjection = data.match(/const\s+select\s*=\s*["']([^"']+)["']/);
check(Boolean(timetableProjection), "src/lg/data.js: timetable projection is missing");
if (timetableProjection) {
  for (const field of ["id", "batch_id", "teacher_id", "status"]) check(timetableProjection[1].split(",").includes(field), `src/lg/data.js: timetable projection missing ${field}`);
}
check(hasRegex(data, /from\(["']timetable_entries["']\)\.select\(\s*select\s*\)/), "src/lg/data.js: timetable loader must use its verified projection");
check(hasRegex(data, /\.eq\(["']status["']\s*,?\s*["']active["']\s*\)/), "src/lg/data.js: timetable loader must keep active-status filtering");
check(hasRegex(data, /role\s*===\s*["']teacher["'][\s\S]*?\.eq\(["']teacher_id["']\s*,/), "src/lg/data.js: teacher timetable access must remain scoped");
check(hasRegex(data, /role\s*===\s*["']student["']\s*\|\|\s*role\s*===\s*["']parent["'][\s\S]*?batch_students/), "src/lg/data.js: student timetable access must remain membership-scoped");

// Parent route/lifecycle.
check(hasRegex(app, /ParentApp\s*\}\s*from\s*["']@\/lg\/parentWorkflows["']/), "src/routes/app.tsx: active parent route must use the scoped workflow");
check(has(app, "event.persisted"), "src/routes/app.tsx: BFCache restore handling is missing");
check(!hasRegex(app, /addEventListener\(\s*["']visibilitychange["']/), "src/routes/app.tsx: visibility changes must not remount the whole portal");

// Teacher payload contracts.
const profile = teacher.match(/from\(["']teachers["']\)\.select\(\s*["']([^"']+)["']\s*\)/);
check(Boolean(profile), "src/lg/teacherHomeworkApp.jsx: teacher profile read is missing");
if (profile) for (const field of ["id", "name", "tid", "subject", "phone", "status"]) check(profile[1].split(",").includes(field), `src/lg/teacherHomeworkApp.jsx: teacher profile projection missing ${field}`);
check(!hasRegex(teacher, /from\(["']teachers["']\)\.select\(\s*["']\*["']\s*\)/), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard profile read");
const homework = teacher.match(/from\(["']homework["']\)\.select\(\s*["']([^"']+)["']\s*\)/);
check(Boolean(homework), "src/lg/teacherHomeworkApp.jsx: teacher homework read is missing");
if (homework) for (const field of ["id", "batch_id", "subject", "desc", "given", "due", "tid", "created_at"]) check(homework[1].split(",").includes(field), `src/lg/teacherHomeworkApp.jsx: teacher homework projection missing ${field}`);
check(!hasRegex(teacher, /from\(["']homework["']\)\.select\(\s*["']\*["']\s*\)/), "src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard homework read");

// Login gateway.
const config = read("supabase/config.toml");
check(hasRegex(config, /\[functions\.auth-login\][\s\S]*?verify_jwt\s*=\s*false/i), "supabase/config.toml: auth-login must allow anonymous invocation before a session exists");

// Required security hardening migrations.
check(hasRegex(read("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql"), /drop extension if exists pg_graphql/i), "GraphQL hardening migration is missing");
check(hasRegex(read("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql"), /get_student_tests\(\)/i), "unused student RPC hardening migration is missing");

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
