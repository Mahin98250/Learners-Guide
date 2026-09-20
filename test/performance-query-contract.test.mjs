import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const dataSource = [
  read("src/lg/data.js"),
  read("src/lg/data/index.ts"),
  read("src/lg/data/constants.ts"),
  read("src/lg/data/cache.ts"),
  read("src/lg/data/storage.ts"),
  read("src/lg/data/queries.js"),
  read("src/lg/data/mutations.js"),
].join("\n");

test("Performance: admin analytics keeps bounded explicit projections", () => {
  const source = read("src/admin/AdminAnalytics.tsx");
  assert.doesNotMatch(source, /supabase\.from\(\s*["']students["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /supabase\.from\(\s*["']teachers["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /supabase\.from\(\s*["']attendance["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /supabase\.from\(\s*["']marks["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.match(source, /DASHBOARD_SELECTS/);
  assert.match(source, /PROFILE_DETAIL_SELECTS/);
});

test("Performance: shared data layer coalesces concurrent table reads", () => {
  const source = dataSource;
  assert.match(source, /const inflight=new Map/);
  assert.match(source, /inflight\.has\(t\)/);
  assert.match(source, /inflight\.set\(t,request\)/);
  assert.match(source, /inflight\.delete\(t\)/);
});

test("Performance: shared memory cache has a bounded TTL and is reset on auth session changes", () => {
  const source = dataSource;
  assert.match(source, /const MEMORY_CACHE_TTL_MS=15_000/);
  assert.match(source, /expiresAt:Date\.now\(\)\+MEMORY_CACHE_TTL_MS/);
  assert.match(source, /onAuthStateChange\(\(event\)\s*=>\s*\{[^}]*SIGNED_IN[^}]*SIGNED_OUT[^}]*clearCache\(\)/s);
});

test("Performance: student timetable relies on the shared cache path", () => {
  const source = read("src/lg/student.jsx");
  assert.doesNotMatch(source, /const timetableCache=new Map/);
  assert.match(source, /gdb\("timetable"\)/);
});

test("Performance: known retired/compatibility path does not reintroduce wildcard profile reads", () => {
  const source = read("src/admin/AdminProfilePage.tsx");
  assert.doesNotMatch(source, /from\(\s*["']students["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /from\(\s*["']teachers["']\s*\)\.select\(\s*["']\*["']\s*\)/);
});

test("Performance: authenticated portal bundles are lazy-loaded after session discovery", () => {
  const source = read("src/routes/app.tsx");
  assert.match(source, /const TeacherAppWithHomeworkFiles\s*=\s*lazy\([\s\S]{0,220}?import\(\s*["']@\/lg\/teacherHomeworkApp["']\s*\)/);
  assert.match(source, /const StudentApp\s*=\s*lazy\([\s\S]{0,180}?import\(\s*["']@\/lg\/student["']\s*\)/);
  assert.match(source, /const ParentApp\s*=\s*lazy\([\s\S]{0,180}?import\(\s*["']@\/lg\/parentWorkflows["']\s*\)/);
  assert.doesNotMatch(source, /import \{ TeacherAppWithHomeworkFiles \} from/);
  assert.doesNotMatch(source, /import \{ StudentApp \} from/);
  assert.doesNotMatch(source, /import \{ ParentApp \} from/);
});

test("Performance: admin entry keeps login separate from the legacy panel tree", () => {
  const source = read("src/routes/admin.tsx");
  assert.match(source, /const AdminLogin\s*=\s*lazy\([\s\S]{0,180}?import\(\s*["']@\/admin\/AdminLogin["']\s*\)/);
  assert.match(source, /const AdminWithDrive\s*=\s*lazy\([\s\S]{0,180}?import\(\s*["']@\/admin\/AdminWithDrive["']\s*\)/);
  assert.doesNotMatch(source, /import \{ AdminLogin \} from/);
  assert.doesNotMatch(source, /import \{ AdminWithDrive \} from/);
  assert.doesNotMatch(source, /ReferenceAdminPanel/);
  const login = read("src/admin/AdminLogin.tsx");
  assert.match(login, /from ["']@\/lg\/ui\/branding["']/);
  assert.match(login, /from ["']@\/lg\/ui\/styles["']/);
  assert.match(login, /from ["']@\/lg\/data\/constants["']/);
  assert.doesNotMatch(login, /from ["']@\/lg\/ui["']/);
  assert.doesNotMatch(login, /from ["']@\/lg\/data["']/);
});
