import assert from "node:assert/strict";
import fs from "node:fs";

const portal = fs.readFileSync("src/admin/ModernAdminPortal.tsx", "utf8");
const page = fs.readFileSync("src/admin/ModernAdminSectionPages.tsx", "utf8");

assert.match(portal, /ModernAdminSectionPage/);
assert.match(portal, /special: "attendance"/);
assert.match(portal, /special: "results"/);
assert.match(portal, /special: "marks"/);
assert.match(portal, /special: "fees"/);
assert.match(portal, /special: "accounts"/);
assert.match(portal, /special: "profiles"/);
assert.match(portal, /special: "analytics"/);
assert.doesNotMatch(portal, /ReferenceAdminPanel/);

for (const label of ["Attendance Center", "Student Results Center", "Marks & Performance Overview", "Fees & Collections", "User Accounts & Access", "Search Profiles", "Institute Analytics"]) {
  assert.match(page, new RegExp(label.replace(/[&]/g, "\\&")));
}

for (const label of ["Roll No", "Student attendance", "Subject performance", "Collection health", "Executive summary"]) {
  assert.match(page, new RegExp(label));
}

console.log("modern admin sections contract: passed");
