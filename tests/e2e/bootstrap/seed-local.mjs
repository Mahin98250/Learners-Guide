import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;

if (!supabaseUrl || !serviceKey || !password) {
  throw new Error("[E2E seed] E2E_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and E2E_TEST_PASSWORD are required.");
}

const url = new URL(supabaseUrl);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.hostname.includes("efnxjfzyqbdulpjhffsm")) {
  throw new Error(`[E2E seed] Refusing non-local Supabase target: ${url.origin}`);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const USERS = {
  studentA: { email: "e2e.student.a@example.invalid", role: "student", ref: "e2e-student-a" },
  studentB: { email: "e2e.student.b@example.invalid", role: "student", ref: "e2e-student-b" },
  studentC: { email: "e2e.student.c@example.invalid", role: "student", ref: "e2e-student-c" },
  teacherA: { email: "e2e.teacher.a@example.invalid", role: "teacher", ref: "e2e-teacher-a" },
  parentA: { email: "e2e.parent.multichild@example.invalid", role: "parent", ref: "e2e-student-a" },
  admin: { email: "e2e.admin@example.invalid", role: "admin", ref: null },
};

const BATCH_A = "e2e-batch-a";
const BATCH_B = "e2e-batch-b";
const BATCH_C = "e2e-batch-c";
const YEAR = "e2e-year";
const ROOM = "e2e-room";
const SUBJECT = "e2e-subject";

async function must(result, label) {
  if (result.error) throw new Error(`[E2E seed] ${label}: ${result.error.message}`);
  return result.data;
}

async function removeExistingAuthUsers() {
  let page = 1;
  while (true) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = await must(result, "list auth users");
    const matches = users.users.filter((user) => Object.values(USERS).some((entry) => entry.email === user.email));
    for (const user of matches) await must(await admin.auth.admin.deleteUser(user.id), `delete auth user ${user.email}`);
    if (users.users.length < 1000) break;
    page += 1;
  }
}

async function clearData() {
  await must(await admin.from("parent_student_links").delete().in("student_id", [USERS.studentA.ref, USERS.studentB.ref, USERS.studentC.ref]), "clear parent links");
  await must(await admin.from("notifications").delete().like("id", "e2e-%"), "clear notifications");
  await must(await admin.from("announcements").delete().like("id", "e2e-%"), "clear announcements");
  await must(await admin.from("marks").delete().like("id", "e2e-%"), "clear marks");
  await must(await admin.from("fees").delete().like("id", "e2e-%"), "clear fees");
  await must(await admin.from("attendance").delete().like("id", "e2e-%"), "clear attendance");
  await must(await admin.from("materials").delete().like("id", "e2e-%"), "clear materials");
  await must(await admin.from("homework").delete().like("id", "e2e-%"), "clear homework");
  await must(await admin.from("timetable_entries").delete().like("id", "e2e-%"), "clear timetable");
  await must(await admin.from("batch_students").delete().in("batch_id", [BATCH_A, BATCH_B, BATCH_C]), "clear batch memberships");
  await must(await admin.from("batches").delete().in("id", [BATCH_A, BATCH_B, BATCH_C]), "clear batches");
  await must(await admin.from("teachers").delete().eq("id", USERS.teacherA.ref), "clear teacher");
  await must(await admin.from("students").delete().in("id", [USERS.studentA.ref, USERS.studentB.ref, USERS.studentC.ref]), "clear students");
  await must(await admin.from("users").delete().like("id", "e2e-%"), "clear users");
  await must(await admin.from("academic_years").delete().eq("id", YEAR), "clear academic year");
  await must(await admin.from("rooms").delete().eq("id", ROOM), "clear room");
  await must(await admin.from("subjects").delete().eq("id", SUBJECT), "clear subject");
}

async function createAuthUser(entry, name, phone) {
  const result = await admin.auth.admin.createUser({
    email: entry.email,
    password,
    email_confirm: true,
    app_metadata: { role: entry.role, ...(entry.ref ? { ref: entry.ref } : {}) },
    user_metadata: { name, phone },
  });
  return must(result, `create ${entry.role} auth user`);
}

await removeExistingAuthUsers();
await clearData();

const studentA = await createAuthUser(USERS.studentA, "E2E Student A", "9000000001");
const studentB = await createAuthUser(USERS.studentB, "E2E Student B", "9000000002");
const studentC = await createAuthUser(USERS.studentC, "E2E Student C", "9000000003");
const teacherA = await createAuthUser(USERS.teacherA, "E2E Teacher A", "9000000010");
const parentA = await createAuthUser(USERS.parentA, "E2E Parent Multi Child", "9000000020");
const adminUser = await createAuthUser(USERS.admin, "E2E Admin", "9000000099");

