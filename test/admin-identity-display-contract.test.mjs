import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const portal = fs.readFileSync("src/admin/ModernAdminPortal.tsx", "utf8");
const records = fs.readFileSync("src/admin/records/AdminRecordsPage.tsx", "utf8");

// Display values must come from the record's semantic field. A global DOM
// replacement can turn roll numbers/phones into unrelated person names.
test("admin portal does not use global identity text rewriting", () => {
  assert.doesNotMatch(portal, /AdminIdentityLabels|IdentityLabels/);
});

test("student/teacher records keep identifier and phone fields separate", () => {
  assert.match(records, /\[\"sid\", r\.sid\]/);
  assert.match(records, /\[\"tid\", r\.tid\]/);
  assert.match(records, /\[\"phone\", r\.phone\]/);
  assert.doesNotMatch(records, /\[\"sid\", r\.name\]/);
  assert.doesNotMatch(records, /\[\"phone\", r\.name\]/);
});

test("user-facing labels do not call the student SID an SID", () => {
  assert.match(records, /Student ID/);
});
