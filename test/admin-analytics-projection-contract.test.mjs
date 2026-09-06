import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("Admin analytics keeps explicit projections and avoids wildcard reads", () => {
  const source = read("src/admin/AdminAnalytics.tsx");
  assert.match(source, /DASHBOARD_SELECTS/);
  assert.match(source, /PROFILE_SELECTS/);
  assert.match(source, /PROFILE_DETAIL_SELECTS/);
  assert.doesNotMatch(source, /supabase\.from\(["'](?:students|teachers|attendance|fees|homework|announcements|marks|examschedule|timetable)["']\)\.select\(["']\*["']\)/);
  assert.doesNotMatch(source, /supabase\.from\(["']students["']\)\.select\(["']\*["']\)/);
  assert.doesNotMatch(source, /supabase\.from\(["']teachers["']\)\.select\(["']\*["']\)/);
});
