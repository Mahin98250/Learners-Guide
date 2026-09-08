import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("Phase 5: app shell has startup recovery and role-specific portal routing", () => {
  const main = read("src/main.tsx");
  const app = read("src/routes/app.tsx");
  assert.match(main, /class AppErrorBoundary/);
  assert.match(main, /window\.location\.reload\(\)/);
  assert.match(main, /recoverRestoredMobileLayout/);
  assert.match(app, /user\.role === "teacher"/);
  assert.match(app, /user\.role === "student"/);
  assert.match(app, /user\.role === "parent"/);
});

test("Phase 5: auth validates server-managed role and linked/institute profile status", () => {
  const auth = read("src/lg/auth.js");
  assert.match(auth, /appMetadata = authUser\?\.app_metadata/);
  assert.match(auth, /appRole = authResult\.user\.app_metadata\?\.role/);
  assert.match(auth, /appRole !== role/);
  assert.match(auth, /inactiveStatuses/);
  assert.match(auth, /validateProfile\(user, role\)/);
});

test("Phase 5: shared data layer keeps explicit projections and scoped timetable reads", () => {
  const data = read("src/lg/data.js");
  assert.match(data, /TABLE_SELECTS/);
  assert.match(data, /selectForTable\(t\)/);
  assert.doesNotMatch(data, /from\(t\)\.select\(["']\*["']\)/);
  assert.match(data, /timetable_entries/);
  assert.match(data, /role===\"student\"\|\|role===\"parent\"/);
  assert.match(data, /query=query\.eq\(\"teacher_id\",ref\)/);
});

test("Phase 5: retired Messages UI remains suppressed without touching notifications", () => {
  const css = read("src/appbar-redesign.css");
  assert.match(css, /button\[title="Messages"\]/);
  assert.match(css, /display: none !important/);
  assert.doesNotMatch(css, /title="Notifications".*display: none/s);
});

test("Phase 5: timetable admin mutation regression protection is present", () => {
  const migration = "supabase/migrations/20260906150000_fix_timetable_admin_mutations_and_multi_subject_data.sql";
  assert.ok(fs.existsSync(migration), "Expected timetable admin mutation migration to be present");
  const sql = read(migration);
  assert.match(sql, /timetable_entries_update/);
  assert.match(sql, /timetable_entries_delete/);
  assert.match(sql, /app_metadata/);
  assert.match(sql, /subject_names/);
});

test("Phase 5: analytics keeps live data and the dedicated institute-report architecture", () => {
  const analytics = read("src/admin/PeopleAnalyticsPage.tsx");
  const report = read("src/admin/StudentReportCardPrint.tsx");
  const css = read("src/appbar-redesign.css");
  assert.match(analytics, /LOGO_IMG_SRC/);
  assert.match(analytics, /StudentReportCardPrint/);
  assert.match(analytics, /Generate PDF/);
  assert.match(analytics, /test_results/);
  assert.match(analytics, /resultKeys/);
  assert.match(analytics, /legacy\s*=\s*\(m\.data\s*\|\|\s*\[\]\)\s*\.filter/);
  assert.match(analytics, /subjectMap/);
  assert.match(analytics, /Detailed assessment history/);
  for (const label of ["Student Progress Report", "Student Information", "Subject Performance", "Assessment History", "Attendance by Month", "Homework & Practice", "Leave Record", "Overall Institute Review", "Teacher's Review", "Focus for Continued Improvement", "Parent / Guardian Acknowledgement"]) {
    assert.match(report, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(report, /@page\{size:A4/);
  assert.doesNotMatch(report, /page-break-after:\s*always|break-after:\s*page/);
  assert.doesNotMatch(report, /<img\b/i);
  assert.doesNotMatch(report, /Logout/);
  assert.doesNotMatch(report, /Dashboard/);
  assert.doesNotMatch(report, /Principal/);
  assert.doesNotMatch(report, /Class Teacher/);
  assert.match(css, /@media print/);
  assert.match(css, /@page\s*\{\s*margin:\s*0;/);
});
