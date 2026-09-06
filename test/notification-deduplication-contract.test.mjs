import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = "supabase/migrations/20260906163500_fix_duplicate_attendance_notification_trigger.sql";

test("notification delivery: attendance has only one notification trigger", () => {
  assert.ok(fs.existsSync(migration), "Expected attendance notification deduplication migration");
  const sql = fs.readFileSync(migration, "utf8");
  assert.match(sql, /drop trigger if exists notifications_attendance_change on public\.attendance/i);
  assert.doesNotMatch(sql, /create trigger notifications_attendance_change/i);
});
