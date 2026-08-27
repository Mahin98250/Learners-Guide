import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { Badge, Card, Shell, AppBar } from "@/lg/ui";
import { ParentNotifications } from "@/lg/ParentNotifications";
import { ParentHomework } from "@/lg/ParentHomework";

const empty = { data: [], error: null };
const safe = (promise) => promise.then((r) => r || empty).catch(() => empty);

function pct(value) { return value == null ? "—" : `${Math.round(value)}%`; }

export function ParentApp({ user, onLogout }) {
  const [children, setChildren] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [homework, setHomework] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [batches, setBatches] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNotif, setShowNotif] = useState(false);

  const selected = useMemo(() => children.find((c) => String(c.id) === String(selectedId)) || children[0] || null, [children, selectedId]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const authId = auth?.user?.id;
      if (!authId) throw new Error("Parent session expired. Please sign in again.");

      const { data: links, error: linkError } = await supabase.from("parent_student_links").select("student_id,status").eq("parent_auth_id", authId).eq("status", "active");
      if (linkError) throw linkError;
      const ids = [...new Set((links || []).map((x) => String(x.student_id)).filter(Boolean))];
      if (!ids.length && user?.ref) ids.push(String(user.ref));
      if (!ids.length) { setChildren([]); setBatches([]); return; }

      const { data: students, error: studentError } = await supabase.from("students").select("id,name,sid,cls,sec").in("id", ids);
      if (studentError) throw studentError;
      setChildren(students || []);
      setSelectedId((cur) => cur && students?.some((s) => String(s.id) === String(cur)) ? cur : students?.[0]?.id || null);

      const { data: members, error: memberError } = await supabase.from("batch_students").select("student_id,batch_id,status").in("student_id", ids).eq("status", "active");
      if (memberError) throw memberError;
      setBatches(members || []);
      const batchIds = [...new Set((members || []).map((x) => String(x.batch_id)).filter(Boolean))];

      const [tr, ar, fr, hw, test] = await Promise.all([
        batchIds.length ? safe(supabase.from("timetable_entries").select("id,batch_id,subject_name,subject,start_time,end_time,status,day,day_of_week").in("batch_id", batchIds).eq("status", "active")) : Promise.resolve(empty),
        safe(supabase.from("attendance").select("id,sid,date,status").in("sid", ids).order("date", { ascending: false })),
        safe(supabase.from("fees").select("id,sid,desc,amount,status,due").in("sid", ids).order("due")),
        batchIds.length ? safe(supabase.from("homework").select("id,batch_id,subject,title,desc,given,due,created_at,pdfname").in("batch_id", batchIds).order("created_at", { ascending: false })) : Promise.resolve(empty),
        batchIds.length ? safe(supabase.from("tests").select("id,title,description,batch_id,subject,test_date,total_marks,status").in("batch_id", batchIds).order("test_date")) : Promise.resolve(empty)
      ]);
      setTimetable(tr.data || []); setAttendance(ar.data || []); setFees(fr.data || []); setHomework(hw.data || []); setTests(test.data || []);

      const testIds = (test.data || []).map((x) => String(x.id)).filter(Boolean);
      const rr = testIds.length ? await safe(supabase.from("test_results").select("id,student_id,test_id,marks").in("test_id", testIds)) : empty;
      setResults(rr.data || []);
      const mat = batchIds.length ? await safe(supabase.from("materials").select("id,title,name,storage_path,mime_type,batch_id,created_at").in("batch_id", batchIds).order("created_at", { ascending: false })) : empty;
      setMaterials(mat.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load parent data.");
    } finally { setLoading(false); }
  }, [user?.ref]);

  useEffect(() => { void load(); }, [load]);

  const childBatches = batches.filter((m) => String(m.student_id) === String(selected?.id));
  const batchIds = new Set(childBatches.map((m) => String(m.batch_id)));
  const childAttendance = attendance.filter((a) => String(a.sid) === String(selected?.id));
  const childFees = fees.filter((f) => String(f.sid) === String(selected?.id));
  const childTests = tests.filter((t) => batchIds.has(String(t.batch_id)));
  const childResults = results.filter((r) => String(r.student_id) === String(selected?.id));
  const childHomework = homework.filter((h) => batchIds.has(String(h.batch_id)));
  const childTimetable = timetable.filter((t) => batchIds.has(String(t.batch_id)));
  const childMaterials = materials.filter((m) => batchIds.has(String(m.batch_id)));
  const present = childAttendance.filter((a) => String(a.status).toLowerCase() === "present").length;
  const attendanceRate = childAttendance.length ? present / childAttendance.length * 100 : null;
  const numericResults = childResults.map((r) => Number(r.marks)).filter(Number.isFinite);
  const averageMarks = numericResults.length ? numericResults.reduce((a, b) => a + b, 0) / numericResults.length : null;
  const pendingFees = childFees.filter((f) => !["paid", "completed"].includes(String(f.status || "").toLowerCase()));
  const upcomingTests = childTests.filter((t) => !t.test_date || new Date(t.test_date) >= new Date()).length;

  const content = loading ? <Card>Loading your child's data…</Card> : error ? <Card><div style={{ color: "#c0392b", marginBottom: 10 }}>{error}</div><button onClick={() => void load()}>Try again</button></Card> : !selected ? <Card>No student is linked to this parent account.</Card> : (
    <div className="parent-portal"><style>{`.parent-portal{--ink:#182044;--muted:#737b95;--line:#e9ebf5;--accent:#6357e8;padding-bottom:24px}.pp-hero{padding:20px;border-radius:22px;background:linear-gradient(135deg,#5146d9,#8a7cf4);color:#fff;margin-bottom:14px;box-shadow:0 12px 28px rgba(83,70,210,.18)}.pp-hero h2{margin:4px 0;font-size:23px}.pp-hero p{margin:0;opacity:.82;font-size:12px}.pp-child{display:flex;align-items:center;gap:10px;margin-top:15px}.pp-avatar{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.18);font-weight:900;font-size:19px}.pp-select{width:100%;margin-top:12px;padding:9px 10px;border-radius:11px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.14);color:#fff;font-weight:700}.pp-select option{color:#182044;background:#fff}.pp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:15px}.pp-stat{padding:13px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 5px 18px rgba(32,39,84,.05)}.pp-stat b{display:block;font-size:20px;color:var(--ink);margin-top:7px}.pp-stat span{font-size:10px;color:var(--muted);font-weight:700}.pp-section{margin:15px 1px 9px;display:flex;justify-content:space-between;align-items:center}.pp-section strong{font-size:14px;color:var(--ink)}.pp-section span{font-size:10px;color:var(--muted)}.pp-panel{border:1px solid var(--line);border-radius:17px;background:#fff;padding:13px;box-shadow:0 5px 18px rgba(32,39,84,.045)}.pp-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f1f6}.pp-row:last-child{border-bottom:0}.pp-row-main{display:flex;align-items:center;gap:9px}.pp-icon{width:31px;height:31px;border-radius:10px;background:#f1efff;display:grid;place-items:center;font-size:13px}.pp-title{font-size:11px;font-weight:800;color:var(--ink)}.pp-sub{font-size:9px;color:var(--muted);margin-top:2px}.pp-analytics{display:grid;gap:10px}.pp-progress{height:8px;border-radius:99px;background:#eceef7;overflow:hidden}.pp-progress i{display:block;height:100%;background:linear-gradient(90deg,#6357e8,#8b7ff4);border-radius:inherit}.pp-note{font-size:10px;color:var(--muted);line-height:1.5}@media(max-width:420px){.pp-hero{padding:18px}.pp-hero h2{font-size:21px}}`}</style>
      <div className="pp-hero"><div style={{fontSize:10,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase",opacity:.75}}>Parent dashboard</div><h2>Welcome back, {String(user?.name || "Parent").split(" ")[0]} 👋</h2><p>Everything important about your child's learning, in one place.</p><div className="pp-child"><div className="pp-avatar">{String(selected.name || "S").slice(0,1).toUpperCase()}</div><div><b>{selected.name}</b><div style={{fontSize:10,opacity:.78}}>Class {selected.cls}-{selected.sec} · SID {selected.sid}</div></div></div>{children.length>1&&<select className="pp-select" value={selected.id} onChange={(e)=>setSelectedId(e.target.value)} aria-label="Select child">{children.map((c)=><option key={c.id} value={c.id}>{c.name} · {c.sid}</option>)}</select>}</div>
      <div className="pp-grid"><div className="pp-stat">✓<b>{pct(attendanceRate)}</b><span>Attendance</span></div><div className="pp-stat">📝<b>{childHomework.length}</b><span>Homework</span></div><div className="pp-stat">📋<b>{upcomingTests}</b><span>Upcoming tests</span></div><div className="pp-stat">🏆<b>{averageMarks == null ? "—" : Math.round(averageMarks)}</b><span>Avg. result</span></div></div>
      {tab === "home" && <><div className="pp-section"><strong>Student analytics</strong><span>Live overview</span></div><div className="pp-panel pp-analytics"><div><div className="pp-row" style={{border:0,paddingTop:0}}><div className="pp-row-main"><div className="pp-icon">✓</div><div><div className="pp-title">Attendance</div><div className="pp-sub">{present} present out of {childAttendance.length} recorded days</div></div></div><div className="pp-progress"><i style={{width:`${Math.min(100,Math.max(0,attendanceRate||0))}%`}}/></div></div><div className="pp-row"><div className="pp-row-main"><div className="pp-icon">🏆</div><div><div className="pp-title">Academic results</div><div className="pp-sub">{childResults.length ? `${childResults.length} recorded results · average ${Math.round(averageMarks)}` : "No results recorded yet"}</div></div></div></div><div className="pp-row"><div className="pp-row-main"><div className="pp-icon">📝</div><div><div className="pp-title">Homework</div><div className="pp-sub">{childHomework.length} assignments available</div></div></div></div><div className="pp-row"><div className="pp-row-main"><div className="pp-icon">💰</div><div><div className="pp-title">Fees</div><div className="pp-sub">{pendingFees.length ? `${pendingFees.length} unpaid or pending item${pendingFees.length>1?"s":""}` : "No pending fee items"}</div></div></div></div></div><div className="pp-note" style={{marginTop:8}}>Analytics are calculated from the records currently available for this student.</div></>}
      {tab === "attendance" && <><div className="pp-section"><strong>Attendance</strong><span>{childAttendance.length} records</span></div><div className="pp-panel">{childAttendance.length ? childAttendance.map((a)=><div className="pp-row" key={a.id}><div><div className="pp-title">Attendance</div><div className="pp-sub">{a.date}</div></div><Badge label={a.status}/></div>) : <div className="pp-note">No attendance records found.</div>}</div></>}
      {tab === "fees" && <><div className="pp-section"><strong>Fees</strong><span>{childFees.length} records</span></div><div className="pp-panel">{childFees.length ? childFees.map((f)=><div className="pp-row" key={f.id}><div><div className="pp-title">{f.desc || "Fee"}</div><div className="pp-sub">Due {f.due || "—"} · {f.status || "—"}</div></div><b style={{fontSize:12}}>₹{Number(f.amount || 0).toLocaleString("en-IN")}</b></div>) : <div className="pp-note">No fee records found.</div>}</div></>}
      {tab === "timetable" && <><div className="pp-section"><strong>Classes</strong><span>{childTimetable.length} entries</span></div><div className="pp-panel">{childTimetable.length ? childTimetable.map((t)=><div className="pp-row" key={t.id}><div><div className="pp-title">{t.subject_name || t.subject || "Class"}</div><div className="pp-sub">{t.day || t.day_of_week || "Scheduled"} · {String(t.start_time || "").slice(0,5)}–{String(t.end_time || "").slice(0,5)}</div></div></div>) : <div className="pp-note">No timetable entries found.</div>}</div></>}
      {tab === "homework" && <ParentHomework homework={childHomework}/>} 
      {tab === "tests" && <><div className="pp-section"><strong>Tests</strong><span>{childTests.length} scheduled</span></div><div className="pp-panel">{childTests.length ? childTests.map((t)=><div className="pp-row" key={t.id}><div><div className="pp-title">{t.title}</div><div className="pp-sub">{t.subject || "Assessment"} · {t.test_date || "Date not set"}</div></div></div>) : <div className="pp-note">No tests scheduled.</div>}</div></>}
      {tab === "results" && <><div className="pp-section"><strong>Results</strong><span>{childResults.length} recorded</span></div><div className="pp-panel">{childResults.length ? childResults.map((r)=><div className="pp-row" key={r.id}><div><div className="pp-title">Assessment result</div><div className="pp-sub">Test result</div></div><b>{r.marks}</b></div>) : <div className="pp-note">No results recorded yet.</div>}</div></>}
      {tab === "materials" && <><div className="pp-section"><strong>Materials</strong><span>{childMaterials.length} resources</span></div><div className="pp-panel">{childMaterials.length ? childMaterials.map((m)=><div className="pp-row" key={m.id}><div className="pp-row-main"><div className="pp-icon">📚</div><div className="pp-title">{m.name || m.title}</div></div></div>) : <div className="pp-note">No learning materials found.</div>}</div></>}
    </div>
  );

  const tabs = [{key:"home",icon:"🏠",label:"Home"},{key:"timetable",icon:"🗓️",label:"Classes"},{key:"attendance",icon:"✅",label:"Attend."},{key:"homework",icon:"📝",label:"HW"},{key:"tests",icon:"📋",label:"Tests"},{key:"results",icon:"🏆",label:"Results"},{key:"materials",icon:"📚",label:"Materials"},{key:"fees",icon:"💰",label:"Fees"}];
  return <><Shell header={<AppBar name={user.name} role="parent" userId={user.id} onLogout={onLogout} onNotif={()=>setShowNotif(true)}/>} tabs={tabs} activeTab={tab} setTab={setTab}>{content}</Shell>{showNotif&&<ParentNotifications onClose={()=>setShowNotif(false)}/>}</>;
}
