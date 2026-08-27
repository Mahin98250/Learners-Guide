import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { Badge, Card, Shell, AppBar } from "@/lg/ui";
import { ParentNotifications } from "@/lg/ParentNotifications";
import { ParentHomework } from "@/lg/ParentHomework";
import { ParentAnalytics } from "@/lg/ParentAnalytics";

const EMPTY = { data: [], error: null };
const safe = async (query) => {
  try { return (await query) || EMPTY; } catch { return EMPTY; }
};

export function ParentApp({ user, onLogout }) {
  const [children, setChildren] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [homework, setHomework] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNotif, setShowNotif] = useState(false);

  const selected = useMemo(
    () => children.find((c) => String(c.id) === String(selectedId)) || children[0] || null,
    [children, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const authId = auth?.user?.id;
      if (!authId) throw new Error("Parent session expired. Please sign in again.");

      const { data: links, error: linkError } = await supabase
        .from("parent_student_links")
        .select("student_id,status")
        .eq("parent_auth_id", authId)
        .eq("status", "active");
      if (linkError) throw linkError;

      const ids = [...new Set((links || []).map((x) => String(x.student_id)).filter(Boolean))];
      if (!ids.length && user?.ref) ids.push(String(user.ref));
      if (!ids.length) {
        setChildren([]); setMemberships([]); setAttendance([]); setFees([]);
        setTests([]); setResults([]); setHomework([]); setMaterials([]); setTimetable([]);
        return;
      }

      const { data: students, error: studentError } = await supabase
        .from("students").select("id,name,sid,cls,sec").in("id", ids);
      if (studentError) throw studentError;
      setChildren(students || []);
      setSelectedId((cur) => cur && students?.some((s) => String(s.id) === String(cur)) ? cur : students?.[0]?.id || null);

      const { data: memberships, error: membershipError } = await supabase
        .from("batch_students").select("student_id,batch_id,status").in("student_id", ids).eq("status", "active");
      if (membershipError) throw membershipError;
      setMemberships(memberships || []);

      const batchIds = [...new Set((memberships || []).map((m) => String(m.batch_id)).filter(Boolean))];
      const [tr, ar, fr, hw, test] = await Promise.all([
        batchIds.length ? safe(supabase.from("timetable_entries").select("id,batch_id,subject_name,subject,start_time,end_time,status,day,day_of_week").in("batch_id", batchIds).eq("status", "active")) : Promise.resolve(EMPTY),
        safe(supabase.from("attendance").select("id,sid,date,status").in("sid", ids).order("date", { ascending: false })),
        safe(supabase.from("fees").select("id,sid,desc,amount,status,due").in("sid", ids).order("due")),
        batchIds.length ? safe(supabase.from("homework").select("id,batch_id,subject,title,desc,given,due,created_at,pdfname").in("batch_id", batchIds).order("created_at", { ascending: false })) : Promise.resolve(EMPTY),
        batchIds.length ? safe(supabase.from("tests").select("id,title,description,batch_id,subject,test_date,total_marks,status").in("batch_id", batchIds).order("test_date")) : Promise.resolve(EMPTY),
      ]);
      setTimetable(tr.data || []); setAttendance(ar.data || []); setFees(fr.data || []); setHomework(hw.data || []); setTests(test.data || []);

      const testIds = (test.data || []).map((x) => String(x.id)).filter(Boolean);
      const [resultResponse, materialResponse] = await Promise.all([
        testIds.length ? safe(supabase.from("test_results").select("id,student_id,test_id,marks").in("test_id", testIds)) : Promise.resolve(EMPTY),
        batchIds.length ? safe(supabase.from("materials").select("id,title,name,storage_path,mime_type,batch_id,created_at").in("batch_id", batchIds).order("created_at", { ascending: false })) : Promise.resolve(EMPTY),
      ]);
      setResults(resultResponse.data || []);
      setMaterials(materialResponse.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load parent data.");
    } finally {
      setLoading(false);
    }
  }, [user?.ref]);

  useEffect(() => { void load(); }, [load]);

  const childMemberships = memberships.filter((m) => String(m.student_id) === String(selected?.id));
  const childBatchIds = new Set(childMemberships.map((m) => String(m.batch_id)));
  const childAttendance = attendance.filter((a) => String(a.sid) === String(selected?.id));
  const childFees = fees.filter((f) => String(f.sid) === String(selected?.id));
  const childTests = tests.filter((t) => childBatchIds.has(String(t.batch_id)));
  const childResults = results.filter((r) => String(r.student_id) === String(selected?.id));
  const childHomework = homework.filter((h) => childBatchIds.has(String(h.batch_id)));
  const childTimetable = timetable.filter((t) => childBatchIds.has(String(t.batch_id)));
  const childMaterials = materials.filter((m) => childBatchIds.has(String(m.batch_id)));

  const tabs = [
    { key: "home", icon: "🏠", label: "Home" },
    { key: "analytics", icon: "📊", label: "Analytics" },
    { key: "timetable", icon: "🗓️", label: "Classes" },
    { key: "attendance", icon: "✅", label: "Attendance" },
    { key: "homework", icon: "📝", label: "Homework" },
    { key: "tests", icon: "📋", label: "Tests" },
    { key: "results", icon: "🏆", label: "Results" },
    { key: "materials", icon: "📚", label: "Materials" },
    { key: "fees", icon: "₹", label: "Fees" },
  ];

  const content = loading ? (
    <Card>Loading your child's data…</Card>
  ) : error ? (
    <Card><div style={{ color: "#c0392b", marginBottom: 10 }}>{error}</div><button onClick={() => void load()}>Try again</button></Card>
  ) : !selected ? (
    <Card>No student is linked to this parent account.</Card>
  ) : (
    <main className="parent-portal">
      <style>{`.parent-portal{padding:0 0 22px;color:#182044}.pp-hero{position:relative;overflow:hidden;padding:20px;border-radius:22px;background:linear-gradient(135deg,#5146d9,#887af4);color:#fff;box-shadow:0 12px 28px rgba(83,70,210,.18);margin-bottom:14px}.pp-hero:after{content:"";position:absolute;width:150px;height:150px;right:-55px;top:-65px;border-radius:50%;background:rgba(255,255,255,.1)}.pp-eyebrow{position:relative;z-index:1;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.75}.pp-hero h1{position:relative;z-index:1;margin:5px 0 3px;font-size:23px}.pp-hero p{position:relative;z-index:1;margin:0;font-size:12px;opacity:.83}.pp-child{position:relative;z-index:1;display:flex;align-items:center;gap:10px;margin-top:15px}.pp-avatar{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.17);font-weight:900;font-size:18px}.pp-child b{font-size:14px}.pp-child small{display:block;margin-top:2px;font-size:10px;opacity:.8}.pp-select{position:relative;z-index:2;width:100%;margin-top:12px;padding:9px 10px;border-radius:11px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.14);color:#fff;font-weight:700}.pp-select option{background:#fff;color:#182044}.pp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:14px}.pp-stat{padding:12px;border-radius:15px;background:#fff;border:1px solid #e9ebf4;box-shadow:0 5px 18px rgba(31,39,79,.05)}.pp-stat-icon{font-size:13px}.pp-stat b{display:block;margin-top:5px;font-size:20px;color:#1b2345}.pp-stat span{font-size:9px;color:#7b8299;font-weight:700}.pp-section{margin:15px 1px 9px;display:flex;justify-content:space-between;align-items:center}.pp-section strong{font-size:14px}.pp-section span{font-size:9px;color:#7b8299}.pp-panel{border:1px solid #e9ebf4;border-radius:17px;background:#fff;padding:13px;box-shadow:0 5px 18px rgba(31,39,79,.045)}.pp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #f0f1f6}.pp-row:last-child{border-bottom:0}.pp-row-main{display:flex;align-items:center;gap:9px}.pp-icon{width:31px;height:31px;border-radius:10px;background:#f1efff;display:grid;place-items:center;font-size:13px}.pp-title{font-size:11px;font-weight:800}.pp-sub{font-size:9px;color:#7b8299;margin-top:2px}.pp-note{font-size:10px;color:#7b8299;line-height:1.5}.pp-home-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.pp-home-action{padding:13px;border-radius:15px;background:#f8f8fe;border:1px solid #ececf8;text-align:left;color:#182044}.pp-home-action b{display:block;font-size:11px;margin-top:7px}.pp-home-action small{display:block;color:#7b8299;font-size:9px;margin-top:2px}@media(max-width:420px){.pp-hero{padding:18px}.pp-hero h1{font-size:21px}}`}</style>
      <section className="pp-hero">
        <div className="pp-eyebrow">Parent dashboard</div>
        <h1>Welcome back, {String(user?.name || "Parent").split(" ")[0]} 👋</h1>
        <p>Everything important about your child's learning, in one place.</p>
        <div className="pp-child">
          <div className="pp-avatar">{String(selected.name || "S").slice(0, 1).toUpperCase()}</div>
          <div><b>{selected.name}</b><small>Class {selected.cls}-{selected.sec} · SID {selected.sid}</small></div>
        </div>
        {children.length > 1 && <select className="pp-select" value={selected.id} onChange={(e) => setSelectedId(e.target.value)} aria-label="Select child">{children.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.sid}</option>)}</select>}
      </section>

      <div className="pp-grid">
        <div className="pp-stat"><div className="pp-stat-icon">✅</div><b>{childAttendance.length ? `${Math.round(childAttendance.filter((a) => String(a.status).toLowerCase() === "present").length / childAttendance.length * 100)}%` : "—"}</b><span>Attendance</span></div>
        <div className="pp-stat"><div className="pp-stat-icon">📝</div><b>{childHomework.length}</b><span>Homework</span></div>
        <div className="pp-stat"><div className="pp-stat-icon">📋</div><b>{childTests.filter((t) => !t.test_date || new Date(t.test_date) >= new Date()).length}</b><span>Upcoming tests</span></div>
        <div className="pp-stat"><div className="pp-stat-icon">🏆</div><b>{childResults.length ? Math.round(childResults.reduce((sum, r) => sum + Number(r.marks || 0), 0) / childResults.length) : "—"}</b><span>Average marks</span></div>
      </div>

      {tab === "home" && <>
        <div className="pp-section"><strong>Quick access</strong><span>Simple overview</span></div>
        <div className="pp-home-actions">
          <button className="pp-home-action" onClick={() => setTab("analytics")}><span>📊</span><b>Student analytics</b><small>Progress, attendance and results</small></button>
          <button className="pp-home-action" onClick={() => setTab("attendance")}><span>✅</span><b>Attendance</b><small>{childAttendance.length} recorded days</small></button>
          <button className="pp-home-action" onClick={() => setTab("homework")}><span>📝</span><b>Homework</b><small>{childHomework.length} assignments</small></button>
          <button className="pp-home-action" onClick={() => setTab("tests")}><span>📋</span><b>Tests & results</b><small>{childTests.length} scheduled tests</small></button>
        </div>
      </>}

      {tab === "analytics" && <ParentAnalytics attendance={childAttendance} results={childResults} homework={childHomework} tests={childTests} fees={childFees} materials={childMaterials} />}

      {tab === "attendance" && <><div className="pp-section"><strong>Attendance</strong><span>{childAttendance.length} records</span></div><div className="pp-panel">{childAttendance.length ? childAttendance.map((a) => <div className="pp-row" key={a.id}><div><div className="pp-title">Attendance</div><div className="pp-sub">{a.date}</div></div><Badge label={a.status} /></div>) : <div className="pp-note">No attendance records found.</div>}</div></>}
      {tab === "fees" && <><div className="pp-section"><strong>Fees</strong><span>{childFees.length} records</span></div><div className="pp-panel">{childFees.length ? childFees.map((f) => <div className="pp-row" key={f.id}><div><div className="pp-title">{f.desc || "Fee"}</div><div className="pp-sub">Due {f.due || "—"} · {f.status || "—"}</div></div><b style={{ fontSize: 12 }}>₹{Number(f.amount || 0).toLocaleString("en-IN")}</b></div>) : <div className="pp-note">No fee records found.</div>}</div></>}
      {tab === "timetable" && <><div className="pp-section"><strong>Classes</strong><span>{childTimetable.length} entries</span></div><div className="pp-panel">{childTimetable.length ? childTimetable.map((t) => <div className="pp-row" key={t.id}><div><div className="pp-title">{t.subject_name || t.subject || "Class"}</div><div className="pp-sub">{t.day || t.day_of_week || "Scheduled"} · {String(t.start_time || "").slice(0, 5)}–{String(t.end_time || "").slice(0, 5)}</div></div></div>) : <div className="pp-note">No timetable entries found.</div>}</div></>}
      {tab === "homework" && <ParentHomework homework={childHomework} />}
      {tab === "tests" && <><div className="pp-section"><strong>Tests</strong><span>{childTests.length} scheduled</span></div><div className="pp-panel">{childTests.length ? childTests.map((t) => <div className="pp-row" key={t.id}><div><div className="pp-title">{t.title}</div><div className="pp-sub">{t.subject || "Assessment"} · {t.test_date || "Date not set"}</div></div></div>) : <div className="pp-note">No tests scheduled.</div>}</div></>}
      {tab === "results" && <><div className="pp-section"><strong>Results</strong><span>{childResults.length} recorded</span></div><div className="pp-panel">{childResults.length ? childResults.map((r) => <div className="pp-row" key={r.id}><div><div className="pp-title">Assessment result</div><div className="pp-sub">Test result</div></div><b>{r.marks}</b></div>) : <div className="pp-note">No results recorded yet.</div>}</div></>}
      {tab === "materials" && <><div className="pp-section"><strong>Materials</strong><span>{childMaterials.length} resources</span></div><div className="pp-panel">{childMaterials.length ? childMaterials.map((m) => <div className="pp-row" key={m.id}><div className="pp-row-main"><div className="pp-icon">📚</div><div className="pp-title">{m.name || m.title}</div></div></div>) : <div className="pp-note">No learning materials found.</div>}</div></>}
    </main>
  );

  return <><Shell header={<AppBar name={user.name} role="parent" userId={user.id} onLogout={onLogout} onNotif={() => setShowNotif(true)} />} tabs={tabs} activeTab={tab} setTab={setTab}>{content}</Shell>{showNotif && <ParentNotifications onClose={() => setShowNotif(false)} />}</>;
}
