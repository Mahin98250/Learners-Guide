import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "../helpers/observability";
import { e2ePassword } from "../helpers/auth";

const URL = process.env.E2E_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) throw new Error("[E2E security] Local Supabase URL and anon key are required.");
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)) {
  throw new Error(`[E2E security] Refusing non-local Supabase target: ${URL}`);
}

const ids = {
  A: "e2e-student-a",
  B: "e2e-student-b",
  C: "e2e-student-c",
  BA: "e2e-batch-a",
  BB: "e2e-batch-b",
  BC: "e2e-batch-c",
  teacher: "e2e-teacher-a",
};

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

async function expectNoWrite(client: SupabaseClient, operation: Promise<{ data: unknown; error: unknown }>, label: string) {
  const result = await operation;
  if (result.error) return;
  expect(result.data, `${label} should not return a written row`).toEqual([]);
}

test.describe("RLS unauthorized writes @security", () => {
  test("student cannot modify another student's attendance, fees, marks, or homework", async () => {
    const c = await clientFor(users.student);

    await expectNoWrite(c, c.from("attendance").update({ status: "present" }).eq("id", "e2e-attendance-b"), "student attendance update");
    await expectNoWrite(c, c.from("fees").update({ status: "paid" }).eq("id", "e2e-fee-b"), "student fee update");
    await expectNoWrite(c, c.from("marks").update({ marks: 100 }).eq("id", "e2e-mark-b"), "student marks update");
    await expectNoWrite(c, c.from("homework").update({ desc: "unauthorized" }).eq("id", "e2e-homework-b"), "student homework update");
    await expectNoWrite(c, c.from("attendance").delete().eq("id", "e2e-attendance-b"), "student attendance delete");
  });

  test("parent cannot mutate either linked child's academic records", async () => {
    const c = await clientFor(users.parent);

    await expectNoWrite(c, c.from("attendance").update({ status: "present" }).eq("id", "e2e-attendance-a"), "parent attendance update");
    await expectNoWrite(c, c.from("fees").update({ status: "paid" }).eq("id", "e2e-fee-a"), "parent fee update");
    await expectNoWrite(c, c.from("marks").update({ marks: 100 }).eq("id", "e2e-mark-a"), "parent marks update");
    await expectNoWrite(c, c.from("homework").delete().eq("id", "e2e-homework-a"), "parent homework delete");
  });

  test("teacher cannot mutate records outside assigned batch", async () => {
    const c = await clientFor(users.teacher);

    await expectNoWrite(c, c.from("homework").update({ desc: "unauthorized" }).eq("id", "e2e-homework-b"), "teacher homework update outside batch");
    await expectNoWrite(c, c.from("materials").delete().eq("id", "e2e-material-b"), "teacher material delete outside batch");
    await expectNoWrite(c, c.from("attendance").update({ status: "present" }).eq("id", "e2e-attendance-b"), "teacher attendance update outside batch");
    await expectNoWrite(c, c.from("tests").update({ title: "unauthorized" }).eq("id", "e2e-test-b"), "teacher test update outside batch");
  });

  test("non-admin roles cannot insert privileged student records", async () => {
    const student = await clientFor(users.student);
    const parent = await clientFor(users.parent);
    const teacher = await clientFor(users.teacher);

    for (const [role, client] of [["student", student], ["parent", parent], ["teacher", teacher]] as const) {
      const result = await client.from("students").insert({
        id: `e2e-forbidden-${role}`,
        name: "Forbidden",
        sid: `FORBIDDEN-${role}`,
        cls: "10",
        sec: "Z",
        status: "active",
      });
      expect(result.error || result.data?.length === 0, `${role} must not insert students`).toBeTruthy();
    }
  });

  test("admin can perform a controlled write and read it back", async () => {
    const admin = await clientFor(users.admin);
    const id = "e2e-admin-write-check";

    await admin.from("announcements").delete().eq("id", id);
    const inserted = await admin.from("announcements").insert({
      id,
      title: "E2E admin write check",
      desc: "temporary QA record",
      date: "2026-09-13",
      target: "all",
    }).select("id").single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.id).toBe(id);

    const readBack = await admin.from("announcements").select("id").eq("id", id).single();
    expect(readBack.error).toBeNull();
    expect(readBack.data?.id).toBe(id);

    const removed = await admin.from("announcements").delete().eq("id", id).select("id");
    expect(removed.error).toBeNull();
    expect(removed.data?.map((row) => row.id)).toEqual([id]);
  });
});
