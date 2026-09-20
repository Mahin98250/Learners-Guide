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

const timetableSource = [
  read("src/admin/batches/BatchesTimetablePage.tsx"),
  read("src/admin/batches/BatchesTimetableConstants.ts"),
  read("src/admin/batches/BatchesTimetableControls.tsx"),
].join("\n");

test("admin timetable supports multi-subject lectures plus edit/delete actions", () => {
  assert.match(timetableSource, /subject_names/);
  assert.match(timetableSource, /scheduleForm\.subjects\.includes\(subject\)/);
  assert.match(timetableSource, /setScheduleForm\(f => \(\{ \.\.\.f, subjects:/);
  assert.match(timetableSource, /editingSchedule/);
  assert.match(timetableSource, /removeSchedule/);
  assert.match(timetableSource, /setDeleteSchedule\(x\)/);
});

test("admin timetable keeps constants and reusable controls outside the page orchestrator", () => {
  const page = read("src/admin/batches/BatchesTimetablePage.tsx");
  const constants = read("src/admin/batches/BatchesTimetableConstants.ts");
  const controls = read("src/admin/batches/BatchesTimetableControls.tsx");

  assert.match(page, /BatchesTimetableConstants/);
  assert.match(page, /BatchesTimetableControls/);
  assert.doesNotMatch(page, /const CLASSES =/);
  assert.doesNotMatch(page, /function Button\(/);
  assert.match(constants, /export const CLASSES/);
  assert.match(constants, /export const SUBJECTS/);
  assert.match(controls, /export function Button/);
  assert.match(controls, /export function Field/);
  assert.match(controls, /export function Modal/);
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
