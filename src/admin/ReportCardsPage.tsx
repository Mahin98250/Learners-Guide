import { useEffect, useMemo, useState } from "react";
import { gdb } from "@/lg/data";
import { PeopleAnalyticsReportBridge } from "@/admin/PeopleAnalyticsReportBridge";

type Row = Record<string, any> & { id: string };
type Batch = { id: string; name: string; status?: string | null };

const clean = (value: unknown) => String(value ?? "").trim();

export default function ReportCardsPage() {
  const [students, setStudents] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [studentRows, batchRows, membershipRows] = await Promise.all([
          gdb("students"),
          gdb("batches"),
          gdb("batch_students"),
        ]);
        const memberships = membershipRows as Row[];
        const batchMap = new Map((batchRows as Row[]).map((row) => [clean(row.id), row]));
        const enriched = (studentRows as Row[]).map((student) => {
          const membership = memberships.find((row) => clean(row.student_id) === clean(student.id));
          const linkedBatch = membership ? batchMap.get(clean(membership.batch_id)) : null;
          return { ...student, batch_id: membership?.batch_id || "", batch_name: linkedBatch?.name || "", batch_status: linkedBatch?.status || "" };
        });
        if (!live) return;
        setStudents(enriched);
        setBatches((batchRows as Row[]) as Batch[]);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Unable to load students for report cards.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesStatus = !status || clean(student.status).toLowerCase() === status;
      const matchesBatch = !batch || clean(student.batch_id) === batch;
      const matchesQuery = !q || [student.name, student.sid, student.cls, student.sec, student.parentname, student.batch_name].some((value) => clean(value).toLowerCase().includes(q));
      return matchesStatus && matchesBatch && matchesQuery;
    });
  }, [students, query, batch, status]);

  if (selected) return <div className="report-card-print-host"><PeopleAnalyticsReportBridge student={selected} onClose={() => setSelected(null)} /></div>;

  return <div className="report-cards-page">
    <style>{`
      .report-cards-page{min-height:100%;padding:24px;color:#14213D;font-family:Poppins,system-ui,sans-serif}.report-cards-page *{box-sizing:border-box}.rc-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:20px}.rc-hero h2{margin:0;font-size:25px}.rc-hero p{margin:6px 0 0;color:#64748B;font-size:13px}.rc-count{background:#EEF2FF;color:#4F46E5;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800}.rc-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 180px 150px;gap:10px;margin-bottom:16px}.rc-input,.rc-select{width:100%;border:1px solid #DCE3F0;border-radius:12px;padding:11px 13px;background:#fff;color:#14213D;outline:none}.rc-table-wrap{overflow:auto;background:#fff;border:1px solid #E5E7EB;border-radius:16px;box-shadow:0 5px 22px rgba(15,27,61,.06)}.rc-table{width:100%;border-collapse:collapse;min-width:720px}.rc-table th,.rc-table td{text-align:left;padding:12px 14px;border-bottom:1px solid #EEF2F7;font-size:12px}.rc-table th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748B;background:#F8FAFF}.rc-table tr:last-child td{border-bottom:0}.rc-student{font-weight:800}.rc-muted{color:#64748B}.rc-action{border:0;border-radius:10px;padding:9px 12px;background:#5B4BFF;color:#fff;font-weight:800;cursor:pointer}.rc-action:hover{filter:brightness(.96)}.rc-empty,.rc-error{padding:32px;text-align:center;color:#64748B}.rc-error{color:#B42318}.report-card-print-host{min-height:100%}.report-card-progress{position:fixed;inset:0;display:grid;place-items:center;background:#fff;color:#14213D;font:600 14px Poppins,system-ui,sans-serif;z-index:9999}.report-card-close{position:fixed;right:20px;top:20px;z-index:10000;border:0;border-radius:10px;padding:10px 14px;background:#14213D;color:#fff;font-weight:700;cursor:pointer}@media(max-width:760px){.report-cards-page{padding:16px}.rc-hero{display:block}.rc-count{display:inline-block;margin-top:12px}.rc-toolbar{grid-template-columns:1fr}}
      @media print{.report-card-close,.report-card-progress{display:none!important}}
    `}</style>
    <div className="rc-hero"><div><h2>Report Cards</h2><p>Generate the official academic report card for any student.</p></div><span className="rc-count">{filtered.length} student{filtered.length === 1 ? "" : "s"}</span></div>
    <div className="rc-toolbar">
      <input className="rc-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, roll no., class, section…" aria-label="Search students" />
      <select className="rc-select" value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Filter by batch"><option value="">All batches</option>{batches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="rc-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="active">Active students</option><option value="inactive">Inactive students</option><option value="">All statuses</option></select>
    </div>
    {loading ? <div className="rc-empty">Loading students…</div> : error ? <div className="rc-error">Unable to load report cards: {error}</div> : <div className="rc-table-wrap"><table className="rc-table"><thead><tr><th>Student</th><th>Roll No.</th><th>Class</th><th>Section</th><th>Batch</th><th>Action</th></tr></thead><tbody>{filtered.length ? filtered.map((student) => <tr key={student.id}><td><div className="rc-student">{clean(student.name) || "Unnamed student"}</div><div className="rc-muted">{clean(student.parentname) || "No guardian name"}</div></td><td>{clean(student.sid) || "—"}</td><td>{clean(student.cls) || "—"}</td><td>{clean(student.sec) || "—"}</td><td>{clean(student.batch_name) || "—"}</td><td><button type="button" className="rc-action" onClick={() => setSelected(student)}>Generate PDF</button></td></tr>) : <tr><td colSpan={6} className="rc-empty">No students match the selected filters.</td></tr>}</tbody></table></div>}
  </div>;
}
