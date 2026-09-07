import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const report = fs.readFileSync("src/admin/StudentReportCardPrintV2.tsx", "utf8");
const bridge = fs.readFileSync("src/admin/PeopleAnalyticsReportBridge.tsx", "utf8");

test("report card uses the compact three-page reference layout", () => {
  assert.match(report, /Student Progress Portfolio/);
  assert.match(report, /Official Student Report Card/);
  assert.match(report, /Academic Performance/);
  assert.match(report, /Assessment History/);
  assert.match(report, /Homework & Learning Engagement/);
  assert.match(report, /Teacher & Parent Review/);
  assert.match(report, /Growth Plan & Next Steps/);
  assert.match(report, /Academic Head \/ Principal/);
  assert.match(report, /Page 1 of 3/);
  assert.match(report, /Page 2 of 3/);
  assert.match(report, /Page 3 of 3/);
  assert.match(report, /\.rc-page\{position:relative;width:100%;height:281mm/);
  assert.match(report, /\.rc-page:last-child\{break-after:auto;page-break-after:auto\}/);
});

test("report card keeps print output separate from the admin shell", () => {
  assert.match(bridge, /StudentReportCardPrintV2/);
  assert.match(bridge, /window\.print\(\)/);
  assert.doesNotMatch(report, /modern-admin-sidebar/);
  assert.doesNotMatch(report, /Logout/);
  assert.doesNotMatch(report, /Dashboard/);
  assert.match(report, /LOGO_IMG_SRC/);
});
