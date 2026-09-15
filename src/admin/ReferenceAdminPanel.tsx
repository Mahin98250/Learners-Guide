import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addR, delR, gdb, updR } from "@/lg/data";
import { signIn } from "@/lg/auth";
import { supabase } from "@/lg/supabase";
import { LGLogo } from "@/lg/ui";

const A = {
  bg: "#F0F4FF",
  sidebar: "#0F1B3D",
  accent: "#4361EE",
  gold: "#F5A623",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  text: "#0F1B3D",
  sub: "#64748B",
  border: "#E2E8F0",
  light: "#F8FAFF",
};
type PageKey =
  | "dashboard"
  | "students"
  | "teachers"
  | "batches"
  | "attendance"
  | "homework"
  | "examschedule"
  | "results"
  | "materials"
  | "fees"
  | "announcements"
  | "accounts"
  | "marks"
  | "search"
  | "adminmsgs";
type Row = Record<string, any> & { id?: string | number };
type UserRow = Row & {
  ref?: string | null;
  role?: string;
  auth_id?: string | null;
  name?: string;
  phone?: string;
  status?: string;
};
type StudentRow = Row & {
  sid?: string;
  name?: string;
  cls?: string;
  sec?: string;
  parentName?: string;
  parentPhone?: string;
  status?: string;
};
type TeacherRow = Row & {
  tid?: string;
  name?: string;
  subject?: string;
  phone?: string;
  status?: string;
};
type ResultRow = Row & {
  sid?: string;
  subject?: string;
  exam?: string;
  marks?: number | string;
  total?: number | string;
  date?: string;
  tid?: string;
};
type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type Props = { user: AdminUser; onLogout: () => void };
const NAV: Array<[PageKey, string, string]> = [
  ["dashboard", "🏠", "Dashboard"],
  ["students", "🎓", "Students"],
  ["teachers", "👨‍🏫", "Teachers"],
  ["batches", "👥", "Batches & Timetable"],
  ["attendance", "✅", "Attendance"],
  ["homework", "📝", "Homework"],
  ["examschedule", "📋", "Exam Schedule"],
  ["results", "🏆", "Student Results"],
  ["materials", "📚", "Study Materials"],
  ["fees", "💰", "Fees"],
  ["announcements", "📢", "Announcements"],
  ["accounts", "🔐", "User Accounts"],
  ["marks", "📊", "Marks Overview"],
  ["search", "🔍", "Search Profiles"],
  ["adminmsgs", "✉️", "Messages"],
];
const META: Record<PageKey, { title: string; subtitle: string; table?: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Full overview of your institute" },
  students: {
    title: "Students",
    subtitle: "Add, edit, delete students — auto creates login accounts",
    table: "students",
  },
  teachers: {
    title: "Teachers",
    subtitle: "Manage teacher accounts and subjects",
    table: "teachers",
  },
  batches: {
    title: "Batches & Timetable",
    subtitle: "Create batches, assign timetable slots and teachers",
    table: "batches",
  },
  attendance: { title: "Attendance", subtitle: "View all attendance records", table: "attendance" },
  homework: {
    title: "Homework",
    subtitle: "Monitor homework assigned by teachers",
    table: "homework",
  },
  examschedule: {
    title: "Exam Schedule",
    subtitle: "Schedule upcoming exams for classes",
    table: "examschedule",
  },
  results: {
    title: "Student Results",
    subtitle: "Enter and manage student exam results",
    table: "marks",
  },
  materials: {
    title: "Study Materials",
    subtitle: "Upload study materials — maximum 50 MB per file",
    table: "materials",
  },
  fees: { title: "Fees", subtitle: "Track and manage fee payments", table: "fees" },
  announcements: {
    title: "Announcements",
    subtitle: "Post announcements to all roles",
    table: "announcements",
  },
  accounts: { title: "User Accounts", subtitle: "View authorized login accounts", table: "users" },
  marks: { title: "Marks Overview", subtitle: "Analytics of all exam marks", table: "marks" },
  search: { title: "Search Profiles", subtitle: "Search student or teacher — full profile view" },
  adminmsgs: {
    title: "Messages",
    subtitle: "Send direct messages to teachers or students",
    table: "messages",
  },
};
const subjects = [
  "Mathematics",
  "Science",
  "English",
  "Hindi",
  "Computer",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Sanskrit",
  "Physical Education",
];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const slots = [
  "7:00–8:00 AM",
  "8:00–9:00 AM",
  "9:00–10:00 AM",
  "10:00–11:00 AM",
  "11:00 AM–12:00 PM",
  "12:00–1:00 PM",
  "1:00–2:00 PM",
  "2:00–3:00 PM",
  "3:00–4:00 PM",
  "4:00–5:00 PM",
];
const gradeOptions = ["9", "10", "11", "12"];
const sectionOptions = ["A", "B", "C", "D", "All"];
const css = `*{box-sizing:border-box}.admin{min-height:100vh;background:${A.bg};color:${A.text};font-family:Poppins,system-ui,sans-serif}.admin button,.admin input,.admin select,.admin textarea{font:inherit}.nav{border:0;background:transparent;color:#ffffff8c;width:100%;padding:11px 14px;margin:3px 0;border-radius:12px;text-align:left;display:flex;align-items:center;gap:12px;cursor:pointer}.nav:hover{background:#ffffff12}.nav.active{background:${A.accent};color:#fff;box-shadow:0 6px 20px #4361ee59}.btn{border:0;border-radius:12px;padding:10px 16px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;gap:7px}.btn:hover{filter:brightness(1.05);transform:translateY(-1px)}.card{background:#fff;border:1px solid #eef2ff;border-radius:20px;box-shadow:0 4px 20px #0f1b3d12}.modal{position:fixed;inset:0;background:#0f1b3d99;z-index:50;display:grid;place-items:center;padding:16px}.modalbox{background:#fff;border-radius:22px;width:min(720px,100%);max-height:92vh;overflow:auto;padding:26px;box-shadow:0 24px 72px #0f1b3d30}.field{margin-bottom:13px}.field label{display:block;font-size:12px;font-weight:750;color:${A.sub};margin-bottom:6px}.field input,.field select,.field textarea{width:100%;padding:11px 13px;border:1.5px solid ${A.border};border-radius:11px;background:${A.light};color:${A.text};outline:none}.field textarea{min-height:90px;resize:vertical}.tablewrap{overflow:auto}.table{width:100%;border-collapse:collapse;font-size:13px}.table th{background:${A.light};padding:12px 14px;text-align:left;color:${A.sub};white-space:nowrap}.table td{padding:12px 14px;border-top:1px solid ${A.border};white-space:nowrap}.table tr:hover td{background:#f8faff}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800}.grid{display:grid;gap:16px}@media(max-width:900px){.shell{display:block!important}.side{position:relative!important;width:100%!important;min-height:auto!important}.navrow{display:flex;overflow-x:auto;padding-bottom:6px}.nav{width:auto;white-space:nowrap}.sidebottom{display:none!important}.main{min-height:auto!important}.top{padding:16px!important}.content{padding:16px!important}.twocol{grid-template-columns:1fr!important}.stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:520px){.stats{grid-template-columns:1fr!important}.modalbox{padding:18px}.actions{flex-wrap:wrap}.actions>*{flex:1}.top h1{font-size:18px!important}}`;
function Badge({ v }: { v: any }) {
  const x = String(v ?? "—");
  const c: Record<string, string> = {
    active: A.green,
    paid: A.green,
    present: A.green,
    pending: A.amber,
    overdue: A.red,
    absent: A.red,
    leave: A.amber,
    teacher: A.purple,
    student: A.accent,
    parent: A.green,
    admin: A.red,
  };
  const col = c[x.toLowerCase()] || A.sub;
  return (
    <span className="badge" style={{ background: col + "18", color: col }}>
      {x.toUpperCase()}
    </span>
  );
}
function Btn({
  children,
  onClick,
  color = A.accent,
  outline = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: string;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className="btn"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: outline ? "transparent" : color,
        color: outline ? color : "#fff",
        border: outline ? `1.5px solid ${color}` : "none",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modalbox"
        style={{ maxWidth: wide ? 900 : 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button
            className="btn"
            onClick={onClose}
            style={{ background: A.light, color: A.sub, padding: 8 }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  options,
  required = false,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  options?: Array<string | { v: string; l: string }>;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {required && <span style={{ color: A.red }}> *</span>}
      </label>
      {options ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ),
          )}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          required={required}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title="Are you sure?" onClose={onNo}>
      <p style={{ color: A.sub }}>{text}</p>
      <div className="actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Btn onClick={onNo} outline color={A.sub}>
          Cancel
        </Btn>
        <Btn onClick={onYes} color={A.red}>
          Delete
        </Btn>
      </div>
    </Modal>
  );
}
function Table({
  rows,
  columns,
  actions,
}: {
  rows: Row[];
  columns: Array<[string, string, (r: Row) => ReactNode]>;
  actions?: (r: Row) => ReactNode;
}) {
  return (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c[0]}>{c[1]}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={String(r.id ?? i)}>
                {columns.map((c) => (
                  <td key={c[0]}>{c[2] ? c[2](r) : String(r[c[0]] ?? "—")}</td>
                ))}
                {actions && <td>{actions(r)}</td>}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                style={{ textAlign: "center", padding: 40, color: A.sub }}
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
async function provision(
  role: string,
  loginId: string,
  password: string,
  name: string,
  ref: string | null,
  authId?: string | null,
) {
  const { data, error } = await supabase.functions.invoke("admin-provision-user", {
    body: { action: authId ? "update" : "create", role, loginId, password, name, ref, authId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
async function removeAuth(authId?: string | null) {
  if (!authId) return;
  const { data, error } = await supabase.functions.invoke("admin-provision-user", {
    body: {
      action: "delete",
      role: "student",
      loginId: "",
      password: "",
      name: "",
      ref: null,
      authId,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
function Sidebar({
  page,
  setPage,
  onLogout,
}: {
  page: PageKey;
  setPage: (p: PageKey) => void;
  onLogout: () => void;
}) {
  return (
    <aside
      className="side"
      style={{
        width: 235,
        minHeight: "100vh",
        background: A.sidebar,
        padding: "0 12px 18px",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "20px 8px 16px", borderBottom: "1px solid #ffffff12" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "#fff",
              display: "grid",
              placeItems: "center",
              padding: 4,
            }}
          >
            <LGLogo size={34} showText={false} />
          </div>
          <div>
            <b style={{ display: "block", color: "#fff", fontSize: 16 }}>Learner's</b>
            <b style={{ display: "block", color: A.gold, fontSize: 16, marginTop: -4 }}>Guide</b>
          </div>
        </div>
        <div style={{ marginTop: 12, color: A.red, fontSize: 11, fontWeight: 800 }}>
          🔴 ADMIN PANEL
        </div>
      </div>
      <nav className="navrow" style={{ flex: 1, overflowY: "auto", padding: "14px 0" }}>
        {NAV.map(([k, ic, l]) => (
          <button
            key={k}
            className={`nav ${page === k ? "active" : ""}`}
            onClick={() => setPage(k)}
          >
            <span style={{ fontSize: 18 }}>{ic}</span>
            {l}
          </button>
        ))}
      </nav>
      <div className="sidebottom" style={{ borderTop: "1px solid #ffffff12", paddingTop: 14 }}>
        <div style={{ color: "#fff", fontWeight: 750, padding: 8 }}>
          👑 Admin{" "}
          <span style={{ display: "block", fontSize: 11, color: "#ffffff73", fontWeight: 500 }}>
            Full Access
          </span>
        </div>
        <Btn onClick={onLogout} color="#8f2020">
          🚪 Logout
        </Btn>
      </div>
    </aside>
  );
}
function Top({
  meta,
  onRefresh,
}: {
  meta: { title: string; subtitle: string };
  onRefresh: () => void;
}) {
  return (
    <header
      className="top"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 28px",
        background: "#fff",
        borderBottom: `1px solid ${A.border}`,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 20 }}>{meta.title}</h1>
        <div style={{ fontSize: 13, color: A.sub }}>{meta.subtitle}</div>
      </div>
      <Btn onClick={onRefresh} outline>
        ↻ Refresh
      </Btn>
    </header>
  );
}
function Dashboard({
  data,
  navigate,
}: {
  data: Record<string, Row[]>;
  navigate: (p: PageKey) => void;
}) {
  const st = data.students || [],
    tc = data.teachers || [],
    at = data.attendance || [],
    fe = data.fees || [],
    hw = data.homework || [],
    an = data.announcements || [];
  const present = at.filter((x) => x.status === "present").length;
  const rate = at.length ? Math.round((present / at.length) * 100) : 0;
  const pending = fe.filter((x) => x.status !== "paid");
  return (
    <div className="content" style={{ padding: 28 }}>
      <div className="stats grid" style={{ gridTemplateColumns: "repeat(6,minmax(0,1fr))" }}>
        {[
          ["🎓", "Total Students", st.length],
          ["👨‍🏫", "Teachers", tc.length],
          ["✅", "Attendance Rate", rate + "%"],
          ["💰", "Pending Fees", pending.length],
          ["📝", "Active Homework", hw.length],
          ["📢", "Announcements", an.length],
        ].map((x) => (
          <div className="card" style={{ padding: 20 }} key={String(x[1] ?? "")}>
            <div style={{ fontSize: 22 }}>{x[0] ?? ""}</div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{x[2] ?? ""}</div>
            <div style={{ fontSize: 12, color: A.sub }}>{x[1] ?? ""}</div>
          </div>
        ))}
      </div>
      <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Weekly Attendance Trend 📊</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 150 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => {
              const v = Math.max(4, Math.min(100, rate + ([-5, 2, -2, 5, 0][i] ?? 0)));
              return (
                <div key={d} style={{ flex: 1, textAlign: "center" }}>
                  <b style={{ fontSize: 11, color: A.accent }}>{v}%</b>
                  <div style={{ height: 100, display: "flex", alignItems: "flex-end" }}>
                    <div
                      style={{
                        width: "100%",
                        height: v + "%",
                        background: A.accent,
                        borderRadius: "7px 7px 0 0",
                      }}
                    />
                  </div>
                  <small style={{ color: A.sub }}>{d}</small>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Fee Collection 💰</h3>
          {[
            ["Collected", "paid", A.green],
            ["Pending", "pending", A.amber],
            ["Overdue", "overdue", A.red],
          ].map(([l, s, c]) => (
            <div
              key={String(l)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "11px 0",
                borderBottom: `1px solid ${A.border}`,
              }}
            >
              <span>{l}</span>
              <b style={{ color: String(c) }}>
                ₹
                {fe
                  .filter((x) => x.status === s)
                  .reduce((n, x) => n + Number(x.amount || 0), 0)
                  .toLocaleString("en-IN")}
              </b>
            </div>
          ))}
        </div>
      </div>
      <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Recent Students 🎓</h3>
          {st.slice(0, 5).map((s) => (
            <div
              key={s.id}
              onClick={() => navigate("students")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 9,
                borderBottom: `1px solid ${A.border}`,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: A.accent + "18",
                  display: "grid",
                  placeItems: "center",
                  color: A.accent,
                  fontWeight: 800,
                }}
              >
                {String(s.name || "?").charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <b>{s.name}</b>
                <small style={{ display: "block", color: A.sub }}>
                  Class {s.cls}-{s.sec} · {s.sid}
                </small>
              </div>
              <Badge v={s.status || "active"} />
            </div>
          ))}
          {!st.length && <p style={{ color: A.sub }}>No students found.</p>}
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Latest Announcements 📢</h3>
          {an.slice(0, 5).map((a) => (
            <div key={a.id} style={{ padding: 10, borderBottom: `1px solid ${A.border}` }}>
              <b>{a.title}</b>
              <div>
                <Badge v={a.target || "all"} /> <small style={{ color: A.sub }}>{a.date}</small>
              </div>
            </div>
          ))}
          {!an.length && <p style={{ color: A.sub }}>No announcements yet.</p>}
        </div>
      </div>
    </div>
  );
}
function Students({ data, reload }: { data: StudentRow[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [edit, setEdit] = useState<Row | null>(null),
    [del, setDel] = useState<Row | null>(null),
    [q, setQ] = useState(""),
    [form, setForm] = useState<any>({
      name: "",
      sid: "",
      cls: "10",
      sec: "A",
      enroll: new Date().toISOString().slice(0, 10),
      status: "active",
      pass: "1234",
      parentName: "",
      parentPhone: "",
    }),
    [busy, setBusy] = useState(false);
  const nextSid = () => {
    const nums = data.map((s) => Number(String(s.sid || "").replace(/\D/g, ""))).filter(Boolean);
    return `LG${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
  };
  const save = async () => {
    if (!form.name || !form.cls || !form.sec || !form.parentPhone)
      return alert("Fill all required fields.");
    setBusy(true);
    try {
      if (edit) {
        await updR("students", edit.id, form);
        const us: UserRow[] = await gdb("users");
        const su = us.find((u: UserRow) => u.ref === edit.id && u.role === "student"),
          pu = us.find((u: UserRow) => u.ref === edit.id && u.role === "parent");
        if (su) {
          const a = await provision(
            "student",
            form.sid,
            form.pass,
            form.name,
            String(edit.id),
            su.auth_id,
          );
          await updR("users", su.id, {
            name: form.name,
            phone: form.sid,
            pass: form.pass,
            auth_id: a.authId,
          });
        }
        if (pu) {
          const a = await provision(
            "parent",
            form.parentPhone,
            "parent@1234",
            form.parentName,
            String(edit.id),
            pu.auth_id,
          );
          await updR("users", pu.id, {
            name: form.parentName,
            phone: form.parentPhone,
            pass: "parent@1234",
            auth_id: a.authId,
          });
        }
      } else {
        const id = "s" + Date.now();
        await addR("students", { ...form, id });
        const sa = await provision("student", form.sid, form.pass, form.name, id);
        const pa = await provision("parent", form.parentPhone, "parent@1234", form.parentName, id);
        await addR("users", {
          id: "u" + Date.now() + "s",
          name: form.name,
          phone: form.sid,
          email: sa.email,
          pass: form.pass,
          role: "student",
          ref: id,
          status: "active",
          auth_id: sa.authId,
        });
        await addR("users", {
          id: "u" + Date.now() + "p",
          name: form.parentName,
          phone: form.parentPhone,
          email: pa.email,
          pass: "parent@1234",
          role: "parent",
          ref: id,
          status: "active",
          auth_id: pa.authId,
        });
      }
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to save student");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      const us: UserRow[] = await gdb("users");
      for (const u of us.filter((x: UserRow) => x.ref === del.id)) {
        await removeAuth(u.auth_id);
        await delR("users", u.id);
      }
      await delR("students", del.id);
      setDel(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to delete student");
    } finally {
      setBusy(false);
    }
  };
  const rows = data.filter(
    (s) => !q || `${s.name} ${s.sid}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search by name or SID…"
          style={{
            flex: 1,
            minWidth: 220,
            padding: 11,
            border: `1.5px solid ${A.border}`,
            borderRadius: 12,
          }}
        />
        <Btn
          onClick={() => {
            setForm({
              name: "",
              sid: nextSid(),
              cls: "10",
              sec: "A",
              enroll: new Date().toISOString().slice(0, 10),
              status: "active",
              pass: "1234",
              parentName: "",
              parentPhone: "",
            });
            setOpen(true);
          }}
        >
          ＋ Add Student
        </Btn>
      </div>
      <div className="card">
        <Table
          rows={rows}
          columns={[
            ["sid", "Roll No", (r) => r.sid],
            ["name", "Student Name", (r) => r.name],
            ["cls", "Class", (r) => `${r.cls}-${r.sec}`],
            ["parentName", "Parent Name", (r) => r.parentName],
            ["parentPhone", "Parent Phone", (r) => r.parentPhone],
            ["status", "Status", (r) => <Badge v={r.status} />],
          ]}
          actions={(r) => (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn
                onClick={() => {
                  setForm({ ...r });
                  setEdit(r);
                }}
                outline
              >
                Edit
              </Btn>
              <Btn onClick={() => setDel(r)} color={A.red}>
                🗑
              </Btn>
            </div>
          )}
        />
      </div>
      {(open || edit) && (
        <Modal
          title={edit ? "Edit Student" : "Add New Student"}
          onClose={() => {
            setOpen(false);
            setEdit(null);
          }}
          wide
        >
          <div
            style={{
              background: "#eff6ff",
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
              color: "#1e40af",
            }}
          >
            Adding a student automatically creates the student login and a parent login linked only
            to this student.
          </div>
          <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field
              label="Full Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <Field
              label="Roll Number / SID"
              value={form.sid}
              onChange={(v) => setForm({ ...form, sid: v })}
              required
            />
            <Field
              label="Class"
              value={form.cls}
              onChange={(v) => setForm({ ...form, cls: v })}
              options={gradeOptions}
            />
            <Field
              label="Section"
              value={form.sec}
              onChange={(v) => setForm({ ...form, sec: v })}
              options={sectionOptions}
            />
            <Field
              label="Enrollment Date"
              value={form.enroll}
              onChange={(v) => setForm({ ...form, enroll: v })}
              type="date"
            />
            <Field
              label="Status"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={["active", "inactive"]}
            />
            <Field
              label="Student Password"
              value={form.pass}
              onChange={(v) => setForm({ ...form, pass: v })}
              placeholder="Default: 1234"
            />
            <Field
              label="Parent / Guardian Name"
              value={form.parentName}
              onChange={(v) => setForm({ ...form, parentName: v })}
              required
            />
            <Field
              label="Parent Phone / Login"
              value={form.parentPhone}
              onChange={(v) => setForm({ ...form, parentPhone: v })}
              required
            />
            <div
              style={{
                background: "#fff7ed",
                padding: 12,
                borderRadius: 12,
                fontSize: 12,
                color: "#92400e",
              }}
            >
              Parent default password: <b>parent@1234</b>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn
              onClick={() => {
                setOpen(false);
                setEdit(null);
              }}
              outline
              color={A.sub}
            >
              Cancel
            </Btn>
            <Btn onClick={save} disabled={busy}>
              {busy ? "Saving…" : edit ? "Save Changes" : "Add Student + Create Accounts"}
            </Btn>
          </div>
        </Modal>
      )}
      {del && (
        <Confirm
          text="This permanently deletes the student and their linked parent/student authentication accounts."
          onNo={() => setDel(null)}
          onYes={remove}
        />
      )}
    </div>
  );
}
function Teachers({ data, reload }: { data: TeacherRow[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [edit, setEdit] = useState<Row | null>(null),
    [del, setDel] = useState<Row | null>(null),
    [form, setForm] = useState<any>({
      name: "",
      tid: "",
      subject: "Mathematics",
      phone: "",
      status: "active",
      pass: "1234",
    }),
    [busy, setBusy] = useState(false);
  const next = () => `LGT${String(data.length + 1).padStart(2, "0")}`;
  const save = async () => {
    if (!form.name || !form.phone || !form.subject) return alert("Fill all required fields.");
    setBusy(true);
    try {
      if (edit) {
        await updR("teachers", edit.id, form);
        const us: UserRow[] = await gdb("users"),
          u = us.find((x) => x.ref === edit.id && x.role === "teacher");
        if (u) {
          const a = await provision(
            "teacher",
            form.phone,
            form.pass,
            form.name,
            String(edit.id),
            u.auth_id,
          );
          await updR("users", u.id, {
            name: form.name,
            phone: form.phone,
            pass: form.pass,
            auth_id: a.authId,
          });
        }
      } else {
        const id = "t" + Date.now();
        await addR("teachers", { ...form, id });
        const a = await provision("teacher", form.phone, form.pass, form.name, id);
        await addR("users", {
          id: "u" + Date.now(),
          name: form.name,
          phone: form.phone,
          email: a.email,
          pass: form.pass,
          role: "teacher",
          ref: id,
          status: "active",
          auth_id: a.authId,
        });
      }
      setOpen(false);
      setEdit(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to save teacher");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      const us: UserRow[] = await gdb("users");
      for (const u of us.filter((x: UserRow) => x.ref === del.id)) {
        await removeAuth(u.auth_id);
        await delR("users", u.id);
      }
      await delR("teachers", del.id);
      setDel(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to delete teacher");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        <Btn
          onClick={() => {
            setForm({
              name: "",
              tid: next(),
              subject: "Mathematics",
              phone: "",
              status: "active",
              pass: "1234",
            });
            setOpen(true);
          }}
        >
          ＋ Add Teacher
        </Btn>
      </div>
      <div className="card">
        <Table
          rows={data}
          columns={[
            ["tid", "Teacher ID", (r) => r.tid],
            ["name", "Name", (r) => r.name],
            ["subject", "Subject", (r) => r.subject],
            ["phone", "Phone / Login", (r) => r.phone],
            ["status", "Status", (r) => <Badge v={r.status} />],
          ]}
          actions={(r) => (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn
                onClick={() => {
                  setForm({ ...r });
                  setEdit(r);
                }}
                outline
              >
                Edit
              </Btn>
              <Btn onClick={() => setDel(r)} color={A.red}>
                🗑
              </Btn>
            </div>
          )}
        />
      </div>
      {(open || edit) && (
        <Modal
          title={edit ? "Edit Teacher" : "Add New Teacher"}
          onClose={() => {
            setOpen(false);
            setEdit(null);
          }}
        >
          <Field
            label="Full Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <Field
            label="Teacher ID"
            value={form.tid}
            onChange={(v) => setForm({ ...form, tid: v })}
          />
          <Field
            label="Subject"
            value={form.subject}
            onChange={(v) => setForm({ ...form, subject: v })}
            options={subjects}
          />
          <Field
            label="Phone / Login ID"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            required
          />
          <Field
            label="Password"
            value={form.pass}
            onChange={(v) => setForm({ ...form, pass: v })}
          />
          <Field
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={["active", "inactive"]}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn
              onClick={() => {
                setOpen(false);
                setEdit(null);
              }}
              outline
              color={A.sub}
            >
              Cancel
            </Btn>
            <Btn onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Btn>
          </div>
        </Modal>
      )}
      {del && (
        <Confirm
          text="Delete this teacher and their authentication account?"
          onNo={() => setDel(null)}
          onYes={remove}
        />
      )}
    </div>
  );
}
function SimpleCrud({ page, rows, reload }: { page: PageKey; rows: Row[]; reload: () => void }) {
  const table = META[page].table!;
  const fieldMap: Record<string, string[]> = {
    attendance: ["sid", "date", "status", "by"],
    homework: ["cls", "sec", "subject", "desc", "given", "due", "tid"],
    examschedule: [
      "title",
      "subject",
      "cls",
      "sec",
      "date",
      "startTime",
      "endTime",
      "venue",
      "syllabus",
      "totalMarks",
    ],
    results: ["sid", "subject", "exam", "marks", "total", "date", "tid"],
    fees: ["sid", "desc", "amount", "due", "status"],
    announcements: ["title", "desc", "target", "date"],
    adminmsgs: ["to", "text"],
  };
  const fields = fieldMap[page] || [];
  const cols = fields.length ? fields : Object.keys(rows[0] || {}).filter((k) => k !== "id");
  const needsStudents = fields.includes("sid");
  const [students, setStudents] = useState<Row[]>([]);
  const [open, setOpen] = useState(false),
    [del, setDel] = useState<Row | null>(null),
    [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!needsStudents) return;
    void gdb("students")
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [needsStudents]);
  const studentOptions = useMemo(
    () =>
      students
        .filter((s) => s?.sid || s?.id)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .map((s) => ({
          v: String(s.sid || s.id),
          l: `${s.name || "Unnamed Student"} · ${s.sid || s.id} · Class ${s.cls || "—"}-${s.sec || "—"}`,
        })),
    [students],
  );
  const classOptions = useMemo(
    () => [
      ...new Set([...gradeOptions, ...students.map((s) => String(s.cls || "")).filter(Boolean)]),
    ],
    [students],
  );
  const create = async () => {
    const row: Row = { id: table.slice(0, 2) + Date.now(), ...form };
    if (page === "announcements")
      Object.assign(row, {
        date: row.date || new Date().toISOString().slice(0, 10),
        target: row.target || "all",
      });
    if (page === "fees" || page === "results")
      row.amount = page === "fees" ? Number(row.amount || 0) : row.amount;
    if (page === "results") row.marks = Number(row.marks || 0);
    await addR(table, row);
    setOpen(false);
    setForm({});
    reload();
  };
  const remove = async () => {
    if (!del) return;
    await delR(table, del.id);
    setDel(null);
    reload();
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        {page !== "attendance" && (
          <Btn
            onClick={() => {
              setForm({});
              setOpen(true);
            }}
          >
            ＋ Add {META[page].title.replace(/s$/, "")}
          </Btn>
        )}
      </div>
      <div className="card">
        <Table
          rows={rows}
          columns={cols.map((k) => [
            k,
            k.replaceAll("_", " "),
            (r) =>
              k === "status" || k === "role" || k === "target" ? (
                <Badge v={r[k]} />
              ) : (
                String(r[k] ?? "—")
              ),
          ])}
          actions={
            page !== "attendance"
              ? (r) => (
                  <Btn onClick={() => setDel(r)} color={A.red}>
                    🗑
                  </Btn>
                )
              : undefined
          }
        />
      </div>
      {open && (
        <Modal title={`Add ${META[page].title}`} onClose={() => setOpen(false)} wide>
          {fields.map((k) => (
            <Field
              key={k}
              label={k.replaceAll("_", " ")}
              value={form[k] ?? ""}
              onChange={(v) => setForm({ ...form, [k]: v })}
              type={
                k === "date"
                  ? "date"
                  : k === "desc" || k === "text" || k === "syllabus"
                    ? "textarea"
                    : "text"
              }
              options={
                k === "sid"
                  ? studentOptions
                  : k === "cls"
                    ? classOptions
                    : k === "sec"
                      ? sectionOptions
                      : k === "status"
                        ? [
                            "active",
                            "inactive",
                            "pending",
                            "paid",
                            "overdue",
                            "present",
                            "absent",
                            "leave",
                          ]
                        : k === "target"
                          ? ["all", "teachers", "parents", "students"]
                          : k === "subject"
                            ? subjects
                            : k === "day"
                              ? days
                              : undefined
              }
            />
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={create}>Save to Database</Btn>
          </div>
        </Modal>
      )}
      {del && (
        <Confirm
          text="Delete this record permanently from Supabase?"
          onNo={() => setDel(null)}
          onYes={remove}
        />
      )}
    </div>
  );
}
function Batches({ data, reload }: { data: Row[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState<any>({
      name: "",
      cls: "10",
      sec: "A",
      days: [],
      subjects: [],
      status: "active",
      description: "",
    }),
    [tab, setTab] = useState<"batches" | "timetable">("batches"),
    [tt, setTt] = useState<Row[]>([]);
  const load = async () => setTt(await gdb("timetable"));
  useEffect(() => {
    void load();
  }, []);
  const toggle = (key: string, v: string) =>
    setForm((f: any) => ({
      ...f,
      [key]: (f[key] || []).includes(v)
        ? f[key].filter((x: string) => x !== v)
        : [...(f[key] || []), v],
    }));
  const save = async () => {
    await addR("batches", { id: "b" + Date.now(), ...form });
    setOpen(false);
    reload();
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Btn onClick={() => setTab("batches")} outline={tab !== "batches"}>
          👥 Batches ({data.length})
        </Btn>
        <Btn onClick={() => setTab("timetable")} outline={tab !== "timetable"}>
          📅 Timetable ({tt.length})
        </Btn>
      </div>
      {tab === "batches" ? (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <Btn onClick={() => setOpen(true)}>＋ Create Batch</Btn>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}
          >
            {data.map((b) => (
              <div className="card" style={{ padding: 20 }} key={b.id}>
                <h3 style={{ marginTop: 0 }}>{b.name}</h3>
                <div style={{ color: A.sub, fontSize: 12 }}>
                  Class {b.cls}-{b.sec} · {b.status}
                </div>
                <p style={{ fontSize: 12 }}>{b.description}</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {(b.days || []).map((x: string) => (
                    <Badge key={x} v={x} />
                  ))}
                  {(b.subjects || []).map((x: string) => (
                    <Badge key={x} v={x} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {open && (
            <Modal title="Create Batch" onClose={() => setOpen(false)} wide>
              <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field
                  label="Batch Name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  required
                />
                <Field
                  label="Class"
                  value={form.cls}
                  onChange={(v) => setForm({ ...form, cls: v })}
                  options={gradeOptions}
                />
                <Field
                  label="Section"
                  value={form.sec}
                  onChange={(v) => setForm({ ...form, sec: v })}
                  options={sectionOptions}
                />
                <Field
                  label="Status"
                  value={form.status}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={["active", "inactive"]}
                />
              </div>
              <b>Class Days</b>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 16px" }}>
                {days.map((x) => (
                  <Btn key={x} onClick={() => toggle("days", x)} outline={!form.days.includes(x)}>
                    {x.slice(0, 3)}
                  </Btn>
                ))}
              </div>
              <b>Subjects</b>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 16px" }}>
                {subjects.map((x) => (
                  <Btn
                    key={x}
                    onClick={() => toggle("subjects", x)}
                    outline={!form.subjects.includes(x)}
                    color={A.green}
                  >
                    {x}
                  </Btn>
                ))}
              </div>
              <Field
                label="Description"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                type="textarea"
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn onClick={save}>Create Batch</Btn>
              </div>
            </Modal>
          )}
        </>
      ) : (
        <div className="card">
          <Table
            rows={tt}
            columns={[
              ["cls", "Class", (r) => `${r.cls}-${r.sec}`],
              ["day", "Day", (r) => r.day],
              ["slot", "Time", (r) => r.slot],
              ["subject", "Subject", (r) => r.subject],
              ["tid", "Teacher", (r) => r.tid],
            ]}
            actions={(r) => (
              <Btn
                onClick={async () => {
                  await delR("timetable", r.id);
                  void load();
                }}
                color={A.red}
              >
                🗑
              </Btn>
            )}
          />
        </div>
      )}
    </div>
  );
}
function Materials({ data, reload }: { data: Row[]; reload: () => void }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    ref = useRef<HTMLInputElement>(null),
    [form, setForm] = useState<any>({
      title: "",
      subject: "Mathematics",
      cls: "10",
      sec: "A",
      desc: "",
      date: new Date().toISOString().slice(0, 10),
    });
  const save = async () => {
    const f = ref.current?.files?.[0];
    if (!f) return alert("Select a file.");
    if (f.size > 50 * 1024 * 1024) return alert("Maximum file size is 50 MB.");
    setBusy(true);
    try {
      const path = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("materials")
        .upload(path, f, { upsert: false, contentType: f.type });
      if (error) throw error;
      await addR("materials", {
        id: "m" + Date.now(),
        ...form,
        pdfname: f.name,
        storage_path: path,
        pdfurl: null,
        size: f.size,
      });
      setOpen(false);
      setForm({
        title: "",
        subject: "Mathematics",
        cls: "10",
        sec: "A",
        desc: "",
        date: new Date().toISOString().slice(0, 10),
      });
      if (ref.current) ref.current.value = "";
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (r: Row) => {
    try {
      if (r.storage_path) {
        const { error: storageError } = await supabase.storage.from("materials").remove([r.storage_path]);
        if (storageError) throw storageError;
      }
      await delR("materials", r.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to delete material.");
    }
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ color: A.sub, fontSize: 12 }}>
          {data.length} materials · maximum 50 MB per file
        </div>
        <Btn onClick={() => setOpen(true)}>＋ Upload Material</Btn>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {data.map((m) => (
          <div className="card" style={{ padding: 20 }} key={m.id}>
            <div style={{ fontSize: 26 }}>📚</div>
            <h3 style={{ marginBottom: 5 }}>{m.title}</h3>
            <div style={{ fontSize: 12, color: A.sub }}>
              {m.subject} · Class {m.cls}-{m.sec}
            </div>
            <p style={{ fontSize: 12, color: A.sub }}>{m.desc}</p>
            <div style={{ fontSize: 11, color: A.sub }}>
              {m.pdfname} · {m.size ? Math.round((m.size / 1024 / 1024) * 10) / 10 : 0} MB
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {m.storage_path && (
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    const { data, error } = await supabase.storage.from("materials").createSignedUrl(m.storage_path, 300);
                    if (error || !data?.signedUrl) {
                      alert(error?.message || "Unable to open this material.");
                      return;
                    }
                    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                  }}
                  style={{ background: A.accent, color: "#fff", textDecoration: "none" }}
                >
                  Open
                </button>
              )}
              <Btn onClick={() => void remove(m)} color={A.red}>
                🗑
              </Btn>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <Modal title="📁 Upload Study Material" onClose={() => setOpen(false)} wide>
          <div
            style={{
              background: "#eff6ff",
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            Maximum <b>50 MB per file</b>. Files are stored in Supabase Storage.
          </div>
          <Field
            label="Title"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            required
          />
          <Field
            label="Subject"
            value={form.subject}
            onChange={(v) => setForm({ ...form, subject: v })}
            options={subjects}
          />
          <div className="twocol grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field
              label="Class"
              value={form.cls}
              onChange={(v) => setForm({ ...form, cls: v })}
              options={gradeOptions}
            />
            <Field
              label="Section"
              value={form.sec}
              onChange={(v) => setForm({ ...form, sec: v })}
              options={sectionOptions}
            />
          </div>
          <Field
            label="Description"
            value={form.desc}
            onChange={(v) => setForm({ ...form, desc: v })}
            type="textarea"
          />
          <div className="field">
            <label>File</label>
            <input
              ref={ref}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={save} disabled={busy}>
              {busy ? "Uploading…" : "Upload to Supabase"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
function SearchProfiles({ students, teachers }: { students: Row[]; teachers: Row[] }) {
  const [q, setQ] = useState(""),
    [type, setType] = useState<"student" | "teacher">("student"),
    [sel, setSel] = useState<Row | null>(null);
  const arr = (type === "student" ? students : teachers).filter((x) =>
    `${x.name} ${type === "student" ? x.sid : x.tid}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="content" style={{ padding: 28 }}>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Btn
            onClick={() => {
              setType("student");
              setSel(null);
            }}
            outline={type !== "student"}
          >
            🎓 Students
          </Btn>
          <Btn
            onClick={() => {
              setType("teacher");
              setSel(null);
            }}
            outline={type !== "teacher"}
          >
            👨‍🏫 Teachers
          </Btn>
        </div>
        <Field label="Search by name or ID" value={q} onChange={setQ} placeholder="Start typing…" />
        {!sel ? (
          <div>
            {arr.map((x) => (
              <button
                key={x.id}
                onClick={() => setSel(x)}
                style={{
                  width: "100%",
                  border: 0,
                  borderBottom: `1px solid ${A.border}`,
                  background: "#fff",
                  padding: 14,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <b>{x.name}</b>
                <span style={{ display: "block", fontSize: 12, color: A.sub }}>
                  {type === "student"
                    ? `Roll ${x.sid} · Class ${x.cls}-${x.sec}`
                    : `${x.subject} · ${x.phone}`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <Btn onClick={() => setSel(null)} outline>
              ← Back
            </Btn>
            <div
              style={{
                marginTop: 16,
                background: "linear-gradient(135deg,#4361ee,#7b6ff5)",
                color: "#fff",
                borderRadius: 18,
                padding: 24,
              }}
            >
              <h2 style={{ marginTop: 0 }}>{sel.name}</h2>
              <div>
                {type === "student"
                  ? `Roll ${sel.sid} · Class ${sel.cls}-${sel.sec}`
                  : `${sel.subject} · ${sel.tid}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function Accounts({ rows, reload }: { rows: Row[]; reload: () => void }) {
  const users = rows.filter((x) => x.role !== "admin");
  const toggle = async (u: Row) => {
    await updR("users", u.id, { status: u.status === "active" ? "inactive" : "active" });
    reload();
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div className="card">
        <Table
          rows={users}
          columns={[
            ["name", "Name", (r) => r.name],
            ["role", "Role", (r) => <Badge v={r.role} />],
            ["phone", "Login ID", (r) => r.phone],
            ["pass", "Password", (r) => r.pass || "Managed by Auth"],
            ["status", "Status", (r) => <Badge v={r.status || "active"} />],
          ]}
          actions={(r) => (
            <Btn
              onClick={() => void toggle(r)}
              outline
              color={r.status === "active" ? A.red : A.green}
            >
              {r.status === "active" ? "Disable" : "Activate"}
            </Btn>
          )}
        />
      </div>
    </div>
  );
}
function Marks({ rows }: { rows: Row[] }) {
  const pct = (r: Row) =>
    Math.round((Number(r.marks || 0) / Math.max(1, Number(r.total || 100))) * 100);
  return (
    <div className="content" style={{ padding: 28 }}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 18 }}
      >
        {[
          ["📊", "Entries", rows.length],
          ["✅", "Above 80%", rows.filter((r) => pct(r) >= 80).length],
          ["⚠️", "Below 60%", rows.filter((r) => pct(r) < 60).length],
        ].map((x) => (
          <div className="card" style={{ padding: 20 }} key={String(x[1] ?? "")}>
            <div>{x[0] ?? ""}</div>
            <b style={{ fontSize: 28 }}>{x[2] ?? ""}</b>
            <div style={{ color: A.sub, fontSize: 12 }}>{x[1] ?? ""}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <Table
          rows={rows}
          columns={[
            ["sid", "Student", (r) => r.sid],
            ["subject", "Subject", (r) => r.subject],
            ["exam", "Exam", (r) => r.exam],
            ["marks", "Marks", (r) => `${r.marks}/${r.total}`],
            [
              "score",
              "Score",
              (r) => (
                <b style={{ color: pct(r) >= 80 ? A.green : pct(r) >= 60 ? A.amber : A.red }}>
                  {pct(r)}%
                </b>
              ),
            ],
            ["date", "Date", (r) => r.date],
          ]}
        />
      </div>
    </div>
  );
}
function AppPage({
  page,
  data,
  reload,
  navigate,
}: {
  page: PageKey;
  data: Record<string, Row[]>;
  reload: () => void;
  navigate: (p: PageKey) => void;
}) {
  if (page === "dashboard") return <Dashboard data={data} navigate={navigate} />;
  if (page === "students") return <Students data={data.students || []} reload={reload} />;
  if (page === "teachers") return <Teachers data={data.teachers || []} reload={reload} />;
  if (page === "batches") return <Batches data={data.batches || []} reload={reload} />;
  if (page === "materials") return <Materials data={data.materials || []} reload={reload} />;
  if (page === "search")
    return <SearchProfiles students={data.students || []} teachers={data.teachers || []} />;
  if (page === "accounts") return <Accounts rows={data.users || []} reload={reload} />;
  if (page === "marks") return <Marks rows={data.marks || []} />;
  return <SimpleCrud page={page} rows={data[META[page].table!] || []} reload={reload} />;
}
export function ReferenceAdminPanel({ user, onLogout }: Props) {
  const [page, setPage] = useState<PageKey>("dashboard"),
    [data, setData] = useState<Record<string, Row[]>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const tablesFor = useCallback(
    (p: PageKey) =>
      p === "dashboard"
        ? ["students", "teachers", "attendance", "fees", "homework", "announcements"]
        : p === "search"
          ? ["students", "teachers"]
          : p === "batches"
            ? ["batches", "timetable", "students", "teachers"]
            : p === "results"
              ? ["marks", "students", "teachers", "examschedule"]
              : p === "marks"
                ? ["marks"]
                : p === "accounts"
                  ? ["users"]
                  : META[p].table
                    ? [META[p].table!]
                    : [],
    [],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ts = tablesFor(page);
      const out: Record<string, Row[]> = {};
      await Promise.all(
        ts.map(async (t) => {
          out[t] = await gdb(t);
        }),
      );
      setData((x) => ({ ...x, ...out }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sync with Supabase");
    } finally {
      setLoading(false);
    }
  }, [page, tablesFor]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="admin">
      <style>{css}</style>
      <div className="shell" style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar page={page} setPage={setPage} onLogout={onLogout} />
        <main
          className="main"
          style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
        >
          <Top meta={META[page]} onRefresh={load} />
          {error && (
            <div
              style={{
                margin: "14px 28px 0",
                background: "#fef2f2",
                color: A.red,
                padding: 12,
                borderRadius: 12,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
          {loading && (
            <div style={{ padding: "8px 28px", color: A.sub, fontSize: 12 }}>
              Syncing with Supabase…
            </div>
          )}
          <AppPage page={page} data={data} reload={load} navigate={setPage} />
        </main>
      </div>
    </div>
  );
}
export function AdminLogin({ onSuccess }: { onSuccess: (u: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email || !password) return setError("Enter your administrator email and password.");
    setBusy(true);
    setError("");
    try {
      const r = await signIn(email, password, "admin");
      if (r.user?.role === "admin") onSuccess(r.user as AdminUser);
      else setError(r.error || "Administrator access was not granted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="admin"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "linear-gradient(160deg,#0d1f4e,#122466,#0a1835)",
      }}
    >
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 78,
              height: 78,
              borderRadius: 22,
              background: "#fff",
              padding: 6,
            }}
          >
            <LGLogo size={66} showText={false} />
          </div>
          <h1 style={{ color: "#fff", margin: "12px 0 4px" }}>Learner's Guide</h1>
          <div style={{ color: "#ffffff99", fontSize: 12 }}>Administrator access</div>
        </div>
        <div className="card" style={{ padding: 26 }}>
          <Field label="ADMIN EMAIL" value={email} onChange={setEmail} type="email" />
          <Field label="PASSWORD" value={password} onChange={setPassword} type="password" />
          <Btn onClick={submit} disabled={busy}>
            {busy ? "Signing in…" : "Sign in as Administrator 👑"}
          </Btn>
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                background: "#fef2f2",
                color: A.red,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
