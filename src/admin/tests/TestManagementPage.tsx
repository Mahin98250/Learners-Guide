import { useCallback, useEffect, useMemo, useState } from "react";
import { addR, gdb, updR, SUBJECTS_BY_CLASS } from "@/lg/data";
import { supabase } from "@/lg/supabase";

type Row = Record<string, any> & { id: string | number };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, boxShadow: "0 4px 20px rgba(15,27,61,.07)" };
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: 44, marginTop: 6, padding: "10px 12px", border: "1.5px solid #CBD5E1", borderRadius: 10, background: "#fff", color: "#0F1B3D", fontSize: 15, outline: "none" };
const label: React.CSSProperties = { display: "block", fontWeight: 700, color: "#0F1B3D" };
const btn = (background: string, color = "#fff"): React.CSSProperties => ({ border: 0, borderRadius: 11, padding: "10px 14px", background, color, fontWeight: 800, cursor: "pointer" });

async function ensureAdmin() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Administrator session is required. Please sign in again.");
  if (data.session.user.app_metadata?.role !== "admin") throw new Error("Administrator access is required.");
  return data.session;
}

export default function TestManagementPage() {
  const [tests, setTests] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [selectedTest, setSelectedTest] = useState<Row | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [draftResults, setDraftResults] = useState<Record<string, { marks: string; remarks: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStudent, setSavingStudent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ title: "", description: "", batch_id: "", subject: "", test_date: new Date().toISOString().slice(0, 10), total_marks: "100" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      await ensureAdmin();
      const [ts, bs, ss] = await Promise.all([gdb("tests"), gdb("batches"), gdb("students")]);
      setTests((ts as Row[]).sort((a,b) => String(b.test_date).localeCompare(String(a.test_date))));
      setBatches(bs as Row[]); setStudents(ss as Row[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load tests."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedBatch = useMemo(() => batches.find(x => String(x.id) === String(form.batch_id)), [batches, form.batch_id]);
  const subjectOptions = useMemo(() => {
    const cls = Number(selectedBatch?.cls);
    if (!Number.isInteger(cls)) return [];
    const options = (SUBJECTS_BY_CLASS as Record<string, unknown>)[String(cls)];
    return Array.isArray(options) ? options : [];
  }, [selectedBatch]);

  const batchStudents = useMemo(() => {
    if (!selectedTest) return [];
    const b = batches.find(x => String(x.id) === String(selectedTest.batch_id));
    const ids = Array.isArray(b?.studentids) ? b.studentids : Array.isArray(b?.studentIds) ? b.studentIds : [];
    const byIds = ids.length ? students.filter(s => ids.map(String).includes(String(s.id))) : students.filter(s => String(s.cls) === String(b?.cls) && String(s.sec) === String(b?.sec));
    return byIds.sort((a,b) => String(a.sid).localeCompare(String(b.sid), undefined, { numeric: true }));
  }, [selectedTest, batches, students]);

  const openResults = async (test: Row) => {
    setSelectedTest(test); setError(""); setSuccess("");
    try {
      const rs = await gdb("test_results");
      const filtered = (rs as Row[]).filter(r => String(r.test_id) === String(test.id));
      setResults(filtered);
      const drafts: Record<string, { marks: string; remarks: string }> = {};
      for (const r of filtered) drafts[String(r.student_id)] = { marks: r.marks == null ? "" : String(r.marks), remarks: r.remarks == null ? "" : String(r.remarks) };
      setDraftResults(drafts);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load results."); }
  };

  const saveTest = async () => {
    if (!form.title.trim() || !form.batch_id || !form.subject || !form.test_date || Number(form.total_marks) <= 0) { setError("Fill Test Name, Batch, Subject, Date and Total Marks."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const session = await ensureAdmin();
      await addR("tests", { id: `test-${Date.now()}`, title: form.title.trim(), description: form.description.trim() || null, batch_id: form.batch_id, subject: form.subject, test_date: form.test_date, total_marks: Number(form.total_marks), status: "scheduled", created_by: session.user.id });
      setSuccess("Test created successfully. Students in the batch have been notified.");
      setForm({ title: "", description: "", batch_id: "", subject: "", test_date: new Date().toISOString().slice(0, 10), total_marks: "100" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create test."); }
    finally { setSaving(false); }
  };

  const updateDraft = (studentId: string | number, key: "marks" | "remarks", value: string) => {
    const id = String(studentId);
    setDraftResults(prev => ({ ...prev, [id]: { marks: prev[id]?.marks ?? "", remarks: prev[id]?.remarks ?? "", [key]: value } }));
  };

  const saveOneResult = async (student: Row) => {
    if (!selectedTest) return false;
    const draft = draftResults[String(student.id)] || { marks: "", remarks: "" };
    if (draft.marks.trim() === "") { setError(`Enter marks for ${student.name}.`); return false; }
    const marks = Number(draft.marks);
    if (!Number.isFinite(marks) || marks < 0 || marks > Number(selectedTest.total_marks)) { setError(`Marks for ${student.name} must be between 0 and ${selectedTest.total_marks}.`); return false; }
    const existing = results.find(r => String(r.student_id) === String(student.id));
    const payload = { test_id: String(selectedTest.id), student_id: String(student.id), marks, remarks: draft.remarks.trim() || null };
    if (existing) {
      const updated = await updR("test_results", existing.id, payload);
      setResults(prev => prev.map(r => String(r.id) === String(existing.id) ? { ...r, ...updated } : r));
    } else {
      const row = await addR("test_results", { id: `result-${Date.now()}-${student.id}`, ...payload });
      setResults(prev => [...prev, row as Row]);
    }
    return true;
  };

  const saveResult = async (student: Row) => {
    setSavingStudent(String(student.id)); setError(""); setSuccess("");
    try {
      const ok = await saveOneResult(student);
      if (ok) setSuccess(`${student.name}'s result saved successfully.`);
    } catch (e) { setError(e instanceof Error ? e.message : `Unable to save ${student.name}'s result.`); }
    finally { setSavingStudent(null); }
  };

  const saveAllResults = async () => {
    if (!selectedTest || !batchStudents.length) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const invalid = batchStudents.find(s => {
        const marks = draftResults[String(s.id)]?.marks ?? "";
        return marks.trim() === "" || !Number.isFinite(Number(marks)) || Number(marks) < 0 || Number(marks) > Number(selectedTest.total_marks);
      });
      if (invalid) throw new Error(`Please enter valid marks for ${invalid.name}. Marks must be between 0 and ${selectedTest.total_marks}.`);
      let savedCount = 0;
      for (const student of batchStudents) {
        if (await saveOneResult(student)) savedCount += 1;
      }
      const fresh = await gdb("test_results");
      const filtered = (fresh as Row[]).filter(r => String(r.test_id) === String(selectedTest.id));
      setResults(filtered);
      const drafts: Record<string, { marks: string; remarks: string }> = {};
      for (const r of filtered) drafts[String(r.student_id)] = { marks: r.marks == null ? "" : String(r.marks), remarks: r.remarks == null ? "" : String(r.remarks) };
      setDraftResults(drafts);
      setSuccess(`All ${savedCount} student results saved successfully.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save all student results."); }
    finally { setSaving(false); }
  };

  return <div style={{ minHeight: "100%", padding: 22, background: "#F0F4FF", color: "#0F1B3D" }}>
    <div style={{ marginBottom: 18 }}><h1 style={{ margin: 0, fontSize: 24 }}>Tests & Results</h1><p style={{ margin: "6px 0", color: "#64748B" }}>Create tests for a batch, notify students, and enter results student-by-student.</p></div>
    {error && <div style={{ ...card, padding: 12, marginBottom: 12, color: "#B91C1C", background: "#FEF2F2" }}>{error}</div>}
    {success && <div style={{ ...card, padding: 12, marginBottom: 12, color: "#166534", background: "#F0FDF4" }}>{success}</div>}
    <div style={{ ...card, padding: 20, marginBottom: 18 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Create Test</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
        <label style={label}>Test Name<input style={field} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Unit Test 1" /></label>
        <label style={label}>Batch<select style={field} value={form.batch_id} onChange={e=>setForm({...form,batch_id:e.target.value,subject:""})}><option value="">Select batch…</option>{batches.map(b=><option key={String(b.id)} value={String(b.id)}>{b.name} {b.cls ? `· Class ${b.cls}${b.sec ? `-${b.sec}` : ""}` : ""}</option>)}</select></label>
        <label style={label}>Subject<select style={field} value={form.subject} disabled={!form.batch_id} onChange={e=>setForm({...form,subject:e.target.value})}><option value="">{form.batch_id ? "Select subject…" : "Select batch first…"}</option>{subjectOptions.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></label>
        <label style={label}>Test Date<input style={field} type="date" value={form.test_date} onChange={e=>setForm({...form,test_date:e.target.value})} /></label>
        <label style={label}>Total Marks<input style={field} type="number" min="1" value={form.total_marks} onChange={e=>setForm({...form,total_marks:e.target.value})} /></label>
      </div>
      <label style={{...label,marginTop:14}}>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Optional instructions or syllabus" style={{...field,minHeight:78,resize:"vertical"}} /></label>
      <button disabled={saving} onClick={saveTest} style={{...btn("#4361EE"),marginTop:14,opacity:saving?.6:1}}>➕ Create Test & Notify Students</button>
    </div>
    <div style={{ ...card, padding: 20 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Scheduled Tests</h2>
      {loading ? <p>Loading…</p> : tests.length === 0 ? <p style={{color:"#64748B"}}>No tests created yet.</p> : <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Test","Batch","Subject","Date","Total","Status","Action"].map(x=><th key={x} style={{textAlign:"left",padding:10,borderBottom:"1px solid #E2E8F0",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead><tbody>{tests.map(t=>{const b=batches.find(x=>String(x.id)===String(t.batch_id)); return <tr key={String(t.id)}><td style={{padding:10}}>{t.title}</td><td style={{padding:10}}>{b?.name || t.batch_id}</td><td style={{padding:10}}>{t.subject}</td><td style={{padding:10}}>{t.test_date}</td><td style={{padding:10}}>{t.total_marks}</td><td style={{padding:10}}>{t.status}</td><td style={{padding:10}}><button onClick={()=>openResults(t)} style={btn("#8B5CF6")}>Enter Results</button></td></tr>})}</tbody></table></div>}
    </div>
    {selectedTest && <div style={{...card,padding:20,marginTop:18}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:17}}>{selectedTest.title} — Results</h2><p style={{margin:"5px 0",color:"#64748B"}}>{selectedTest.subject} · Total {selectedTest.total_marks} · {batchStudents.length} students</p></div><div style={{display:"flex",gap:8}}><button disabled={saving} onClick={saveAllResults} style={{...btn("#16A34A"),opacity:saving?.6:1}}>💾 Save All Results</button><button onClick={()=>{setSelectedTest(null);setDraftResults({})}} style={btn("#64748B")}>Close</button></div></div>{batchStudents.length===0?<p style={{color:"#64748B"}}>No students found for this batch.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:10}}>Roll</th><th style={{textAlign:"left",padding:10}}>Student</th><th style={{textAlign:"left",padding:10}}>Marks</th><th style={{textAlign:"left",padding:10}}>Remarks</th><th style={{padding:10}}>Save</th></tr></thead><tbody>{batchStudents.map(s=>{const draft=draftResults[String(s.id)]||{marks:"",remarks:""}; const isRowSaving=savingStudent===String(s.id); return <tr key={String(s.id)}><td style={{padding:10}}>{s.sid}</td><td style={{padding:10}}>{s.name}</td><td style={{padding:10}}><input value={draft.marks} onChange={e=>updateDraft(s.id,"marks",e.target.value)} type="number" min="0" max={selectedTest.total_marks} style={{...field,width:110,marginTop:0}} /></td><td style={{padding:10}}><input value={draft.remarks} onChange={e=>updateDraft(s.id,"remarks",e.target.value)} placeholder="Optional" style={{...field,minWidth:180,marginTop:0}} /></td><td style={{padding:10,textAlign:"center"}}><button disabled={saving||isRowSaving} onClick={()=>void saveResult(s)} style={{...btn("#22C55E"),opacity:(saving||isRowSaving)?.6:1}}>{isRowSaving?"Saving…":"Save"}</button></td></tr>})}</tbody></table></div>}</div>}
  </div>;
}