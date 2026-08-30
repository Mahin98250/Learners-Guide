import { useEffect, useMemo, useState } from "react";
import { gdb, C } from "@/lg/data";

type Student = { id: string | number; name?: string; cls?: string; sec?: string; sid?: string; status?: string };
type Teacher = { id: string | number; name?: string };
type Attendance = { id: string | number; status?: string; date?: string };
type Fee = { id: string | number; status?: string; amount?: number | string };
type Announcement = { id: string | number; title?: string; target?: string; date?: string };
type Homework = { id: string | number };

const cardStyle = { background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(15,27,61,.07)", border: "1px solid #EEF2FF" };

function Badge({ label }: { label?: string }) {
  const value = label || "—";
  const map: Record<string, string> = { present: C.green, absent: C.red, leave: C.gold, paid: C.green, pending: C.gold, overdue: C.red, active: C.green, inactive: "#94A3B8", student: C.accent, teacher: C.purple, parent: C.green, admin: C.red };
  const color = map[value.toLowerCase()] || C.sub;
  return <span className="badge-anim" style={{ display: "inline-block", padding: "3px 11px", borderRadius: 20, background: `${color}18`, color, fontSize: 12, fontWeight: 700 }}>{value.toUpperCase()}</span>;
}

function StatCard({ icon, label, value, color, sub, delay }: { icon: string; label: string; value: string | number; color: string; sub?: string; delay: string }) {
  return <div className={`stat-card card-hover ${delay}`} style={{ ...cardStyle, padding: "20px 22px" }}><div style={{ width: 48, height: 48, borderRadius: 15, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 12 }}>{icon}</div><div style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</div><div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{label}</div>{sub && <div style={{ fontSize: 12, color, fontWeight: 700, marginTop: 3 }}>{sub}</div>}</div>;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}
function dateKey(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const [studentRows, teacherRows, attendanceRows, feeRows, announcementRows, homeworkRows] = await Promise.all([gdb("students"), gdb("teachers"), gdb("attendance"), gdb("fees"), gdb("announcements"), gdb("homework")]);
        if (!mounted) return;
        setStudents((studentRows || []) as Student[]);
        setTeachers((teacherRows || []) as Teacher[]);
        setAttendance((attendanceRows || []) as Attendance[]);
        setFees((feeRows || []) as Fee[]);
        setAnnouncements((announcementRows || []) as Announcement[]);
        setHomework((homeworkRows || []) as Homework[]);
      } catch (err) { if (mounted) setError(err instanceof Error ? err.message : "Unable to load dashboard data."); }
      finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const metrics = useMemo(() => {
    const present = attendance.filter((a) => a.status?.toLowerCase() === "present").length;
    const attRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
    const pending = fees.filter((f) => f.status?.toLowerCase() !== "paid");
    const amount = (status: string) => fees.filter((f) => f.status?.toLowerCase() === status).reduce((s, f) => s + Number(f.amount || 0), 0);
    const weekStart = startOfWeek();
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((label, index) => {
      const day = new Date(weekStart); day.setDate(weekStart.getDate() + index);
      const key = day.toISOString().slice(0, 10);
      const rows = attendance.filter((a) => dateKey(String(a.date || "")) === key);
      const presentCount = rows.filter((a) => a.status?.toLowerCase() === "present").length;
      return { label, value: rows.length ? Math.round((presentCount / rows.length) * 100) : null, count: rows.length };
    });
    return { present, attRate, pending, pendingAmt: pending.reduce((s, f) => s + Number(f.amount || 0), 0), paid: amount("paid"), pendingFees: amount("pending"), overdue: amount("overdue"), weekDays: days };
  }, [attendance, fees]);

  const realBars = metrics.weekDays.filter((d) => d.value !== null);
  const maxBar = Math.max(1, ...realBars.map((d) => d.value || 0));

  return <div style={{ padding: 28, overflowY: "auto" }}>
    {error && <div style={{ ...cardStyle, marginBottom: 18, color: C.red, borderColor: `${C.red}55` }}>{error}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 16, marginBottom: 24 }}>
      <StatCard icon="🎓" label="Total Students" value={loading ? "—" : students.length} color={C.accent} sub={`${students.filter((s) => s.status?.toLowerCase() === "active").length} active`} delay="fu d1" />
      <StatCard icon="👨‍🏫" label="Teachers" value={loading ? "—" : teachers.length} color={C.purple} sub={`${teachers.length} loaded`} delay="fu d2" />
      <StatCard icon="✅" label="Attendance Rate" value={loading ? "—" : `${metrics.attRate}%`} color={C.green} sub={`${metrics.present}/${attendance.length} records`} delay="fu d3" />
      <StatCard icon="💰" label="Pending Fees" value={loading ? "—" : metrics.pending.length} color={C.red} sub={`₹${metrics.pendingAmt.toLocaleString("en-IN")}`} delay="fu d4" />
      <StatCard icon="📝" label="Active Homework" value={loading ? "—" : homework.length} color={C.gold} delay="fu d5" />
      <StatCard icon="📢" label="Announcements" value={loading ? "—" : announcements.length} color={C.cyan} delay="fu d6" />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20, marginBottom: 20 }}>
      <div className="fu d2" style={cardStyle}>
        <div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 4 }}>Weekly Attendance Trend 📊</div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 18 }}>Real attendance records for this week</div>
        {realBars.length ? <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130 }}>{metrics.weekDays.map((day) => <div key={day.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>{day.value === null ? <div style={{ fontSize: 11, color: C.sub }}>No data</div> : <><div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{day.value}%</div><div style={{ width: "100%", height: 82, display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%", height: `${((day.value || 0) / maxBar) * 100}%`, background: `linear-gradient(180deg,${C.accent},#7B91F5)`, borderRadius: "6px 6px 0 0", transition: "height .5s ease" }} /></div></>}<div style={{ fontSize: 11, color: C.sub }}>{day.label}</div></div>)}</div> : <div style={{ padding: 24, textAlign: "center", color: C.sub }}>No attendance records for this week.</div>}
      </div>
      <div className="fu d3" style={cardStyle}><div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 16 }}>Fee Collection 💰</div>{[["Collected", C.green, metrics.paid],["Pending", C.gold, metrics.pendingFees],["Overdue", C.red, metrics.overdue]].map(([label, color, value]) => <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: String(color) }} /><span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{label}</span></div><span style={{ fontSize: 15, fontWeight: 800, color: String(color) }}>₹{Number(value).toLocaleString("en-IN")}</span></div>)}</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
      <div className="fu d4" style={cardStyle}><div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 16 }}>Recent Students 🎓</div>{students.slice(0, 4).map((s) => <div key={s.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${C.border}` }}><div style={{ width: 36, height: 36, borderRadius: 11, background: `${C.accent}18`, display: "grid", placeItems: "center", fontWeight: 800, color: C.accent, fontSize: 14 }}>{(s.name || "?").charAt(0).toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{s.name || "Unnamed student"}</div><div style={{ fontSize: 11, color: C.sub }}>Class {s.cls || "—"}-{s.sec || "—"} · {s.sid || "—"}</div></div><Badge label={s.status} /></div>)}{!loading && students.length === 0 && <div style={{ color: C.sub, fontSize: 13, padding: "14px 0" }}>No students found.</div>}</div>
      <div className="fu d5" style={cardStyle}><div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 16 }}>Latest Announcements 📢</div>{announcements.slice(0, 4).map((a) => <div key={a.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}><div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 3 }}>{a.title || "Untitled announcement"}</div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><Badge label={a.target} /><span style={{ fontSize: 11, color: C.sub }}>{a.date || ""}</span></div></div>)}{!loading && announcements.length === 0 && <div style={{ color: C.sub, fontSize: 13, padding: "14px 0" }}>No announcements yet.</div>}</div>
    </div>
  </div>;
}
