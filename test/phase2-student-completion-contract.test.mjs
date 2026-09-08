import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Student Phase 2 keeps retired results disabled", () => {
  const flags = read("src/lg/featureFlags.ts");
  assert.match(flags, /studentResults:\s*false/);
});

test("Student Phase 2 exposes a dedicated announcements view", () => {
  const home = read("src/lg/student.jsx");
  const announcements = read("src/lg/StudentAnnouncements.jsx");
  assert.match(home, /StudentAnnouncements/);
  assert.match(home, /Announcements & News/);
  assert.match(announcements, /\.from\("announcements"\)/);
  assert.match(announcements, /\.select\("id,title,desc,date,target,created_at"\)/);
  assert.match(announcements, /\.order\("created_at",\s*\{\s*ascending:\s*false\s*\}\)/);
  assert.match(announcements, /RLS is the source of truth/);
});
