import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { getCurrentInstituteContext } from "@/lg/tenant";
import { LOGO_IMG_SRC } from "@/lg/ui";

type Row = Record<string, any>;
type Props = { student: Row; onReady?: () => void; onError?: (message: string) => void };

const text = (v: any) => String(v ?? "").trim();
const lower = (v: any) => text(v).toLowerCase();
const n = (v: any) => Number(v || 0);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const fmtDate = (v: any) => {
  const s = text(v);
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtMonth = (v: any) => {
  const s = text(v);
  if (!s) return "Unknown";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
const grade = (v: number | null) => v == null ? "—" : v >= 90 ? "A+" : v >= 80 ? "A" : v >= 70 ? "B+" : v >= 60 ? "B" : v >= 50 ? "C" : v >= 40 ? "D" : "F";

export function StudentReportCardPrint({ student, onReady, onError }: Props) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: any | null }>({ loading: true, error: "", data: null });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const id = text(student.id);
        const [attendance, results, marks, homework, leaves, memberships, years] = await Promise.all([
          supabase.from("attendance").select("id,sid,date,status").eq("institute_id", instituteId).eq("sid", id).order("date", { ascending: true }),
          supabase.from("test_results").select("id,test_id,student_id,marks,remarks,created_at").eq("institute_id", instituteId).eq("student_id", id).order("created_at", { ascending: true }),
          supabase.from("marks").select("id,sid,subject,exam,marks,total,totalMarks,score,date").eq("institute_id", instituteId).eq("sid", id).order("date", { ascending: true }),
          supabase.from("homework").select("id,subject,given,due,completedby,batch_id").eq("institute_id", instituteId).order("given", { ascending: true }),
          supabase.from("leave_requests").select("id,from_date,to_date,status,reason").eq("institute_id", instituteId).eq("student_id", id).order("from_date", { ascending: true }),
          supabase.from("batch_students").select("batch_id,status").eq("institute_id", instituteId).eq("student_id", id),
          supabase.from("academic_years").select("id,name,start_date,end_date,status").eq("institute_id", instituteId).order("start_date", { ascending: false }).limit(1),
        ]);
        for (const q of [attendance, results, marks, homework, leaves, memberships, years]) if (q.error) throw q.error;

        const testIds = [...new Set((results.data || []).map((r: Row) => text(r.test_id)).filter(Boolean))];
        const tests = testIds.length
          ? await supabase.from("tests").select("id,title,subject,test_date,total_marks,batch_id,status").eq("institute_id", instituteId).in("id", testIds)
          : { data: [], error: null } as any;
        if (tests.error) throw tests.error;
        const testMap = new Map((tests.data || []).map((r: Row) => [text(r.id), r]));
        const canonical = (results.data || []).map((r: Row) => ({ ...r, test: testMap.get(text(r.test_id)) })).filter((r: Row) => r.test);
        const canonicalKeys = new Set(canonical.map((r: Row) => `${lower(r.test?.subject)}|${text(r.test?.test_date)}|${n(r.marks)}`));
        const legacy = (marks.data || []).filter((r: Row) => !canonicalKeys.has(`${lower(r.subject)}|${text(r.date)}|${n(r.score ?? r.marks)}`));
        const batchIds = new Set((memberships.data || []).map((r: Row) => text(r.batch_id)).filter(Boolean));
        const homeworkRows = (homework.data || []).filter((r: Row) => !r.batch_id || batchIds.has(text(r.batch_id)));
        const batchId = [...batchIds][0] || "";
        let batch: Row | null = null;
        if (batchId) {
          const b = await supabase.from("batches").select("id,name,cls,sec,status").eq("institute_id", instituteId).eq("id", batchId).maybeSingle();
          if (b.error) throw b.error;
          batch = b.data;
        }
        if (!live) return;
        setState({ loading: false, error: "", data: { attendance: attendance.data || [], results: canonical, marks: legacy, homework: homeworkRows, leaves: leaves.data || [], academicYear: (years.data || [])[0] || null, batch } });
      } catch (e) {
        if (!live) return;
        const message = e instanceof Error ? e.message : "Unable to generate the student progress report.";
        setState({ loading: false, error: message, data: null });
        onError?.(message);
      }
    })();
    return () => { live = false; };
  }, [student.id, onError]);

  useEffect(() => {
    if (!state.loading && state.data && !state.error) onReady?.();
  }, [state.loading, state.data, state.error, onReady]);

  const data = state.data;
  const computed = useMemo(() => {
    if (!data) return null;
    const attendance = data.attendance as Row[];
    const present = attendance.filter((r) => lower(r.status) === "present").length;
    const absent = attendance.filter((r) => lower(r.status) === "absent").length;
    const leaveDays = attendance.filter((r) => ["leave", "on leave"].includes(lower(r.status))).length;
    const results = [
      ...data.results.map((r: Row) => ({ obtained: n(r.marks), total: n(r.test?.total_marks), date: r.test?.test_date, subject: text(r.test?.subject), name: text(r.test?.title) || "Assessment", remarks: text(r.remarks) })),
      ...data.marks.map((r: Row) => ({ obtained: n(r.score ?? r.marks), total: n(r.total ?? r.totalMarks), date: r.date, subject: text(r.subject), name: text(r.exam) || "Assessment", remarks: text(r.remarks) })),
    ];
    const scores = results.map((r) => r.total ? (r.obtained / r.total) * 100 : null).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const homeworkCompleted = data.homework.filter((r: Row) => Array.isArray(r.completedby) ? r.completedby.map(String).includes(text(student.id)) : text(r.completedby).split(",").map((s) => s.trim()).includes(text(student.id))).length;
    return {
      present,
      absent,
      leaveDays,
      attendanceRate: pct(present, attendance.length),
      academicAverage: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      homeworkAssigned: data.homework.length,
      homeworkCompleted,
      homeworkRate: pct(homeworkCompleted, data.homework.length),
      results,
    };
  }, [data, student.id]);

  if (state.loading) return <div className="student-report-card-print rc-state">Preparing progress report…</div>;
  if (!data || !computed) return <div className="student-report-card-print rc-state">Unable to generate progress report.</div>;

  const batch = data.batch || {};
  const cls = text(student.cls) || text(batch.cls);
  const sec = text(student.sec) || text(batch.sec);
  const academicYear = text(data.academicYear?.name) || (data.academicYear?.start_date && data.academicYear?.end_date ? `${fmtDate(data.academicYear.start_date)} – ${fmtDate(data.academicYear.end_date)}` : "—");
  const teacherName = text(student.teacher_name) || text(batch.teacher_name) || "Teacher";
  const results = computed.results;
  const subjectsMap = new Map<string, { scores: number[]; tests: number; highest: number }>();
  results.forEach((r) => {
    const subject = r.subject || "Other";
    const score = r.total ? (r.obtained / r.total) * 100 : null;
    if (score == null || !Number.isFinite(score)) return;
    const current = subjectsMap.get(subject) || { scores: [], tests: 0, highest: 0 };
    current.scores.push(score);
    current.tests += 1;
    current.highest = Math.max(current.highest, score);
    subjectsMap.set(subject, current);
  });
  const subjects = [...subjectsMap.entries()].map(([subject, value]) => ({ subject, tests: value.tests, average: Math.round(value.scores.reduce((a, b) => a + b, 0) / value.scores.length), highest: Math.round(value.highest) })).sort((a, b) => a.subject.localeCompare(b.subject));
  const monthly = new Map<string, { present: number; absent: number; leave: number }>();
  data.attendance.forEach((r: Row) => {
    const key = fmtMonth(r.date);
    const current = monthly.get(key) || { present: 0, absent: 0, leave: 0 };
    const status = lower(r.status);
    if (status === "present") current.present += 1;
    else if (status === "absent") current.absent += 1;
    else if (status === "leave" || status === "on leave") current.leave += 1;
    monthly.set(key, current);
  });
  const leaveRows = (data.leaves as Row[]).slice(-8);
  const recentRemarks = results.map((r) => r.remarks).filter(Boolean).slice(-4);

  return (
    <div className="student-report-card-print">
      <style>{`
        @page{size:A4 portrait;margin:0}
        html,body{margin:0!important;padding:0!important;background:#fff!important}
        .student-report-card-print{display:none;color:#172033;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:1.3}
        .student-report-card-print *{box-sizing:border-box}
        .rc-sheet{width:210mm;height:297mm;padding:12mm 14mm 12mm;position:relative;background:#fff;overflow:hidden}
        .rc-sheet+.rc-sheet{break-before:page}
        .rc-top{text-align:center;border-bottom:2px solid #172033;padding-bottom:6px;margin-bottom:8px}
        .rc-logo{display:block;width:64px;height:64px;object-fit:contain;margin:0 auto 4px}
        .rc-institute{font-size:17px;font-weight:800;letter-spacing:.9px}.rc-doc{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}.rc-period{font-size:7.5px;color:#687386;margin-top:2px}
        .rc-heading{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #172033;padding-bottom:3px;margin:0 0 5px}
        .rc-info{display:grid;grid-template-columns:1fr 1fr;border:1px solid #aeb7c4;margin-bottom:7px}.rc-field{padding:4.5px 6px;border-right:1px solid #aeb7c4;border-bottom:1px solid #aeb7c4;min-height:27px}.rc-field:nth-child(2n){border-right:0}.rc-field:nth-last-child(-n+2){border-bottom:0}.rc-label{display:block;font-size:6.5px;color:#697386;text-transform:uppercase;font-weight:700;letter-spacing:.35px}.rc-value{font-size:8.7px;font-weight:700;margin-top:1px}
        .rc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:7px}.rc-kpi{border:1px solid #aeb7c4;text-align:center;padding:5px 3px}.rc-kpi strong{display:block;font-size:13px;line-height:1.05}.rc-kpi span{font-size:6.3px;color:#697386;text-transform:uppercase;font-weight:700}
        .rc-section{margin-top:7px;break-inside:avoid}.rc-section h2{font-size:8.7px;margin:0 0 4px;padding-bottom:3px;border-bottom:1px solid #172033;text-transform:uppercase;letter-spacing:.45px}
        table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #b8c0cb;padding:3px 3.5px;text-align:left;vertical-align:middle;overflow-wrap:anywhere}th{background:#eef1f5;font-size:6.5px;text-transform:uppercase;letter-spacing:.15px}td{font-size:7.4px}.center{text-align:center}.strong{font-weight:700}
        .rc-two{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rc-box{border:1px solid #b8c0cb;padding:5px;break-inside:avoid}.rc-box h3{font-size:7.3px;text-transform:uppercase;margin:0 0 3px}.rc-box p{margin:0;min-height:24px}
        .rc-note{font-size:7px;color:#687385;margin-top:4px}.rc-bars{display:grid;gap:3px}.rc-bar-row{display:grid;grid-template-columns:65px 1fr 25px;gap:4px;align-items:center;font-size:6.9px}.rc-bar{height:6px;border:1px solid #aeb7c4;background:#f4f5f7}.rc-bar i{display:block;height:100%;background:#172033}
        .rc-signatures{display:grid;grid-template-columns:1fr 1fr;gap:28mm;margin-top:16mm;break-inside:avoid}.rc-sign{padding-top:24px;border-top:1px solid #697386;text-align:center;font-size:7.2px}.rc-sign span{display:block;color:#697386;margin-top:2px}
        .rc-footer{position:absolute;left:14mm;right:14mm;bottom:5mm;border-top:1px solid #c4cbd4;padding-top:3px;display:flex;justify-content:space-between;font-size:6.3px;color:#7a8493}
        @media print{body *{visibility:hidden!important}.student-report-card-print{display:block!important;visibility:visible!important;position:static!important}.student-report-card-print *{visibility:visible!important}.rc-state{display:none!important}}
      `}</style>

      <article className="rc-sheet">
        <header className="rc-top"><img className="rc-logo" src={LOGO_IMG_SRC} alt="Learner's Guide logo"/><div className="rc-institute">LEARNER'S GUIDE</div><div className="rc-doc">Student Progress Report</div><div className="rc-period">Institute Academic Record · {academicYear}</div></header>
        <div className="rc-heading">Student Information</div>
        <div className="rc-info">
          <div className="rc-field"><span className="rc-label">Student Name</span><span className="rc-value">{text(student.name) || "—"}</span></div>
          <div className="rc-field"><span className="rc-label">Student ID / Roll No.</span><span className="rc-value">{text(student.sid) || "—"}</span></div>
          <div className="rc-field"><span className="rc-label">Class</span><span className="rc-value">{cls || "—"}</span></div>
          <div className="rc-field"><span className="rc-label">Section</span><span className="rc-value">{sec || "—"}</span></div>
          <div className="rc-field"><span className="rc-label">Institute Batch</span><span className="rc-value">{text(batch.name) || "—"}</span></div>
          <div className="rc-field"><span className="rc-label">Parent / Guardian</span><span className="rc-value">{text(student.parentname) || "—"}</span></div>
        </div>
        <div className="rc-kpis">
          <div className="rc-kpi"><strong>{computed.academicAverage == null ? "—" : `${computed.academicAverage}%`}</strong><span>Academic Average</span></div>
          <div className="rc-kpi"><strong>{computed.attendanceRate == null ? "—" : `${computed.attendanceRate}%`}</strong><span>Attendance</span></div>
          <div className="rc-kpi"><strong>{computed.homeworkRate == null ? "—" : `${computed.homeworkRate}%`}</strong><span>Homework</span></div>
          <div className="rc-kpi"><strong>{results.length}</strong><span>Assessments</span></div>
        </div>
        <section className="rc-section"><h2>Subject Performance</h2>{subjects.length ? <table><thead><tr><th>Subject</th><th className="center">Assessments</th><th className="center">Average</th><th className="center">Highest</th><th className="center">Grade</th></tr></thead><tbody>{subjects.map((s) => <tr key={s.subject}><td className="strong">{s.subject}</td><td className="center">{s.tests}</td><td className="center">{s.average}%</td><td className="center">{s.highest}%</td><td className="center strong">{grade(s.average)}</td></tr>)}</tbody></table> : <div className="rc-box">No subject-wise assessment data is available.</div>}</section>
        <section className="rc-section"><h2>Performance Snapshot</h2><div className="rc-two"><div className="rc-box"><h3>Academic Progress</h3><div className="rc-bars">{subjects.slice(0, 7).map((s) => <div className="rc-bar-row" key={s.subject}><span>{s.subject}</span><div className="rc-bar"><i style={{ width: `${Math.min(100, Math.max(0, s.average))}%` }} /></div><strong>{s.average}%</strong></div>)}</div></div><div className="rc-box"><h3>Attendance Overview</h3><p>Present: <b>{computed.present}</b> · Absent: <b>{computed.absent}</b> · Leave: <b>{computed.leaveDays}</b></p><p className="rc-note">Based on institute attendance records for the available period.</p></div></div></section>
        <section className="rc-section"><h2>Institute Progress Summary</h2><div className="rc-box"><p>Overall academic average: <b>{computed.academicAverage == null ? "Not available" : `${computed.academicAverage}%`}</b>. Homework completion: <b>{computed.homeworkRate == null ? "Not available" : `${computed.homeworkRate}%`}</b>. Attendance: <b>{computed.attendanceRate == null ? "Not available" : `${computed.attendanceRate}%`}</b>.</p></div></section>
        <footer className="rc-footer"><span>Learner's Guide · Student Progress Report</span><span>Page 1 of 3</span></footer>
      </article>

      <article className="rc-sheet">
        <header className="rc-top"><img className="rc-logo" src={LOGO_IMG_SRC} alt="Learner's Guide logo"/><div className="rc-institute">LEARNER'S GUIDE</div><div className="rc-doc">Academic & Assessment Record</div><div className="rc-period">Student: {text(student.name) || "—"}</div></header>
        <section className="rc-section"><h2>Assessment History</h2>{results.length ? <table><thead><tr><th style={{ width: "27%" }}>Assessment</th><th style={{ width: "18%" }}>Subject</th><th style={{ width: "13%" }}>Date</th><th className="center" style={{ width: "11%" }}>Marks</th><th className="center" style={{ width: "11%" }}>Out Of</th><th className="center" style={{ width: "9%" }}>%</th><th className="center" style={{ width: "11%" }}>Grade</th></tr></thead><tbody>{results.map((r, i) => { const score = r.total ? Math.round((r.obtained / r.total) * 100) : null; return <tr key={`${r.name}-${r.date}-${i}`}><td>{r.name}</td><td>{r.subject || "—"}</td><td>{fmtDate(r.date)}</td><td className="center">{r.obtained}</td><td className="center">{r.total || "—"}</td><td className="center">{score == null ? "—" : `${score}%`}</td><td className="center strong">{grade(score)}</td></tr>; })}</tbody></table> : <div className="rc-box">No assessment records are available.</div>}</section>
        <section className="rc-section"><h2>Attendance by Month</h2>{monthly.size ? <table><thead><tr><th>Month</th><th className="center">Present</th><th className="center">Absent</th><th className="center">Leave</th><th className="center">Attendance</th></tr></thead><tbody>{[...monthly.entries()].map(([name, v]) => { const rate = pct(v.present, v.present + v.absent + v.leave); return <tr key={name}><td>{name}</td><td className="center">{v.present}</td><td className="center">{v.absent}</td><td className="center">{v.leave}</td><td className="center strong">{rate == null ? "—" : `${rate}%`}</td></tr>; })}</tbody></table> : <div className="rc-box">No attendance records are available.</div>}</section>
        <section className="rc-section"><h2>Homework & Practice</h2><table><thead><tr><th>Measure</th><th className="center">Count</th><th className="center">Completion</th></tr></thead><tbody><tr><td>Homework assigned</td><td className="center">{computed.homeworkAssigned}</td><td className="center">—</td></tr><tr><td>Homework completed</td><td className="center">{computed.homeworkCompleted}</td><td className="center">{computed.homeworkRate == null ? "—" : `${computed.homeworkRate}%`}</td></tr><tr><td>Homework pending</td><td className="center">{Math.max(0, computed.homeworkAssigned - computed.homeworkCompleted)}</td><td className="center">—</td></tr></tbody></table></section>
        <section className="rc-section"><h2>Leave Record</h2>{leaveRows.length ? <table><thead><tr><th>From</th><th>To</th><th>Status</th><th>Reason</th></tr></thead><tbody>{leaveRows.map((r: Row) => <tr key={text(r.id)}><td>{fmtDate(r.from_date)}</td><td>{fmtDate(r.to_date)}</td><td>{text(r.status) || "—"}</td><td>{text(r.reason) || "—"}</td></tr>)}</tbody></table> : <div className="rc-box">No leave requests are recorded.</div>}</section>
        <section className="rc-section"><h2>Assessment Remarks</h2><div className="rc-box"><p>{recentRemarks.length ? recentRemarks.join(" · ") : "No assessment remarks have been recorded for this reporting period."}</p></div></section>
        <footer className="rc-footer"><span>Learner's Guide · Academic & Assessment Record</span><span>Page 2 of 3</span></footer>
      </article>

      <article className="rc-sheet">
        <header className="rc-top"><img className="rc-logo" src={LOGO_IMG_SRC} alt="Learner's Guide logo"/><div className="rc-institute">LEARNER'S GUIDE</div><div className="rc-doc">Progress Review & Acknowledgement</div><div className="rc-period">Student: {text(student.name) || "—"} · {academicYear}</div></header>
        <section className="rc-section"><h2>Overall Institute Review</h2><div className="rc-two"><div className="rc-box"><h3>Academic Performance</h3><p>{computed.academicAverage == null ? "Academic performance data is not yet available." : `Current recorded average is ${computed.academicAverage}%, based on ${results.length} assessment${results.length === 1 ? "" : "s"}.`}</p></div><div className="rc-box"><h3>Attendance & Participation</h3><p>{computed.attendanceRate == null ? "Attendance data is not yet available." : `Recorded attendance is ${computed.attendanceRate}%, with ${computed.present} present and ${computed.absent} absent sessions.`}</p></div></div></section>
        <section className="rc-section"><h2>Teacher's Review</h2><div className="rc-box"><p style={{ minHeight: "34mm" }}>Teacher's observations: ____________________________________________________________________________________<br /><br />________________________________________________________________________________________________________<br /><br />________________________________________________________________________________________________________</p></div></section>
        <section className="rc-section"><h2>Focus for Continued Improvement</h2><div className="rc-box"><p style={{ minHeight: "28mm" }}>Areas to continue working on: ____________________________________________________________________________<br /><br />Suggested practice / follow-up: ______________________________________________________________________________<br /><br />________________________________________________________________________________________________________</p></div></section>
        <section className="rc-section"><h2>Parent / Guardian Acknowledgement</h2><div className="rc-box"><p style={{ minHeight: "22mm" }}>I have reviewed this progress report and discussed the student's progress with the institute/teacher.</p></div></section>
        <div className="rc-signatures"><div className="rc-sign">{teacherName}<span>Teacher</span></div><div className="rc-sign">{text(student.parentname) || "Parent / Guardian"}<span>Parent / Guardian</span></div></div>
        <div className="rc-note" style={{ marginTop: "10mm" }}>This report is an institute progress record prepared from the academic, attendance, homework and leave information available in Learner's Guide. It is not a school board marksheet or a transfer certificate.</div>
        <footer className="rc-footer"><span>Learner's Guide · Progress Review & Acknowledgement</span><span>Page 3 of 3</span></footer>
      </article>
    </div>
  );
}
