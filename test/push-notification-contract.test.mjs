import assert from "node:assert/strict";
import fs from "node:fs";

const sw = fs.readFileSync("public/sw.js", "utf8");
const push = fs.readFileSync("supabase/functions/web-push/index.ts", "utf8");

assert.match(sw, /const CACHE = "learners-guide-v37"/);
assert.match(sw, /tag\s*=\s*payload\.notificationId/);
assert.match(sw, /getNotifications\(\{ tag \}\)/);
assert.match(sw, /renotify:\s*false/);
assert.match(sw, /notification\.data\?\.url/);
assert.match(sw, /clients\.openWindow\(target\)/);

assert.match(push, /onConflict:\s*"user_id,endpoint"/);
assert.match(push, /status === 404 \|\| status === 410/);
assert.match(push, /\.delete\(\)\.eq\("id", sub\.id\)/);
assert.match(push, /notificationId/);

console.log("Push notification reliability contract passed.");
