import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function requirePattern(file, pattern, reason) {
  const content = read(file);
  if (!pattern.test(content)) failures.push(`${file}: ${reason}`);
}

function forbidPattern(file, pattern, reason) {
  const content = read(file);
  if (pattern.test(content)) failures.push(`${file}: ${reason}`);
}

const dataSource = read("src/lg/data.js");
const appSource = read("src/routes/app.tsx");
const teacherSource = read("src/lg/teacherHomeworkApp.jsx");

// Centralized read contract: gdb must resolve a table projection before querying.
requirePattern("src/lg/data.js", /TABLE_SELECTS\s*=\s*\{[\s\S]*students\s*:/, "table projection map is missing");
requirePattern("src/lg/data.js", /TABLE_SELECTS\s*=\s*\{[\s\S]*users\s*:/, "users projection is missing");
requirePattern("src/lg/data.js", /selectForTable\s*=\s*table\s*=>\s*TABLE_SELECTS\[table\]/, "table projection resolver is missing");
requirePattern("src/lg/data.js", /gdb\s*=\s*async\s+t\s*=>[\s\S]*selectForTable\(t\)/, "shared gdb does not use the centralized projection resolver");
forbidPattern("src/lg/data.js", /supabase\.from\(t\)\.select\(\s*["']\*["']\s*\)/, "shared gdb must not issue wildcard reads");

// CRUD boundary: keep the existing shared CRUD API and surfaced failures.
requirePattern("src/lg/data.js", /export const addR\s*=\s*async\s*\(/, "shared insert path missing");
requirePattern("src/lg/data.js", /export const updR\s*=\s*async\s*\(/, "shared update path missing");
requirePattern("src/lg/data.js", /export const delR\s*=\s*async\s*\(/, "shared delete path missing");
requirePattern("src/lg/data.js", /Supabase insert failed/, "shared insert failures are not surfaced");
requirePattern("src/lg/data.js", /Supabase update failed/, "shared update failures are not surfaced");
requirePattern("src/lg/data.js", /Supabase delete failed/, "shared delete failures are not surfaced");

// Timetable access must remain role-scoped and payload-scoped.
requirePattern("src/lg/data.js", /const select\s*=\s*["'][^"']*batch_id[^"']*teacher_id[^"']*status["']/, "timetable projection is missing required access fields");
requirePattern("src/lg/data.js", /from\(["']timetable_entries["']\)\.select\(select\)/, "timetable loader must use its verified projection");
requirePattern("src/lg/data.js", /\.eq\(["']status["']\s*,\s*["']active["']\)/, "timetable loader must keep active-status filtering");
requirePattern("src/lg/data.js", /role===\s*["']teacher["'][\s\S]*\.eq\(["']teacher_id["']/, "teacher timetable access must remain scoped");
requirePattern("src/lg/data.js", /role===\s*["']student["'][\s\S]*batch_students/, "student timetable access must remain membership-scoped");

// Active parent route and lifecycle behavior.
requirePattern("src/routes/app.tsx", /ParentApp\s*\}\s*from\s*["']@\/lg\/parentWorkflows["']/, "active parent route must use the scoped workflow");
requirePattern("src/routes/app.tsx", /event\.persisted/, "BFCache restore handling is missing");
forbidPattern("src/routes/app.tsx", /addEventListener\(\s*["']visibilitychange["']/, "visibility changes must not remount the whole portal");

// Teacher payload contracts: assert the required field sets without depending on formatter layout.
requirePattern("src/lg/teacherHomeworkApp.jsx", /from\(["']teachers["']\)\.select\(\s*["'][^"']*id[^"']*name[^"']*tid[^"']*subject[^"']*phone[^"']*status[^"']*["']\s*\)/, "teacher profile read must stay payload-scoped");
requirePattern("src/lg/teacherHomeworkApp.jsx", /from\(["']homework["']\)\.select\(\s*["'][^"']*id[^"']*batch_id[^"']*subject[^"']*desc[^"']*given[^"']*due[^"']*tid[^"']*created_at[^"']*["']\s*\)/, "teacher homework read must stay payload-scoped");
forbidPattern("src/lg/teacherHomeworkApp.jsx", /from\(["']teachers["']\)\.select\(\s*["']\*["']\s*\)/, "teacher portal still contains a wildcard profile read");
forbidPattern("src/lg/teacherHomeworkApp.jsx", /from\(["']homework["']\)\.select\(\s*["']\*["']\s*\)/, "teacher portal still contains a wildcard homework read");

// Required hardening migrations.
requirePattern("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql", /drop extension if exists pg_graphql/i, "GraphQL hardening migration is missing");
requirePattern("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql", /get_student_tests\(\)/, "unused student RPC hardening migration is missing");

// Frontend security guards.
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
  if (/service[_-]?role/i.test(content) && /eyJ[A-Za-z0-9_-]{20,}/.test(content)) failures.push(`${path.relative(root, file)}: possible service-role JWT embedded in frontend source`);
  if (/supabase\.rpc\(\s*["']get_student_(tests|test_results)["']/i.test(content)) failures.push(`${path.relative(root, file)}: revoked student helper RPC is still called by frontend code`);
}

if (failures.length) {
  console.error("Production contract checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Production contract checks passed: centralized projections, scoped portal payloads, active route boundary, BFCache recovery, CRUD integrity, privileged RPC boundaries and secret guards are intact.");
