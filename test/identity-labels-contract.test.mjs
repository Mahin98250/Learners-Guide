import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adminIdentity = fs.readFileSync("src/admin/AdminIdentityLabels.tsx", "utf8");
const identity = fs.readFileSync("src/lg/IdentityLabels.jsx", "utf8");

test("identity labels do not globally convert roll numbers or phone values to names", () => {
  assert.match(adminIdentity, /IdentityLabels rootSelector=\"\.admin\"/);
  assert.match(identity, /replaceAll\(`Batch \$\{id\}`, name\)/);
  assert.doesNotMatch(identity, /maps\.student\.get\(trimmed\).*phone/);
  assert.doesNotMatch(identity, /for \(const \[id, name\] of maps\.student\)[\s\S]*replaceAll\(id, name\)/);
});

test("identity labels only translate internal record ids", () => {
  assert.match(identity, /const id = clean\(row\.id\)/);
  assert.match(identity, /Student ID: \$\{id\}/);
  assert.match(identity, /Teacher ID: \$\{id\}/);
  assert.match(identity, /batch_id: \$\{id\}/);
});
