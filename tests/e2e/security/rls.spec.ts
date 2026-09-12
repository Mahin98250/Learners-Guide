import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "../helpers/observability";
import { e2ePassword } from "../helpers/auth";

const URL = process.env.E2E_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) throw new Error("[E2E security] Local Supabase URL and anon key are required.");
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)) throw new Error(`[E2E security] Refusing non-local Supabase target: ${URL}`);

const ids = { A: "e2e-student-a", B: "e2e-student-b", C: "e2e-student-c", BA: "e2e-batch-a", BB: "e2e-batch-b", BC: "e2e-batch-c" };
const users = {
  student: "e2e.student.a@example.invalid",
  teacher: "e2e.teacher.a@example.invalid",
  parent: "e2e.parent.multichild@example.invalid",
  admin: "e2e.admin@example.invalid",
};

async function clientFor(email: string) {
  const client = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: e2ePassword() });
  if (error) throw error;
  return client;
}

async function idsFor(client: SupabaseClient, table: string, column: string, values: string[]) {
  const { data, error } = await client.from(table).select(column).in(column, values);
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => String(row[column]));
}

async function batchIdsFor(client: SupabaseClient, table: string) {
  const { data, error } = await client.from(table).select("batch_id");
  if (error) throw error;
  return (data || []).map((row) => String(row.batch_id));
}

test.describe("RLS authorization", () => {
  test("student A can see only student A data across sensitive entities", async () => {
    const c = await clientFor(users.student);
    expect(await idsFor(c, "students", "id", [ids.A, ids.B, ids.C])).toEqual([ids.A]);
    expect(await idsFor(c, "attendance", "sid", [ids.A, ids.B, ids.C])).toEqual([ids.A]);
    expect(await idsFor(c, "fees", "sid", [ids.A, ids.B, ids.C])).toEqual([ids.A]);
    expect(await idsFor(c, "marks", "sid", [ids.A, ids.B, ids.C])).toEqual([ids.A]);
    expect((await batchIdsFor(c, "homework")).every((id) => id === ids.BA)).toBe(true);
    expect((await batchIdsFor(c, "materials")).every((id) => id === ids.BA)).toBe(true);
    expect((await batchIdsFor(c, "timetable_entries")).every((id) => id === ids.BA)).toBe(true);
    expect((await batchIdsFor(c, "tests")).every((id) => id === ids.BA)).toBe(true);
    const { data: results, error } = await c.from("test_results").select("student_id");
    if (error) throw error;
    expect((results || []).every((r) => r.student_id === ids.A)).toBe(true);
  });

  test("multi-child parent sees A and B but never unrelated C", async () => {
    const c = await clientFor(users.parent);
    const visibleStudents = await idsFor(c, "students", "id", [ids.A, ids.B, ids.C]);
    expect(visibleStudents).toEqual(expect.arrayContaining([ids.A, ids.B]));
    expect(visibleStudents).not.toContain(ids.C);
    expect(await idsFor(c, "attendance", "sid", [ids.A, ids.B, ids.C])).not.toContain(ids.C);
    expect(await idsFor(c, "fees", "sid", [ids.A, ids.B, ids.C])).not.toContain(ids.C);
    expect(await idsFor(c, "marks", "sid", [ids.A, ids.B, ids.C])).not.toContain(ids.C);
    expect((await batchIdsFor(c, "homework")).every((id) => [ids.BA, ids.BB].includes(id))).toBe(true);
    expect((await batchIdsFor(c, "materials")).every((id) => [ids.BA, ids.BB].includes(id))).toBe(true);
    expect((await batchIdsFor(c, "timetable_entries")).every((id) => [ids.BA, ids.BB].includes(id))).toBe(true);
    expect((await batchIdsFor(c, "tests")).every((id) => [ids.BA, ids.BB].includes(id))).toBe(true);
    const { data: results, error } = await c.from("test_results").select("student_id");
    if (error) throw error;
    expect((results || []).every((r) => [ids.A, ids.B].includes(String(r.student_id)))).toBe(true);
  });

  test("teacher A is scoped to assigned batch A", async () => {
    const c = await clientFor(users.teacher);
    expect(await idsFor(c, "students", "id", [ids.A, ids.B, ids.C])).toEqual([ids.A]);
    expect((await batchIdsFor(c, "homework")).every((id) => id === ids.BA)).toBe(true);
    expect((await batchIdsFor(c, "materials")).every((id) => id === ids.BA)).toBe(true);
    expect((await batchIdsFor(c, "timetable_entries")).every((id) => id === ids.BA)).toBe(true);
    expect((await batchIdsFor(c, "tests")).every((id) => id === ids.BA)).toBe(true);
  });

  test("admin can see the synthetic QA dataset", async () => {
    const c = await clientFor(users.admin);
    expect(await idsFor(c, "students", "id", [ids.A, ids.B, ids.C])).toEqual(expect.arrayContaining([ids.A, ids.B, ids.C]));
  });
});
