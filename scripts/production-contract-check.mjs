import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const compact=s=>s.replace(/\s+/g,"");
const failures=[];
const check=(ok,msg)=>{if(!ok)failures.push(msg)};
const data=read("src/lg/data.js"), teacher=read("src/lg/teacherHomeworkApp.jsx"), app=read("src/routes/app.tsx"), config=read("supabase/config.toml");
const dc=compact(data),tc=compact(teacher);
// Projection contract: source-semantic checks, independent of Prettier formatting.
check(dc.includes("constTABLE_SELECTS=")||dc.includes("constTABLE_SELECTS={"),"src/lg/data.js: table projection map is missing");
check(/TABLE_SELECTS[\s\S]*students\s*:/.test(data),"src/lg/data.js: students projection is missing");
check(/TABLE_SELECTS[\s\S]*users\s*:/.test(data),"src/lg/data.js: users projection is missing");
check(dc.includes("constselectForTable=")||dc.includes("selectForTable=table=>"),"src/lg/data.js: table projection resolver is missing");
check(dc.includes("selectForTable(t)"),"src/lg/data.js: shared gdb does not use the centralized projection resolver");
check(!dc.includes('from(t).select("*")'),"src/lg/data.js: shared gdb must not issue wildcard reads");
// CRUD boundary.
for(const [token,msg] of [["export const addR","shared insert path missing"],["export const updR","shared update path missing"],["export const delR","shared delete path missing"],["Supabase insert failed","shared insert failures are not surfaced"],["Supabase update failed","shared update failures are not surfaced"],["Supabase delete failed","shared delete failures are not surfaced"]])check(data.includes(token),`src/lg/data.js: ${msg}`);
// Timetable access.
check(dc.includes('timetable_entries:"id,batch_id,teacher_id,subject_id,subject_name,day_of_week,start_time,end_time,status"'),"src/lg/data.js: timetable projection is missing");
check(dc.includes('from("timetable_entries").select(select)'),"src/lg/data.js: timetable loader must use its verified projection");
check(dc.includes('.eq("status","active")'),"src/lg/data.js: timetable loader must keep active-status filtering");
check(dc.includes('role==="teacher"&&ref){query=query.eq("teacher_id",ref)'),"src/lg/data.js: teacher timetable access must remain scoped");
check(dc.includes('role==="student"||role==="parent"')&&dc.includes('from("batch_students").select("batch_id")'),"src/lg/data.js: student timetable access must remain membership-scoped");
// Parent lifecycle.
check(app.includes("ParentApp")&&app.includes("@/lg/parentWorkflows"),"src/routes/app.tsx: active parent route must use the scoped workflow");
check(app.includes("event.persisted"),"src/routes/app.tsx: BFCache restore handling is missing");
check(!app.includes('addEventListener("visibilitychange"'),"src/routes/app.tsx: visibility changes must not remount the whole portal");
// Teacher payloads: inspect all Supabase reads and require the known columns.
const profile=/supabase\.from\("teachers"\)\.select\("([^"]+)"\)/.exec(teacher);
const homework=/supabase\.from\("homework"\)\.select\("([^"]+)"\)/.exec(teacher);
check(Boolean(profile),"src/lg/teacherHomeworkApp.jsx: teacher profile read is missing");
check(Boolean(profile&&["id","name","tid","subject","phone","classes","status"].every(f=>profile[1].split(",").map(x=>x.trim()).includes(f))),"src/lg/teacherHomeworkApp.jsx: teacher profile projection is incomplete");
check(!tc.includes('from("teachers").select("*")'),"src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard profile read");
check(Boolean(homework),"src/lg/teacherHomeworkApp.jsx: teacher homework read is missing");
check(Boolean(homework&&["id","batch_id","cls","sec","subject","desc","given","due","tid","pdfname","storage_path","file_size","mime_type","created_at"].every(f=>homework[1].split(",").map(x=>x.trim()).includes(f))),"src/lg/teacherHomeworkApp.jsx: teacher homework projection is incomplete");
check(!tc.includes('from("homework").select("*")'),"src/lg/teacherHomeworkApp.jsx: teacher portal still contains a wildcard homework read");
// Login gateway.
check(/\[functions\.auth-login\][\s\S]*?verify_jwt\s*=\s*false/i.test(config),"supabase/config.toml: auth-login must allow anonymous invocation before a session exists");
// Security migrations.
check(/drop extension if exists pg_graphql/i.test(read("supabase/migrations/20260901145800_phase4e_production_api_surface_hardening.sql")),"GraphQL hardening migration is missing");
check(/get_student_tests\(\)/i.test(read("supabase/migrations/20260901150300_phase4f_remove_unused_student_rpc_execution.sql")),"unused student RPC hardening migration is missing");
// Frontend security guards.
const files=[];const walk=dir=>{if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(["node_modules",".git","dist"].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(js|jsx|ts|tsx)$/.test(e.name))files.push(p)}};walk(path.join(root,"src"));
for(const file of files){const c=fs.readFileSync(file,"utf8");if(/service[_-]?role/i.test(c)&&/eyJ[A-Za-z0-9_-]{20,}/.test(c))failures.push(`${path.relative(root,file)}: possible service-role JWT embedded in frontend source`);if(/supabase\.rpc\(\s*["']get_student_(tests|test_results)["']/i.test(c))failures.push(`${path.relative(root,file)}: revoked student helper RPC is still called by frontend code`)}
if(failures.length){console.error("Production contract checks failed:");for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log("Production contract checks passed.");