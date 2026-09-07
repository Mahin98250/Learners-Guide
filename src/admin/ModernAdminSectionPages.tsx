import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import "@/admin/modern-admin-sections.css";

type Row = Record<string, any>;
type Section = "attendance" | "results" | "marks" | "fees" | "accounts" | "profiles" | "analytics";

type Props = { section: Section; onBack?: () => void };
type InstituteData = {
  students: Row[];
  teachers: Row[];
  batches: Row[];
  attendance: Row[];
  fees: Row[];
  homework: Row[];
  announcements: Row[];
  tests: Row[];
  results: Row[];
};

const clean = (v: any) => String(v ?? "").trim();
const lower = (v: any) => clean(v).toLowerCase();
const amount = (v: any) => Number(v || 0);
const dateKey = (v: any) => clean(v).slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
const fmtDate = (v: any) => { const d = clean(v); if (!d) return "—"; const x = new Date(d); return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };
const studentName = (id: any, students: Row[]) => students.find(s => String(s.id) === String(id))?.name || "Unknown student";
const teacherName = (id: any, teachers: Row[]) => teachers.find(t => String(t.id) === String(id))?.name || "Unknown teacher";
const batchName = (id: any, batches: Row[]) => { const b = batches.find(x => String(x.id) === String(id)); return b ? `Class ${b.cls || "—"}-${b.sec || "—"}${b.name ? ` · ${b.name}` : ""}` : "—"; };

