import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { Badge, Card, Shell, AppBar, Sec } from "@/lg/ui";
import { ParentNotifications } from "@/lg/ParentNotifications";
import { ParentHomework } from "@/lg/ParentHomework";
import { ParentAnalytics } from "@/lg/ParentAnalytics";

const EMPTY = [];
const statCard = { padding: 14, borderRadius: 16, background: "#fff", border: "1px solid #e8eaf3", boxShadow: "0 5px 18px rgba(31,39,79,.05)" };
const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid #f0f1f6", minWidth: 0 };
const percentage = (marks, total) => Number.isFinite(Number(marks)) && Number(total) > 0 ? Math.round(Number(marks) / Number(total) * 100) : null;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayName = value => { const n = Number(value); return Number.isInteger(n) && n >= 0 && n <= 6 ? DAY_NAMES[n] : "Scheduled"; };

export function ParentApp({ user, onLogout }) {
  const [children, setChildren] = useState([]), [selectedId, setSelectedId] = useState(null);
  const [attendance, setAttendance] = useState([]), [fees, setFees] = useState([]), [tests, setTests] = useState([]), [results, setResults] = useState([]), [homework, setHomework] = useState([]), [memberships, setMemberships] = useState([]), [timetable, setTimetable] = useState([]);
  const [tab, setTab] = useState("home"), [loading, setLoading] = useState(true), [error, setError] = useState(""), [showNotif, setShowNotif] = useState(false);
  const selected = useMemo(() => children.find(c => String(c.id) === String(selectedId)) || children[0] || null, [children, selectedId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const authId = auth?.user?.id;
      if (!authId) throw new Error("Parent session expired. Please sign in again.");

      const { data: links, error: linkError } = await supabase.from("parent_student_links").select("student_id,status").eq("parent_auth_id", authId).eq("status", "active");
      if (linkError) throw linkError;
      const ids = [...new Set((links || []).map(x => String(x.student_id)).filter(Boolean))];
      if (!ids.length && user?.ref) ids.push(String(user.ref));
      if (!ids.length) { setChildren([]); setMemberships([]); setAttendance([]); setFees([]); setTests([]); setResults([]); setHomework([]); setTimetable([]); return; }

      const { data: students, error: studentError } = await supabase.from("students").select("id,name,sid,cls,sec").in("id", ids);
      if (studentError) throw studentError;
      setChildren(students || []);
      setSelectedId(cur => cur && students?.some(s => String(s.id) === String(cur)) ? cur : students?.[0]?.id || null);

      const { data: memberships, error: membershipError } = await supabase.from("batch_students").select("student_id,batch_id,status").in("student_id", ids).eq("status", "active");
      if (membershipError) throw membershipError;
      setMemberships(memberships || []);
      const batchIds = [...new Set((memberships || []).map(m => String(m.batch_id)).filter(Boolean))];

      const [tr, ar, fr, hw, test] = await Promise.all([
        batchIds.length ? supabase.from("timetable_entries").select("id,batch_id,subject_name,start_time,end_time,status,day_of_week").in("batch_id", batchIds).eq("status", "active") : Promise.resolve({ data: EMPTY, error: null }),
        supabase.from("attendance").select("id,sid,date,status").in("sid", ids).order("date", { ascending: false }),
        supabase.from("fees").select("id,sid,desc,amount,status,due").in("sid", ids).order("due"),
        supabase.from("homework").select("id,batch_id,subject,desc,given,due,created_at,pdfname").in("batch_id", batchIds).order("created_at", { ascending: false }),
        batchIds.length ? supabase.from("tests").select("id,title,description,batch_id,subject,test_date,total_marks,status").in("batch_id", batchIds).order("test_date") : Promise.resolve({ data: EMPTY, error: null })
      ]);
      if (tr.error) throw tr.error;
      if (ar.error) throw ar.error;
      if (fr.error) throw fr.error;
      if (hw.error) throw hw.error;
      if (test.error) throw test.error;

      setTimetable(tr.data || []);
      setAttendance(ar.data || []);
      setFees(fr.data || []);
      setHomework(hw.data || []);
      setTests(test.data || []);

      const testIds = (test.data || []).map(x => String(x.id)).filter(Boolean);
      const resultResponse = testIds.length ? await supabase.from("test_results").select("id,student_id,test_id,marks,remarks").in("test_id", testIds).in("student_id", ids) : { data: [], error: null };
      if (resultResponse.error) throw resultResponse.error;
      const testMap = new Map((test.data || []).map(t => [String(t.id), t]));
      setResults((resultResponse.data || []).map(r => ({ ...r, test: testMap.get(String(r.test_id)) || null })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load parent data.");
    } finally { setLoading(false); }
  }, [user?.ref]);

  useEffect(() => { void load(); }, [load]);

  const childMemberships = memberships.filter(m => String(m.student_id) === String(selected?.id));
  const childBatchIds = new Set(childMemberships.map(m => String(m.batch_id)));
  const childAttendance = attendance.filter(a => String(a.sid) === String(selected?.id));
  const childFees = fees.filter(f => String(f.sid) === String(selected?.id));
  const childTests = tests.filter(t => childBatchIds.has(String(t.batch_id)));
  const childResults = results.filter(r => String(r.student_id) === String(selected?.id));
  const childHomework = homework.filter(h => childBatchIds.has(String(h.batch_id)));
  const childTimetable = timetable.filter(t => childBatchIds.has(String(t.batch_id)));
  const attendanceRate = childAttendance.length ? Math.round(childAttendance.filter(a => String(a.status).toLowerCase() === "present").length / childAttendance.length * 100) : null;
  const upcomingTests = childTests.filter(t => !t.test_date || new Date(t.test_date) >= new Date());
  const resultPercentages = childResults.map(r => percentage(r.marks, r.test?.total_marks)).filter(x => x != null);
  const averagePercentage = resultPercentages.length ? Math.round(resultPercentages.reduce((a,b) => a+b, 0) / resultPercentages.length) : null;

  const tabs = [
    { key: "home", icon: "🏠", label: "Home" }, { key: "attendance", icon: "✅", label: "Attendance" },
    { key: "homework", icon: "📝", label: "Homework" }, { key: "results", icon: "🏆", label: "Results" }, { key: "more", icon: "☰", label: "More" }
  ];
  const moreItems = [
    ["analytics", "📊", "Analytics", "Progress overview"], ["timetable", "🗓️", "Classes", "Today's schedule"],
    ["tests", "📋", "Tests", `${upcomingTests.length} upcoming`], ["fees", "₹", "Fees", `${childFees.length} records`]
  ];

  const content = loading ? <Card style={{ padding: 24, textAlign: "center", color: "#747c94" }}>Loading your child's dashboard…</Card> : error ?
    <Card style={{ padding: 20 }}><div style={{ color: "#b42318", marginBottom: 12 }}>{error}</div><button type="button" onClick={() => void load()} style={{ minHeight: 42, padding: "0 16px", border: 0, borderRadius: 10, background: "#5146d9", color: "#fff", fontWeight: 800 }}>Try again</button></Card> : !selected ?
    <Card style={{ padding: 24, textAlign: "center", color: "#747c94" }}>No student is linked to this parent account.</Card> :
    <main className="parent-portal" style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <section className="pp-hero"><div className="pp-eyebrow">Parent dashboard</div><h1>Welcome back, {String(user?.name || "Parent").split(" ")[0]} 👋</h1><p>Everything important about your child's learning, in one place.</p><div className="pp-child"><div className="pp-avatar">{String(selected.name || "S").slice(0,1).toUpperCase()}</div><div className="pp-child-copy"><b>{selected.name}</b><small>Class {selected.cls}-{selected.sec} · SID {selected.sid}</small></div></div>{children.length > 1 && <select className="pp-select" value={selected.id} onChange={e => setSelectedId(e.target.value)} aria-label="Select child">{children.map(c => <option key={c.id} value={c.id}>{c.name} · {c.sid}</option>)}</select>}</section>
      <div className="pp-grid">
        <div style={statCard}><div>✅</div><b className="pp-stat-value">{attendanceRate == null ? "—" : `${attendanceRate}%`}</b><span>Attendance</span></div>
        <div style={statCard}><div>📝</div><b className="pp-stat-value">{childHomework.length}</b><span>Homework</span></div>
        <div style={statCard}><div>📋</div><b className="pp-stat-value">{upcomingTests.length}</b><span>Upcoming tests</span></div>
        <div style={statCard}><div>🏆</div><b className="pp-stat-value">{averagePercentage == null ? "—" : `${averagePercentage}%`}</b><span>Average percentage</span></div>
      </div>
      {tab === "home" && <><Sec title="Quick access" /><div className="pp-home-actions"><button className="pp-home-action" onClick={() => setTab("attendance")}><span>✅</span><b>Attendance</b><small>View daily records</small></button><button className="pp-home-action" onClick={() => setTab("homework")}><span>📝</span><b>Homework</b><small>See assignments and files</small></button><button className="pp-home-action" onClick={() => setTab("results")}><span>🏆</span><b>Results</b><small>View marks and percentages</small></button><button className="pp-home-action" onClick={() => setTab("more")}><span>☰</span><b>More</b><small>Classes, tests & fees</small></button></div></>}
      {tab === "attendance" && <><Sec title="Attendance" /><div className="pp-panel">{childAttendance.length ? childAttendance.map(a => <div style={row} key={a.id}><div className="pp-row-main"><div className="pp-icon">{String(a.status).toLowerCase() === "present" ? "✓" : "•"}</div><div><div className="pp-title">{a.status || "Attendance"}</div><div className="pp-sub">{a.date}</div></div></div><Badge label={a.status} /></div>) : <div className="pp-note">No attendance records found.</div>}</div></>}
      {tab === "homework" && <><Sec title="Homework" /><ParentHomework homework={childHomework} /></>}
      {tab === "results" && <><Sec title="Results" /><div className="pp-panel">{childResults.length ? childResults.map(r => { const total = Number(r.test?.total_marks); const p = percentage(r.marks, total); return <div style={row} key={r.id}><div style={{ minWidth: 0 }}><div className="pp-title">{r.test?.title || "Assessment result"}</div><div className="pp-sub">{r.test?.subject || "Assessment"}{r.test?.test_date ? ` · ${r.test.test_date}` : ""}</div></div><div style={{ textAlign: "right", whiteSpace: "nowrap" }}><b style={{ display: "block", fontSize: 16 }}>{r.marks}{Number.isFinite(total) && total > 0 ? ` / ${total}` : ""}</b><span style={{ color: "#6258df", fontWeight: 800, fontSize: 12 }}>{p == null ? "Percentage unavailable" : `${p}%`}</span></div></div>; }) : <div className="pp-note">No results recorded yet.</div>}<div className="pp-note" style={{ marginTop: 8 }}>Each percentage is calculated separately from that test's marks obtained and total marks.</div></div></>}
      {tab === "more" && <><Sec title="More sections" /><div className="pp-more-grid">{moreItems.map(([key,icon,label,hint]) => <button key={key} className="pp-more-card" type="button" onClick={() => setTab(key)}><span className="pp-more-icon">{icon}</span><b>{label}</b><small>{hint}</small></button>)}</div></>}
      {tab === "analytics" && <ParentAnalytics attendance={childAttendance} results={childResults} homework={childHomework} tests={childTests} fees={childFees} />}
      {tab === "timetable" && <><Sec title="Classes" /><div className="pp-panel">{childTimetable.length ? childTimetable.map(t => <div style={row} key={t.id}><div><div className="pp-title">{t.subject_name || "Class"}</div><div className="pp-sub">{dayName(t.day_of_week)} · {String(t.start_time || "").slice(0,5)}–{String(t.end_time || "").slice(0,5)}</div></div></div>) : <div className="pp-note">No timetable entries found.</div>}</div></>}
      {tab === "tests" && <><Sec title="Tests" /><div className="pp-panel">{childTests.length ? childTests.map(t => <div style={row} key={t.id}><div><div className="pp-title">{t.title || "Test"}</div><div className="pp-sub">{t.subject || "Assessment"} · {t.test_date || "Date not set"}</div></div><b style={{ whiteSpace: "nowrap" }}>{t.total_marks ?? "—"} marks</b></div>) : <div className="pp-note">No tests scheduled.</div>}</div></>}
      {tab === "fees" && <><Sec title="Fees" /><div className="pp-panel">{childFees.length ? childFees.map(f => <div style={row} key={f.id}><div><div className="pp-title">{f.desc || "Fee"}</div><div className="pp-sub">Due {f.due || "—"} · {f.status || "—"}</div></div><b>₹{Number(f.amount || 0).toLocaleString("en-IN")}</b></div>) : <div className="pp-note">No fee records found.</div>}</div></>}
    </main>;

  return <><Shell header={<AppBar name={user.name} role="parent" userId={user.id} onLogout={onLogout} onNotif={() => setShowNotif(true)} />} tabs={tabs} activeTab={tab} setTab={setTab}>{content}</Shell>{showNotif && <ParentNotifications onClose={() => setShowNotif(false)} />}</>;
}
