import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const print = fs.readFileSync("src/admin/StudentReportCardPrint.tsx", "utf8");
const analytics = fs.readFileSync("src/admin/PeopleAnalyticsPage.tsx", "utf8");

test("student report card is a dedicated print document", () => {
  for (const label of ["Student Academic Report", "Student Name", "Academic Performance", "Examination Results", "Attendance", "Homework", "Leave Record", "Overall Performance", "Teacher / Institute Remarks", "Class Teacher", "Parent / Guardian", "Institute / Admin"]) {
    assert.match(print, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(print, /@page\{size:A4/);
  assert.doesNotMatch(print, /page-break-after:\s*always|break-after:\s*page/);
  assert.doesNotMatch(print, /Logout/);
  assert.doesNotMatch(print, /Dashboard/);
});

test("analytics page delegates PDF output to the dedicated report card", () => {
  assert.match(analytics, /StudentReportCardPrint/);
  assert.match(analytics, /window\.print\(\)/);
});
