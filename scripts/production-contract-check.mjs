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

requirePattern("src/lg/data.js", /export const gdb=async t=>[\s\S]*const select=selectForTable\(t\)/, "shared gdb reads must use centralized table projections");
requirePattern("src/lg/data.js", /const TABLE_SELECTS\s*=\s*\{[\s\S]*students:\s*["'][^"']+["'],[\s\S]*teachers:\s*["'][^"']+["'],[\s\S]*batches:\s*["'][^"']+["'],[\s\S]*batch_students:\s*["'][^"']+["'],[\s\S]*attendance:\s*["'][^"']+["'],[\s\S]*homework:\s*["'][^"']+["'],[\s\S]*materials:\s*["'][^"']+["'],[\s\S]*announcements:\s*["'][^"']+["'],[\s\S]*notifications:\s*["'][^"']+["'],[\s\S]*examschedule:\s*["'][^"']+["'],[\s\S]*subjects:\s*["'][^"']+["'],[\s\S]*material_folders:\s*["'][^"']+["'],[\s\S]*academic_years:\s*["'][^"']+["'],[\s\S]*rooms:\s*["'][^"']+["']/, "shared table projection map is missing or incomplete");
forbidPattern("src/lg/data.js", /const\{data,error\}=await supabase\.from\(t\)\.select\(\s*["']\*["']\s*\)/, "shared gdb must not issue wildcard reads");
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.insert\(\s*payload\s*\)/, "shared insert path missing");
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.update\(\s*payload\s*\)/, "shared update path missing");
requirePattern("src/lg/data.js", /supabase\.from\(t\)\.delete\(\s*\)/, "shared delete path missing");
requirePattern("src/lg/data.js", /Supabase insert failed/, "shared insert failures are not surfaced");

requirePattern("src/lg/data.js", /from\("timetable_entries"\)\.select\(\s*select\s*\)\.eq\("status","active"\)/, "timetable loader must use the verified projection");
requirePattern("src/routes/app.tsx", /ParentApp\s*\}\s*from\s*["']@\/lg\/parentWorkflows["']/, "active parent route must use the scoped workflow");
requirePattern("src/routes/app.tsx", /event\.persisted/, "BFCache restore handling is missing");
forbidPattern("src/routes/app.tsx", /addEventListener\(\s*["']visibilitychange["']/, "visibility changes must not remount the whole portal");

requirePattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']teachers["']\s*\)\.select\(\s*["']id,name,tid,subject,phone,classes,status["']\s*\)/, "teacher profile read must stay payload-scoped");
requirePattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']homework["']\s*\)\.select\(\s*["']id,batch_id,cls,sec,subject,desc,given,due,tid,pdfname,storage_path,file_size,mime_type,created_at["']\s*\)/, "teacher homework read must stay payload-scoped");
forbidPattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']teachers["']\s*\)\.select\(\s*["']\*["']\s*\)/, "teacher portal still contains a wildcard profile read");
forbidPattern("src/lg/teacherHomeworkApp.jsx", /from\(\s*["']homework["']\s*\)\.select\(\s*["']\*["']\s*\)/, "teacher portal still contains a wildcard homework read");

requirePattern("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql", /drop extension if exists pg_graphql/i, "GraphQL hardening migration is missing");
requirePattern("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql", /get_student_tests\(\)/, "unused student RPC hardening migration is missing");

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
