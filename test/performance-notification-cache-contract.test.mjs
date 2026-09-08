import assert from "node:assert/strict";
import fs from "node:fs";

const cache = fs.readFileSync("src/lg/notificationFeedCache.js", "utf8");
const panel = fs.readFileSync("src/lg/ParentNotifications.jsx", "utf8");

assert.match(cache, /CACHE_TTL_MS\s*=\s*5_000/);
assert.match(cache, /const cache = new Map\(\)/);
assert.match(cache, /const inflight = new Map\(\)/);
assert.match(cache, /clearNotificationFeedCache/);
assert.match(panel, /getCachedNotificationFeed/);
assert.match(panel, /setCachedNotificationFeed/);
assert.match(panel, /getInflightNotificationFeed/);
assert.match(panel, /setInflightNotificationFeed/);
assert.match(panel, /clearNotificationFeedCache/);

console.log("Notification feed cache contract passed.");