await must(await admin.from("academic_years").insert({ id: YEAR, name: "E2E Academic Year", start_date: "2026-04-01", end_date: "2027-03-31", status: "active" }), "insert academic year");
await must(await admin.from("rooms").insert({ id: ROOM, name: "E2E Room", capacity: 40, status: "active" }), "insert room");
await must(await admin.from("subjects").insert({ id: SUBJECT, name: "E2E Mathematics", cls: "10" }), "insert subject");

await must(await admin.from("students").insert([
  { id: USERS.studentA.ref, name: "E2E Student A", sid: "E2E-A", cls: "10", sec: "A", parentname: "E2E Parent Multi Child", parentphone: "9000000020", status: "active" },
  { id: USERS.studentB.ref, name: "E2E Student B", sid: "E2E-B", cls: "10", sec: "B", parentname: "E2E Parent Multi Child", parentphone: "9000000020", status: "active" },
  { id: USERS.studentC.ref, name: "E2E Student C", sid: "E2E-C", cls: "10", sec: "C", parentname: "E2E Unrelated Parent", parentphone: "9000000030", status: "active" },
]), "insert students");

await must(await admin.from("teachers").insert({ id: USERS.teacherA.ref, name: "E2E Teacher A", tid: "E2E-T", subject: "E2E Mathematics", phone: "9000000010", status: "active" }), "insert teacher");

await must(await admin.from("users").insert([
  { id: "e2e-student-user-a", name: "E2E Student A", phone: "9000000001", email: USERS.studentA.email, role: "student", ref: USERS.studentA.ref, auth_id: studentA.user.id, status: "active" },
  { id: "e2e-student-user-b", name: "E2E Student B", phone: "9000000002", email: USERS.studentB.email, role: "student", ref: USERS.studentB.ref, auth_id: studentB.user.id, status: "active" },
  { id: "e2e-student-user-c", name: "E2E Student C", phone: "9000000003", email: USERS.studentC.email, role: "student", ref: USERS.studentC.ref, auth_id: studentC.user.id, status: "active" },
  { id: "e2e-teacher-user-a", name: "E2E Teacher A", phone: "9000000010", email: USERS.teacherA.email, role: "teacher", ref: USERS.teacherA.ref, auth_id: teacherA.user.id, status: "active" },
  { id: "e2e-parent-user-a", name: "E2E Parent Multi Child", phone: "9000000020", email: USERS.parentA.email, role: "parent", ref: USERS.studentA.ref, auth_id: parentA.user.id, status: "active" },
  { id: "e2e-admin-user", name: "E2E Admin", phone: "9000000099", email: USERS.admin.email, role: "admin", ref: null, auth_id: adminUser.user.id, status: "active" },
]), "insert application users");

await must(await admin.from("batches").insert([
  { id: BATCH_A, name: "E2E Batch A", cls: "10", sec: "A", days: ["Monday", "Wednesday"], subjects: [SUBJECT], teacherids: [USERS.teacherA.ref], studentids: [USERS.studentA.ref], description: "E2E batch A", status: "active", academic_year_id: YEAR, code: "E2E-A", room_id: ROOM, active: true },
  { id: BATCH_B, name: "E2E Batch B", cls: "10", sec: "B", days: ["Tuesday", "Thursday"], subjects: [SUBJECT], studentids: [USERS.studentB.ref], description: "E2E batch B", status: "active", academic_year_id: YEAR, code: "E2E-B", room_id: ROOM, active: true },
  { id: BATCH_C, name: "E2E Batch C", cls: "10", sec: "C", days: ["Friday"], subjects: [SUBJECT], studentids: [USERS.studentC.ref], description: "E2E batch C", status: "active", academic_year_id: YEAR, code: "E2E-C", room_id: ROOM, active: true },
]), "insert batches");

await must(await admin.from("batch_students").insert([
  { batch_id: BATCH_A, student_id: USERS.studentA.ref, status: "active" },
  { batch_id: BATCH_B, student_id: USERS.studentB.ref, status: "active" },
  { batch_id: BATCH_C, student_id: USERS.studentC.ref, status: "active" },
]), "insert memberships");

await must(await admin.from("parent_student_links").insert([
  { parent_auth_id: parentA.user.id, student_id: USERS.studentA.ref, status: "active" },
  { parent_auth_id: parentA.user.id, student_id: USERS.studentB.ref, status: "active" },
]), "insert parent links");

