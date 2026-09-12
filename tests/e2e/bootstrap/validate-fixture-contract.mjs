import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const baselinePath = path.join(root, "supabase", "schema-baseline", "production-derived-schema-baseline.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

if (baseline.artifact_type !== "PRODUCTION-DERIVED SCHEMA BASELINE") {
  throw new Error("[E2E fixture contract] Unexpected schema baseline artifact.");
}

const expected = {
  academic_years: ["id", "name", "start_date", "end_date", "status"],
  rooms: ["id", "name", "capacity", "status"],
  subjects: ["id", "name", "cls"],
  students: ["id", "name", "sid", "cls", "sec", "parentname", "parentphone", "status"],
  teachers: ["id", "name", "tid", "subject", "phone", "status"],
  users: ["id", "name", "phone", "email", "role", "ref", "auth_id", "status"],
  batches: ["id", "name", "cls", "sec", "days", "subjects", "teacherids", "studentids", "description", "status", "academic_year_id", "code", "room_id", "active"],
  batch_students: ["batch_id", "student_id", "status"],
  parent_student_links: ["parent_auth_id", "student_id", "status"],
  timetable_entries: ["id", "academic_year_id", "batch_id", "teacher_id", "subject_id", "subject_name", "room_id", "day_of_week", "start_time", "end_time", "status", "notes"],
  attendance: ["id", "sid", "date", "status", "by"],
  homework: ["id", "cls", "sec", "subject", "desc", "due", "tid", "batch_id"],
  materials: ["id", "cls", "sec", "subject", "title", "desc", "date", "tid", "batch_id"],
  fees: ["id", "sid", "desc", "amount", "due", "status"],
  marks: ["id", "sid", "subject", "exam", "marks", "total", "date", "tid"],
  announcements: ["id", "title", "desc", "date", "target"],
  notifications: ["id", "title", "desc", "time", "type", "read", "uid"],
  batch_teachers: ["batch_id", "teacher_id", "subject_id", "subject_name", "status"],
  tests: ["id", "title", "description", "batch_id", "subject", "test_date", "total_marks", "status", "created_by"],
  test_results: ["id", "test_id", "student_id", "marks", "remarks"],
};

const actual = new Map();
for (const column of baseline.columns ?? []) {
  if (column.schema !== "public") continue;
  if (!actual.has(column.table)) actual.set(column.table, new Set());
  actual.get(column.table).add(column.column);
}

const missing = [];
for (const [table, columns] of Object.entries(expected)) {
  const actualColumns = actual.get(table);
  if (!actualColumns) {
    missing.push(`table public.${table}`);
    continue;
  }
  for (const column of columns) {
    if (!actualColumns.has(column)) missing.push(`column public.${table}.${column}`);
  }
}

if (missing.length) {
  throw new Error(`[E2E fixture contract] Baseline is incompatible with deterministic fixtures:\n${missing.map((item) => ` - ${item}`).join("\n")}`);
}

console.log(`[E2E fixture contract] PASS — ${Object.keys(expected).length} seeded tables and ${Object.values(expected).reduce((sum, columns) => sum + columns.length, 0)} required columns are present in the production-derived baseline.`);
