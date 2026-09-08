import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const print = fs.readFileSync("src/admin/StudentReportCardPrint.tsx", "utf8");
const analytics = fs.readFileSync("src/admin/PeopleAnalyticsPage.tsx", "utf8");

test("student report is a standalone institute progress document", () => {
  for (const label of [
    "Student Progress Report",
    "Student Information",
    "Subject Performance",
    "Assessment History",
    "Attendance by Month",
    "Homework & Practice",
    "Leave Record",
    "Overall Institute Review",
    "Teacher's Review",
    "Focus for Continued Improvement",
    "Parent / Guardian Acknowledgement",
    "Teacher",
  ]) {
    assert.match(print, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(print, /@page\{size:A4/);
  assert.doesNotMatch(print, /page-break-after:\s*always|break-after:\s*page/);
  assert.doesNotMatch(print, /<img\b/i);
  assert.doesNotMatch(print, /Logout/);
  assert.doesNotMatch(print, /Dashboard/);
  assert.doesNotMatch(print, /Back/);
  assert.doesNotMatch(print, /Principal/);
  assert.doesNotMatch(print, /Class Teacher/);
  assert.doesNotMatch(print, /Institute \/ Administrator/);
  assert.match(print, /rc-signatures[^`]*grid-template-columns:1fr 1fr/);
});

test("analytics page delegates PDF output to the dedicated report", () => {
  assert.match(analytics, /StudentReportCardPrint/);
  assert.match(analytics, /window\.print\(\)/);
});
