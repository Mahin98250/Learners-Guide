import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const app=read("src/lg/teacherHomeworkApp.jsx");
const teacher=read("src/lg/teacher.jsx");
const homework=app;
const tests=read("src/lg/teacherTests.jsx");
const materials=read("src/lg/teacherWorkflows.jsx");
const analytics=read("src/lg/TeacherAnalytics.jsx");
const announcements=read("src/lg/TeacherAnnouncements.jsx");

assert.match(app,/TeacherAnalytics/);
assert.match(app,/TeacherAnnouncements/);
assert.match(app,/key:\s*"analytics"/);
assert.match(app,/key:\s*"announcements"/);
assert.match(analytics,/\.from\(\s*"timetable_entries"\s*\)/);
assert.match(analytics,/\.eq\(\s*"teacher_id"\s*,\s*teacherId\s*\)/);
assert.match(analytics,/\.in\(\s*"batch_id"\s*,\s*ids\s*\)/);
assert.match(analytics,/\.from\(\s*"batch_students"\s*\)/);
assert.match(announcements,/\.from\(\s*"announcements"\s*\)/);
assert.match(announcements,/\.order\(\s*"created_at"\s*,\s*\{\s*ascending:\s*false\s*\}\s*\)/);
assert.match(homework,/selected\.subjects\.includes\(form\.subject\)/);
assert.match(homework,/\.eq\(\s*"tid"\s*,\s*teacher\.id\s*\)/);
assert.match(teacher,/\.eq\(\s*"teacher_id"\s*,\s*teacherId\s*\)/);
assert.match(teacher,/\.eq\(\s*"batch_id"\s*,\s*active\.batch_id\s*\)/);
assert.match(tests,/\.in\(\s*"batch_id"\s*,\s*ids\s*\)/);
assert.match(tests,/\.eq\(\s*"created_by"\s*,\s*teacher\.id\s*\)/);
assert.match(materials,/\.eq\(\s*"tid"\s*,\s*teacher\.id\s*\)/);
assert.match(materials,/teacher\/\$\{teacher\.id\}\/\$\{targetBatch\.id\}/);

console.log("Phase 3 Teacher Production Contract: PASS");
