import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("Performance 10X: startup HTML does not inline duplicate image payloads", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /href="data:image\//);
  assert.match(read("src/lg/ui/branding.jsx"), /mahin-icon\.svg/);
  assert.match(html, /pwa-icon\.svg/);
  assert.match(html, /preconnect[^>]+supabase\.co/);
});

test("Performance 10X: canonical student portal defers heavy study/result/notification modules", () => {
  const route = read("src/routes/app.tsx");
  const app = read("src/lg/StudentAppFixed.jsx");
  assert.match(route, /@\/lg\/StudentAppFixed/);
  assert.match(app, /lazy\(\(\) => import\("@\/lg\/StudentSecondaryPages"/);
  assert.match(app, /lazy\(\(\) => import\("@\/lg\/studentResults"/);
  assert.match(app, /lazy\(\(\) => import\("@\/lg\/studentAttendance"/);
  assert.match(app, /lazy\(\(\) => import\("@\/lg\/panels"/);
  assert.ok(app.length < 5000, "student shell should stay small enough for fast first paint");
});

test("Performance 10X: login shell does not await tenant branding before becoming interactive", () => {
  const source = read("src/routes/index.tsx");
  assert.match(source, /void resolveInstituteForCurrentHostname\(\)/);
  assert.doesNotMatch(source, /await tenantPromise/);
});

test("Performance 10X: admin unread badge requests a count, not all rows", () => {
  const source = read("src/admin/ModernAdminPortal.tsx");
  assert.match(source, /select\("id",\{count:"exact",head:true\}\)/);
  assert.doesNotMatch(source, /from\("notifications"\)\.select\("id"\)\.eq\("uid",user\.id\)/);
});
test("Performance 10X: teacher shell defers upload and secondary workflows", () => {
  const source = read("src/lg/teacherHomeworkApp.jsx");
  assert.match(source, /TeacherHomeworkPage/);
  assert.match(source, /@\/lg\/teacherWorkflows/);
  assert.match(source, /@\/lg\/teacherTests/);
  assert.match(source, /@\/lg\/TeacherAnnouncements/);
  assert.match(source, /@\/lg\/panels/);
  assert.ok(source.length < 4000, "teacher shell should stay small enough for fast first paint");
});

test("Performance 10X: large unused binary asset is absent", () => {
  const treeUrl = "public/file_00000000451c82118020d2baea54f76b.png";
  assert.throws(() => fs.readFileSync(treeUrl));
});

test("Performance 10X: parent secondary data is loaded on-demand", () => {
  const source = read("src/lg/parentWorkflows.jsx");
  assert.match(source, /sectionLoadedRef/);
  assert.match(source, /tab !== "attendance" && tab !== "homework" && tab !== "timetable" && tab !== "fees"/);
  assert.match(source, /from\("attendance"\)[\s\S]{0,260}?select\("id,sid,date,status,by,created_at"\)/);
  assert.match(source, /from\("homework"\)[\s\S]{0,260}?select\("id,batch_id,subject,desc,given,due,created_at,pdfname"\)/);
  assert.match(source, /from\("timetable_entries"\)[\s\S]{0,260}?select\("id,batch_id,subject_name,start_time,end_time,status,day_of_week"\)/);
  assert.match(source, /from\("fees"\)[\s\S]{0,220}?select\("id,sid,desc,amount,status,due"\)/);
  assert.doesNotMatch(source, /from\("fees"\)[\s\S]{0,260}Promise\.all/);
  assert.doesNotMatch(source, /from\("timetable_entries"\)[\s\S]{0,260}Promise\.all/);
});
test("Performance 10X: offline cache implementation is idle-loaded", () => {
  const source = read("src/main.tsx");
  assert.doesNotMatch(source, /import .*offlineMaterials/);
  assert.match(source, /defer\(\(\) => \{\s*void import\("@\/lg\/offlineMaterials"\)/);
});