function Metric({ label, value, hint, tone = "blue" }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return <div className={`mas-metric ${tone}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}
function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={`mas-panel ${className}`}><div className="mas-panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}
function Empty({ text = "No records available yet." }: { text?: string }) { return <div className="mas-empty">{text}</div>; }

function useInstituteData() {
  const initial: InstituteData = { students: [], teachers: [], batches: [], attendance: [], fees: [], homework: [], announcements: [], tests: [], results: [] };
  const [data, setData] = useState<InstituteData>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const queries = await Promise.all([
        supabase.from("students").select("id,name,sid,cls,sec,parentname,parentphone,phone,status,enroll,created_at"),
        supabase.from("teachers").select("id,name,tid,subject,phone,classes,status,created_at"),
        supabase.from("batches").select("id,name,cls,sec,status,active,created_at"),
        supabase.from("attendance").select("id,sid,date,status,by,created_at,leave_request_id").order("date", { ascending: false }),
        supabase.from("fees").select("id,sid,desc,amount,due,status,paidon,created_at").order("created_at", { ascending: false }),
        supabase.from("homework").select("id,tid,cls,sec,subject,due,created_at,batch_id").order("created_at", { ascending: false }),
        supabase.from("announcements").select("id,title,target,date,created_at").order("created_at", { ascending: false }),
        supabase.from("tests").select("id,title,subject,cls,sec,test_date,total_marks,batch_id,created_at").order("test_date", { ascending: false }),
        supabase.from("test_results").select("id,test_id,student_id,marks,remarks,created_at").order("created_at", { ascending: false }),
      ]);
      if (!live) return;
      const firstError = queries.find(q => q.error)?.error;
      if (firstError) setError(firstError.message);
      setData({ students: queries[0].data || [], teachers: queries[1].data || [], batches: queries[2].data || [], attendance: queries[3].data || [], fees: queries[4].data || [], homework: queries[5].data || [], announcements: queries[6].data || [], tests: queries[7].data || [], results: queries[8].data || [] });
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);
  return { ...data, loading, error };
}

function Header({ eyebrow, title, description, onBack }: { eyebrow: string; title: string; description: string; onBack?: () => void }) {
  return <div className="mas-header"><div><span className="mas-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{onBack && <button className="mas-secondary" onClick={onBack}>← Dashboard</button>}</div>;
}

function AttendancePage({ d, onBack }: { d: ReturnType<typeof useInstituteData>; onBack?: () => void }) {
  const [q, setQ] = useState("");
  const present = d.attendance.filter(a => lower(a.status) === "present").length;
  const absent = d.attendance.filter(a => lower(a.status) === "absent").length;
  const leave = d.attendance.filter(a => ["leave", "on leave"].includes(lower(a.status))).length;
  const rate = pct(present, d.attendance.length);
  const studentRows = useMemo(() => d.students.map(s => { const rows = d.attendance.filter(a => String(a.sid) === String(s.id) || String(a.sid) === String(s.sid)); const p = rows.filter(a => lower(a.status) === "present").length; return { ...s, records: rows.length, present: p, rate: pct(p, rows.length) }; }).filter(s => `${s.name} ${s.sid} ${s.cls} ${s.sec}`.toLowerCase().includes(q.toLowerCase())).sort((a,b) => (b.rate ?? -1) - (a.rate ?? -1)), [d.students, d.attendance, q]);
  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => { const x = new Date(); x.setDate(x.getDate() - (13 - i)); const key = x.toISOString().slice(0,10); const rows = d.attendance.filter(a => dateKey(a.date) === key); return { label: x.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), rate: pct(rows.filter(a => lower(a.status) === "present").length, rows.length) }; }), [d.attendance]);
  return <><Header eyebrow="Academic · Attendance" title="Attendance Center" description="A complete view of attendance health, daily movement, and student-level records." onBack={onBack} />
    <div className="mas-metrics"><Metric label="Attendance rate" value={rate == null ? "—" : `${rate}%`} hint={`${d.attendance.length} total records`} tone="green" /><Metric label="Present" value={present} tone="blue" /><Metric label="Absent" value={absent} tone="red" /><Metric label="Leave" value={leave} tone="amber" /></div>
    <div className="mas-grid two"><Panel title="Last 14 days" subtitle="Daily attendance percentage"><div className="mas-bars">{last14.map(x => <div className="mas-bar-col" key={x.label}><div className="mas-bar-track"><div className="mas-bar" style={{ height: `${Math.max(4, x.rate || 0)}%` }} /></div><b>{x.rate == null ? "—" : `${x.rate}%`}</b><span>{x.label}</span></div>)}</div></Panel><Panel title="Attendance status" subtitle="All recorded attendance"><div className="mas-status-list"><div><span>Present</span><b>{present}</b></div><div><span>Absent</span><b>{absent}</b></div><div><span>Leave</span><b>{leave}</b></div><div><span>Other / unclassified</span><b>{Math.max(0, d.attendance.length-present-absent-leave)}</b></div></div></Panel></div>
    <Panel title="Student attendance" subtitle="Sorted by attendance rate"><div className="mas-toolbar"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by student name, roll no, or class" /></div>{studentRows.length ? <div className="mas-table-wrap"><table><thead><tr><th>Student</th><th>Roll No</th><th>Class</th><th>Records</th><th>Present</th><th>Rate</th></tr></thead><tbody>{studentRows.map(s => <tr key={s.id}><td><strong>{s.name || "Unnamed"}</strong></td><td>{s.sid || "—"}</td><td>{s.cls || "—"}-{s.sec || "—"}</td><td>{s.records}</td><td>{s.present}</td><td><span className="mas-pill">{s.rate == null ? "—" : `${s.rate}%`}</span></td></tr>)}</tbody></table></div> : <Empty text="No matching students." />}</Panel>
  </>;
}

function ResultsPage({ d, onBack, marksOnly = false }: { d: ReturnType<typeof useInstituteData>; onBack?: () => void; marksOnly?: boolean }) {
  const enriched = useMemo(() => d.results.map(r => { const t = d.tests.find(x => String(x.id) === String(r.test_id)); const total = amount(t?.total_marks) || 100; return { ...r, test: t, student: d.students.find(s => String(s.id) === String(r.student_id)), percentage: Math.round((amount(r.marks) / total) * 100) }; }).filter(x => x.test), [d.results, d.tests, d.students]);
  const average = enriched.length ? Math.round(enriched.reduce((n, x) => n + x.percentage, 0) / enriched.length) : null;
  const passed = enriched.filter(x => x.percentage >= 40).length;
  const subjects = useMemo(() => { const map = new Map<string, { sum: number; n: number }>(); enriched.forEach(x => { const k = clean(x.test?.subject) || "Other"; const a = map.get(k) || { sum: 0, n: 0 }; a.sum += x.percentage; a.n++; map.set(k, a); }); return [...map.entries()].map(([subject, x]) => ({ subject, average: Math.round(x.sum / x.n), count: x.n })).sort((a,b) => b.average-a.average); }, [enriched]);
  return <><Header eyebrow={`Academic · ${marksOnly ? "Marks Overview" : "Student Results"}`} title={marksOnly ? "Marks & Performance Overview" : "Student Results Center"} description={marksOnly ? "Compare academic performance by subject, test, and student." : "Review published results, pass rate, subject performance, and individual scores."} onBack={onBack} />
    <div className="mas-metrics"><Metric label="Average score" value={average == null ? "—" : `${average}%`} hint={`${enriched.length} result entries`} tone="purple" /><Metric label="Pass rate" value={enriched.length ? `${Math.round((passed/enriched.length)*100)}%` : "—"} tone="green" /><Metric label="Tests" value={d.tests.length} tone="blue" /><Metric label="Results entered" value={d.results.length} tone="amber" /></div>
    <div className="mas-grid two"><Panel title="Subject performance" subtitle="Average percentage by subject"><div className="mas-ranking">{subjects.length ? subjects.map(s => <div key={s.subject}><div><strong>{s.subject}</strong><span>{s.count} results</span></div><div className="mas-progress"><i style={{ width: `${Math.min(100, s.average)}%` }} /></div><b>{s.average}%</b></div>) : <Empty />}</div></Panel><Panel title="Score distribution" subtitle="Result entries grouped by percentage"><div className="mas-distribution">{[90,75,60,40,0].map((floor,i) => { const upper = i === 0 ? 101 : [90,75,60,40][i-1]; const n = enriched.filter(x => x.percentage >= floor && x.percentage < upper).length; return <div key={floor}><span>{i === 0 ? "90–100" : `${floor}–${upper-1}`}%</span><div><i style={{ width: `${enriched.length ? (n/enriched.length)*100 : 0}%` }} /></div><b>{n}</b></div>; })}</div></Panel></div>
    <Panel title="Latest results" subtitle="Student names and roll numbers are shown; internal database IDs stay hidden"><div className="mas-table-wrap"><table><thead><tr><th>Student</th><th>Roll No</th><th>Test</th><th>Subject</th><th>Date</th><th>Score</th><th>Remark</th></tr></thead><tbody>{enriched.slice(0, 80).map(x => <tr key={x.id}><td><strong>{x.student?.name || "Unknown student"}</strong></td><td>{x.student?.sid || "—"}</td><td>{x.test?.title || "Untitled test"}</td><td>{x.test?.subject || "—"}</td><td>{fmtDate(x.test?.test_date)}</td><td><span className="mas-pill">{amount(x.marks)}/{amount(x.test?.total_marks)||100} · {x.percentage}%</span></td><td>{x.remarks || "—"}</td></tr>)}</tbody></table></div>{!enriched.length && <Empty />}</Panel>
  </>;
}

// The remainder of this file is unchanged from main after the data-loader declaration.
