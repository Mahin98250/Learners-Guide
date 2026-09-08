import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lg/parentWorkflows.jsx", "utf8");

assert.match(source, /import \{ lazy, Suspense/);
assert.match(source, /lazy\(\(\) => import\("@\/lg\/ParentHomework"\)/);
assert.match(source, /lazy\(\(\) => import\("@\/lg\/ParentAnalytics"\)/);
assert.match(source, /lazy\(\(\) => import\("@\/lg\/ParentNotifications"\)/);
assert.match(source, /<Suspense fallback=\{SECTION_FALLBACK\}><ParentHomework/);
assert.match(source, /<Suspense fallback=\{SECTION_FALLBACK\}><ParentAnalytics/);
assert.match(source, /<Suspense fallback=\{null\}><ParentNotifications/);

console.log("Parent lazy-loading performance contract passed.");
