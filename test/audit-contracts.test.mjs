import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("production contract check passes", () => {
  const result = spawnSync(process.execPath, ["scripts/production-contract-check.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("shared data layer keeps verified timetable projection and role scoping", () => {
  const data = read("src/lg/data.js");
  assert.match(data, /constselect=\"id,batch_id,teacher_id,subject_id,subject_name,day_of_week,start_time,end_time,status\"/);
  assert.match(data, /query=query\.eq\(\"teacher_id\",ref\)/);
  assert.match(data, /from\(\"batch_students\"\)\.select\(\"batch_id\"\)/);
  assert.doesNotMatch(data, /from\(t\)\.select\(\"\*\"\)/);
});

test("application route retains BFCache-safe portal refresh behavior", () => {
  const app = read("src/routes/app.tsx");
  assert.match(app, /event\.persisted/);
  assert.doesNotMatch(app, /visibilitychange/);
});
