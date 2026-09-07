import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const portal = fs.readFileSync("src/admin/ModernAdminPortal.tsx", "utf8");
const records = fs.readFileSync("src/admin/records/AdminRecordsPage.tsx", "utf8");

test("modern admin avoids global identity text rewriting", () => {
  assert.doesNotMatch(portal, /AdminIdentityLabels|IdentityLabels/);
});

test("student and teacher identity fields remain semantic", () => {
  assert.match(records, /\[\"sid\", r\.sid\]/);
  assert.match(records, /\[\"tid\", r\.tid\]/);
  assert.match(records, /\[\"phone\", r\.phone\]/);
  assert.doesNotMatch(records, /\[\"sid\", r\.name\]/);
  assert.doesNotMatch(records, /\[\"phone\", r\.name\]/);
  assert.match(records, /Student ID/);
});
