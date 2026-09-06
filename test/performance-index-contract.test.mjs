import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const compact = (value) => value.replace(/[\s\uFEFF\u200B-\u200D]+/g, "").toLowerCase();

const migration = "supabase/migrations/20260906130000_phase4b_index_batch_teachers_subject_id.sql";
const sql = compact(read(migration));

test("Phase 4B keeps the batch_teachers.subject_id foreign-key index contract", () => {
  assert.ok(sql.includes(compact("create index if not exists idx_batch_teachers_subject on public.batch_teachers using btree (subject_id);")));
});

test("Phase 4B does not silently remove informational unused indexes", () => {
  assert.equal(/drop\s+index/i.test(sql), false);
  assert.equal(/drop\s+index\s+if\s+exists/i.test(sql), false);
});
