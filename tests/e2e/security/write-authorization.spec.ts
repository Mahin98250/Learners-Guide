import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "../helpers/observability";
import { e2ePassword } from "../helpers/auth";

const URL = process.env.E2E_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) throw new Error("[E2E security] Local Supabase URL and anon key are required.");
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)) {
  throw new Error(`[E2E security] Refusing non-local Supabase target: ${URL}`);
}

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

async function expectNoWrite(
  operation: Promise<{ data: unknown; error: unknown }>,
  label: string,
) {
  const result = await operation;
  expect(result.error || result.data === null || (Array.isArray(result.data) && result.data.length === 0), `${label} must be blocked`).toBeTruthy();
}

test.describe("RLS unauthorized writes @security", () => {
  test("student cannot modify another student's attendance, fees, marks, or homework", async () => {
    const c = await clientFor(users.student);

    await expectNoWrite(
      c.from("attendance").update({ status: "present" }).eq("id", "e2e-attendance-b").select("id"),
      "student attendance update",
    );
    await expectNoWrite(
      c.from("fees").update({ status: "paid" }).eq("id", "e2e-fee-b").select("id"),
      "student fee update",
    );
    await expectNoWrite(
      c.from("marks").update({ marks: 100 }).eq("id", "e2e-mark-b").select("id"),
      "student marks update",
    );
    await expectNoWrite(
      c.from("homework").update({ desc: "unauthorized" }).eq("id", "e2e-homework-b").select("id"),
      "student homework update",
    );
    await expectNoWrite(
      c.from("attendance").delete().eq("id", "e2e-attendance-b").select("id"),
      "student attendance delete",
    );
  });

  test("parent cannot mutate either linked child's academic records", async () => {
    const c = await clientFor(users.parent);

    await expectNoWrite(
      c.from("attendance").update({ status: "present" }).eq("id", "e2e-attendance-a").select("id"),
      "parent attendance update",
    );
    await expectNoWrite(
      c.from("fees").update({ status: "paid" }).eq("id", "e2e-fee-a").select("id"),
      "parent fee update",
    );
    await expectNoWrite(
      c.from("marks").update({ marks: 100 }).eq("id", "e2e-mark-a").select("id"),
      "parent marks update",
    );
    await expectNoWrite(
      c.from("homework").delete().eq("id", "e2e-homework-a").select("id"),
      "parent homework delete",
    );
  });

  test("teacher cannot mutate records outside assigned batch", async () => {
    const c = await clientFor(users.teacher);

    await expectNoWrite(
      c.from("homework").update({ desc: "unauthorized" }).eq("id", "e2e-homework-b").select("id"),
      "teacher homework update outside batch",
    );
    await expectNoWrite(
      c.from("materials").delete().eq("id", "e2e-material-b").select("id"),
      "teacher material delete outside batch",
    );
    await expectNoWrite(
      c.from("attendance").update({ status: "present" }).eq("id", "e2e-attendance-b").select("id"),
      "teacher attendance update outside batch",
    );
    await expectNoWrite(
      c.from("tests").update({ title: "unauthorized" }).eq("id", "e2e-test-b").select("id"),
      "teacher test update outside batch",
    );
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

      if (!result.error && Array.isArray(result.data) && result.data.length > 0) {
        throw new Error(`[E2E security] ${role} unexpectedly inserted a student; fixture cleanup is required.`);
      }
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