await must(await admin.from("timetable_entries").insert({ id: "e2e-timetable-a", academic_year_id: YEAR, batch_id: BATCH_A, teacher_id: USERS.teacherA.ref, subject_id: SUBJECT, subject_name: "E2E Mathematics", room_id: ROOM, day_of_week: 1, start_time: "09:00", end_time: "10:00", status: "active", notes: "E2E timetable" }), "insert timetable");
await must(await admin.from("attendance").insert([
  { id: "e2e-attendance-a", sid: USERS.studentA.ref, date: "2026-09-10", status: "present", by: USERS.teacherA.ref },
  { id: "e2e-attendance-b", sid: USERS.studentB.ref, date: "2026-09-10", status: "absent", by: USERS.teacherA.ref },
  { id: "e2e-attendance-c", sid: USERS.studentC.ref, date: "2026-09-10", status: "present", by: USERS.teacherA.ref },
]), "insert attendance");
await must(await admin.from("homework").insert([
  { id: "e2e-homework-a", cls: "10", sec: "A", subject: "E2E Mathematics", desc: "E2E Student A homework", due: "2026-09-20", tid: USERS.teacherA.ref, batch_id: BATCH_A },
  { id: "e2e-homework-b", cls: "10", sec: "B", subject: "E2E Mathematics", desc: "E2E Student B homework", due: "2026-09-21", tid: USERS.teacherA.ref, batch_id: BATCH_B },
  { id: "e2e-homework-c", cls: "10", sec: "C", subject: "E2E Mathematics", desc: "E2E Student C homework", due: "2026-09-22", tid: USERS.teacherA.ref, batch_id: BATCH_C },
]), "insert homework");
await must(await admin.from("materials").insert([
  { id: "e2e-material-a", cls: "10", sec: "A", subject: "E2E Mathematics", title: "E2E Material A", desc: "A-only material", date: "2026-09-10", tid: USERS.teacherA.ref, batch_id: BATCH_A },
  { id: "e2e-material-b", cls: "10", sec: "B", subject: "E2E Mathematics", title: "E2E Material B", desc: "B-only material", date: "2026-09-10", tid: USERS.teacherA.ref, batch_id: BATCH_B },
  { id: "e2e-material-c", cls: "10", sec: "C", subject: "E2E Mathematics", title: "E2E Material C", desc: "C-only material", date: "2026-09-10", tid: USERS.teacherA.ref, batch_id: BATCH_C },
]), "insert materials");
await must(await admin.from("fees").insert([
  { id: "e2e-fee-a", sid: USERS.studentA.ref, desc: "E2E fee A", amount: 1000, due: "2026-09-30", status: "pending" },
  { id: "e2e-fee-b", sid: USERS.studentB.ref, desc: "E2E fee B", amount: 1200, due: "2026-09-30", status: "pending" },
]), "insert fees");
await must(await admin.from("marks").insert([
  { id: "e2e-mark-a", sid: USERS.studentA.ref, subject: "E2E Mathematics", exam: "E2E Test A", marks: 91, total: 100, date: "2026-09-10", tid: USERS.teacherA.ref },
  { id: "e2e-mark-b", sid: USERS.studentB.ref, subject: "E2E Mathematics", exam: "E2E Test B", marks: 82, total: 100, date: "2026-09-10", tid: USERS.teacherA.ref },
  { id: "e2e-mark-c", sid: USERS.studentC.ref, subject: "E2E Mathematics", exam: "E2E Test C", marks: 73, total: 100, date: "2026-09-10", tid: USERS.teacherA.ref },
]), "insert marks");
await must(await admin.from("announcements").insert([
  { id: "e2e-announcement-all", title: "E2E General Announcement", desc: "Visible to authenticated portals", date: "2026-09-10", target: "all" },
  { id: "e2e-announcement-a", title: "E2E Batch A Announcement", desc: "Visible only to batch A scope", date: "2026-09-10", target: `batch:${BATCH_A}` },
]), "insert announcements");
await must(await admin.from("notifications").insert([
  { id: "e2e-notification-a", title: "E2E Notification A", desc: "Student A notification", time: "2026-09-10", type: "info", read: false, uid: USERS.studentA.ref },
  { id: "e2e-notification-b", title: "E2E Notification B", desc: "Student B notification", time: "2026-09-10", type: "info", read: false, uid: USERS.studentB.ref },
]), "insert notifications");

console.log(JSON.stringify({
  status: "seeded",
  users: Object.fromEntries(Object.entries(USERS).map(([key, value]) => [key, { email: value.email, role: value.role, ref: value.ref }])),
  batches: { A: BATCH_A, B: BATCH_B, C: BATCH_C },
  passwordSource: "E2E_TEST_PASSWORD",
}, null, 2));
