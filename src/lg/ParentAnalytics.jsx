import React from "react";

export function ParentAnalytics({ attendance, results, homework, tests, fees, materials }) {
  const total = attendance.length;
  const present = attendance.filter((a) => String(a.status).toLowerCase() === "present").length;
  const attendanceRate = total ? Math.round((present / total) * 100) : null;
  const marks = results.map((r) => Number(r.marks)).filter(Number.isFinite);
  const average = marks.length ? Math.round(marks.reduce((a, b) => a + b, 0) / marks.length) : null;
  const pendingFees = fees.filter((f) => !["paid", "completed"].includes(String(f.status || "").toLowerCase()));
  const upcoming = tests.filter((t) => !t.test_date || new Date(t.test_date) >= new Date()).length;

  return (
    <section className="pa-card" aria-label="Student analytics">
      <div className="pa-head">
        <div>
          <div className="pa-eyebrow">Student analytics</div>
          <h3>Learning snapshot</h3>
        </div>
        <span className="pa-live">LIVE</span>
      </div>
      <div className="pa-kpis">
        <div className="pa-kpi"><span>✓</span><strong>{attendanceRate == null ? "—" : `${attendanceRate}%`}</strong><small>Attendance</small></div>
        <div className="pa-kpi"><span>🏆</span><strong>{average == null ? "—" : average}</strong><small>Avg. marks</small></div>
        <div className="pa-kpi"><span>📝</span><strong>{homework.length}</strong><small>Homework</small></div>
        <div className="pa-kpi"><span>📋</span><strong>{upcoming}</strong><small>Upcoming tests</small></div>
      </div>
      <div className="pa-progress-wrap">
        <div className="pa-progress-label"><span>Attendance progress</span><b>{attendanceRate == null ? "No data" : `${present}/${total} days present`}</b></div>
        <div className="pa-progress"><i style={{ width: `${attendanceRate == null ? 0 : Math.min(100, Math.max(0, attendanceRate))}%` }} /></div>
      </div>
      <div className="pa-list">
        <div><span>💰</span><b>Fees</b><small>{pendingFees.length ? `${pendingFees.length} pending item${pendingFees.length > 1 ? "s" : ""}` : "No pending fees"}</small></div>
        <div><span>📚</span><b>Materials</b><small>{materials.length} learning resource{materials.length === 1 ? "" : "s"}</small></div>
        <div><span>🎯</span><b>Tests</b><small>{results.length ? `${results.length} results recorded` : "No results recorded yet"}</small></div>
      </div>
      <style>{`.pa-card{border:1px solid #e8eaf4;border-radius:20px;background:#fff;box-shadow:0 8px 24px rgba(31,39,79,.06);padding:15px}.pa-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:13px}.pa-eyebrow{font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#7c83a0}.pa-head h3{margin:3px 0 0;font-size:16px;color:#1b2345}.pa-live{font-size:8px;font-weight:800;letter-spacing:.08em;padding:5px 7px;border-radius:999px;background:#edf9f3;color:#16945a}.pa-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pa-kpi{padding:11px;border-radius:14px;background:#f8f8fe;border:1px solid #efeff9}.pa-kpi span{font-size:13px}.pa-kpi strong{display:block;font-size:20px;color:#1b2345;margin-top:5px}.pa-kpi small{font-size:9px;color:#78809a;font-weight:700}.pa-progress-wrap{margin-top:13px}.pa-progress-label{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#7a8198;margin-bottom:6px}.pa-progress-label b{color:#343b5b}.pa-progress{height:7px;border-radius:999px;background:#eceef7;overflow:hidden}.pa-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6357e8,#8b7ff4)}.pa-list{margin-top:12px;border-top:1px solid #f0f1f6}.pa-list>div{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #f0f1f6}.pa-list>div:last-child{border-bottom:0}.pa-list span{width:28px;height:28px;border-radius:9px;background:#f2f0ff;display:grid;place-items:center;font-size:13px}.pa-list b{font-size:10px;color:#202746}.pa-list small{font-size:9px;color:#7d849b;text-align:right}@media(max-width:360px){.pa-kpi strong{font-size:18px}.pa-list>div{grid-template-columns:26px 1fr}.pa-list small{grid-column:2;text-align:left}}`}</style>
    </section>
  );
}
