import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("supabase/migrations/20260906170000_phase6_peak_query_indexes.sql", "utf8");

test("Phase 6: targeted production read indexes are preserved", () => {
  for (const indexName of [
    "idx_announcements_target_created",
    "idx_examschedule_cls_date",
    "idx_homework_legacy_class_section_created",
    "idx_students_class_section",
    "idx_timetable_teacher_active_day",
    "idx_timetable_batch_active_day",
  ]) {
    assert.match(source, new RegExp(`create index if not exists ${indexName}`));
  }
});

test("Phase 6: timetable and legacy homework indexes stay scoped to active/legacy rows", () => {
  assert.match(source, /idx_timetable_teacher_active_day[\s\S]*where status = 'active'/i);
  assert.match(source, /idx_timetable_batch_active_day[\s\S]*where status = 'active'/i);
  assert.match(source, /idx_homework_legacy_class_section_created[\s\S]*where batch_id is null/i);
});
