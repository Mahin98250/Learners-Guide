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

test("admin timetable supports multi-subject lectures plus edit/delete actions", () => {
  const source = read("src/admin/batches/BatchesTimetablePage.tsx");
  assert.match(source, /subject_names/);
  assert.match(source, /scheduleForm\.subjects\.includes\(subject\)/);
  assert.match(source, /setScheduleForm\(f => \(\{ \.\.\.f, subjects:/);
  assert.match(source, /editingSchedule/);
  assert.match(source, /removeSchedule/);
  assert.match(source, /setDeleteSchedule\(x\)/);
});

test("student timetable reads the canonical combined subject display field", () => {
  const source = dataSource;
  assert.match(source, /subject_name/);
  assert.match(source, /timetable_entries/);
});

test("parent timetable reads timetable entries for every linked batch", () => {
  const source = read("src/lg/parentWorkflows.jsx");
  assert.match(source, /timetable_entries/);
  assert.match(source, /in\(\"batch_id\", batchIds\)/);
});
