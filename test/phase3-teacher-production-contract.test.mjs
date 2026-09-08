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
assert.match(app,/key:"analytics"/);
assert.match(app,/key:"announcements"/);
assert.match(analytics,/\.from\("timetable_entries"\)/);
assert.match(analytics,/\.eq\("teacher_id",teacherId\)/);
assert.match(analytics,/\.in\("batch_id",ids\)/);
assert.match(analytics,/\.from\("batch_students"\)/);
assert.match(announcements,/\.from\("announcements"\)/);
assert.match(announcements,/\.order\("created_at",\{ascending:false\}\)/);
assert.match(homework,/selected\.subjects\.includes\(form\.subject\)/);
assert.match(homework,/\.eq\("tid",teacher\.id\)/);
assert.match(teacher,/\.eq\("teacher_id",teacherId\)/);
assert.match(teacher,/\.eq\("batch_id",active\.batch_id\)/);
assert.match(tests,/\.in\("batch_id",ids\)/);
assert.match(tests,/\.eq\("created_by",teacher\.id\)/);
assert.match(materials,/\.eq\("tid",teacher\.id\)/);
assert.match(materials,/teacher\/\$\{teacher\.id\}\/\$\{targetBatch\.id\}/);

console.log("Phase 3 Teacher Production Contract: PASS");
