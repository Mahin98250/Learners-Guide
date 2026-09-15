import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("[E2E domain seed] Local Supabase credentials are required.");

const url = new URL(supabaseUrl);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.hostname.includes("efnxjfzyqbdulpjhffsm")) {
  throw new Error(`[E2E domain seed] Refusing non-local Supabase target: ${url.origin}`);
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function must(result, label) {
  if (result.error) throw new Error(`[E2E domain seed] ${label}: ${result.error.message}`);
  return result.data;
}

const SUBJECT = "e2e-subject";
const TEACHER = "e2e-teacher-a";
const BATCH_A = "e2e-batch-a";
const BATCH_B = "e2e-batch-b";
const TEST_A = "e2e-test-a";
const TEST_B = "e2e-test-b";
const RESULT_A = "e2e-result-a";

// These rows deliberately exercise the newer batch-teacher/test-result authorization
// paths that the primary fixture does not need for basic portal smoke coverage.
await must(await admin.from("batch_teachers").upsert([
  { batch_id: BATCH_A, teacher_id: TEACHER, subject_id: SUBJECT, subject_name: "E2E Mathematics", status: "active" },
], { onConflict: "batch_id,teacher_id,subject_id" }), "seed batch-teacher assignment");

await must(await admin.from("tests").upsert([
  { id: TEST_A, title: "E2E Test A", description: "E2E student/teacher test", batch_id: BATCH_A, subject: "E2E Mathematics", test_date: "2026-09-25", total_marks: 100, status: "scheduled", created_by: TEACHER },
  { id: TEST_B, title: "E2E Test B", description: "E2E unrelated batch test", batch_id: BATCH_B, subject: "E2E Mathematics", test_date: "2026-09-26", total_marks: 100, status: "scheduled", created_by: TEACHER },
], { onConflict: "id" }), "seed tests");

await must(await admin.from("test_results").upsert([
  { id: RESULT_A, test_id: TEST_A, student_id: "e2e-student-a", marks: 91, remarks: "E2E result" },
], { onConflict: "id" }), "seed test result");

console.log(JSON.stringify({ status: "domain-fixtures-seeded", batchTeachers: 1, tests: 2, testResults: 1 }, null, 2));
