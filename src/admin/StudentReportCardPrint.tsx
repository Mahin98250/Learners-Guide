import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lg/supabase";

type Row = Record<string, any>;
type Props = { student: Row; onReady?: () => void; onError?: (message: string) => void };

const text = (v: any) => String(v ?? "").trim();
const lower = (v: any) => text(v).toLowerCase();
const n = (v: any) => Number(v || 0);
const percent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const date = (v: any) => {
  const s = text(v); if (!s) return "—";
  const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const month = (v: any) => {
  const s = text(v); if (!s) return "Unknown";
  const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
const grade = (v: number | null) => v == null ? "—" : v >= 90 ? "A+" : v >= 80 ? "A" : v >= 70 ? "B+" : v >= 60 ? "B" : v >= 50 ? "C" : v >= 40 ? "D" : "F";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rc-section"><h2>{title}</h2>{children}</section>;
}

export function StudentReportCardPrint({ student, onReady, onError }: Props) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: any | null }>({ loading: true, error: "", data: null });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const id = text(student.id);
        const [attendance, results, marks, homework, leaves, memberships, years] = await Promise.all([
          supabase.from("attendance").select("id,sid,date,status").eq("sid", id).order("date", { ascending: true }),
          supabase.from("test_results").select("id,test_id,student_id,marks,remarks,created_at").eq("student_id", id).order("created_at", { ascending: true }),
          supabase.from("marks").select("id,sid,subject,exam,marks,total,totalMarks,score,date").eq("sid", id).order("date", { ascending: true }),
          supabase.from("homework").select("id,subject,given,due,completedby,batch_id").order("given", { ascending: true }),
          supabase.from("leave_requests").select("id,from_date,to_date,status,reason").eq("student_id", id).order("from_date", { ascending: true }),
          supabase.from("batch_students").select("batch_id,status").eq("student_id", id),
          supabase.from("academic_years").select("id,name,start_date,end_date,status").order("start_date", { ascending: false }).limit(1),
        ]);
        for (const q of [attendance, results, marks, homework, leaves, memberships, years]) if (q.error) throw q.error;

        const testIds = [...new Set((results.data || []).map((r: Row) => text(r.test_id)).filter(Boolean))];
        const tests = testIds.length
          ? await supabase.from("tests").select("id,title,subject,test_date,total_marks,batch_id,status").in("id", testIds)
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
          const b = await supabase.from("batches").select("id,name,cls,sec,status").eq("id", batchId).maybeSingle();
          if (b.error) throw b.error;
          batch = b.data;
        }
        if (!live) return;
        setState({ loading: false, error: "", data: { attendance: attendance.data || [], results: canonical, marks: legacy, homework: homeworkRows, leaves: leaves.data || [], academicYear: (years.data || [])[0] || null, batch } });
      } catch (e) {
        if (!live) return;
        const message = e instanceof Error ? e.message : "Unable to generate the student report card.";
        setState({ loading: false, error: message, data: null });
        onError?.(message);
      }
    })();
    return () => { live = false; };
  }, [student.id, onError]);

  useEffect(() => { if (!state.loading && state.data && !state.error) onReady?.(); }, [state.loading, state.data, state.error, onReady]);

  const computed = useMemo(() => {
    if (!state.data) return null;
    const attendance = state.data.attendance as Row[];
    const present = attendance.filter(r => lower(r.status) === "present").length;
    const absent = attendance.filter(r => lower(r.status) === "absent").length;
    const leaveDays = attendance.filter(r => ["leave", "on leave"].includes(lower(r.status))).length;
    const scores = [
      ...state.data.results.map((r: Row) => { const total = n(r.test?.total_marks); return total ? n(r.marks) / total * 100 : null; }),
      ...state.data.marks.map((r: Row) => { const total = n(r.total ?? r.totalMarks); return total ? n(r.score ?? r.marks) / total * 100 : null; }),
    ].filter((v: any): v is number => typeof v === "number" && Number.isFinite(v));
    const academicAverage = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const homework = state.data.homework.filter((r: Row) => Array.isArray(r.completedby) ? r.completedby.map(String).includes(text(student.id)) : text(r.completedby).split(",").map(s => s.trim()).includes(text(student.id)));
    return { present, absent, leaveDays, attendanceRate: percent(present, attendance.length), academicAverage, homeworkAssigned: state.data.homework.length, homeworkCompleted: homework.length, homeworkRate: percent(homework.length, state.data.homework.length) };
  }, [state.data, student.id]);

  if (state.loading) return <div className="student-report-card-print rc-state">Preparing report card…</div>;
  if (!state.data || !computed) return <div className="student-report-card-print rc-state">Unable to generate report card.</div>;

  const data = state.data;
  const results = [
    ...data.results.map((r: Row) => ({ ...r, assessment: text(r.test?.title) || "Assessment", subject: text(r.test?.subject), when: r.test?.test_date, obtained: n(r.marks), total: n(r.test?.total_marks) || 100, remarks: text(r.remarks) })),
    ...data.marks.map((r: Row) => ({ ...r, assessment: text(r.exam) || "Assessment", subject: text(r.subject), when: r.date, obtained: n(r.score ?? r.marks), total: n(r.total ?? r.totalMarks) || 100, remarks: text(r.remarks) })),
  ];
  const subjectMap = new Map<string, { scores: number[]; tests: number; highest: number }>();
  results.forEach(r => { const s = r.subject || "Other"; const p = r.total ? r.obtained / r.total * 100 : 0; const x = subjectMap.get(s) || { scores: [], tests: 0, highest: 0 }; x.scores.push(p); x.tests += 1; x.highest = Math.max(x.highest, p); subjectMap.set(s, x); });
  const subjects = [...subjectMap.entries()].map(([subject, x]) => ({ subject, tests: x.tests, average: Math.round(x.scores.reduce((a, b) => a + b, 0) / x.scores.length), highest: Math.round(x.highest) })).sort((a, b) => a.subject.localeCompare(b.subject));
  const monthly = new Map<string, { present: number; absent: number; leave: number }>();
  data.attendance.forEach((r: Row) => { const k = month(r.date); const x = monthly.get(k) || { present: 0, absent: 0, leave: 0 }; const s = lower(r.status); if (s === "present") x.present++; else if (s === "absent") x.absent++; else if (s === "leave" || s === "on leave") x.leave++; monthly.set(k, x); });
  const recentRemarks = results.map(r => r.remarks).filter(Boolean).slice(-3).join(" • ");
  const batch = data.batch || {};
  const cls = text(student.cls) || text(batch.cls);
  const sec = text(student.sec) || text(batch.sec);
  const academicYear = text(data.academicYear?.name) || (data.academicYear?.start_date && data.academicYear?.end_date ? `${date(data.academicYear.start_date)} – ${date(data.academicYear.end_date)}` : "—");

  return <div className="student-report-card-print">
    <style>{`
      @page{size:A4 portrait;margin:0}
      html,body{margin:0!important;padding:0!important;background:#fff!important}
      .student-report-card-print{display:none}.student-report-card-print,.student-report-card-print *{box-sizing:border-box}
      .student-report-card-print{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#fff;font-size:9px;line-height:1.28}
      .rc-sheet{width:210mm;height:297mm;padding:11mm 13mm 10mm;position:relative;background:#fff;overflow:hidden}
      .rc-sheet + .rc-sheet{break-before:page}
      .rc-header{text-align:center;border-bottom:2px solid #172033;padding-bottom:6px;margin-bottom:8px}
      .rc-header .institute{font-size:18px;font-weight:800;letter-spacing:1.1px}.rc-header .document{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.65px;margin-top:2px}.rc-header .period{font-size:8px;color:#687386;margin-top:2px}
      .rc-title{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.55px;border-bottom:1px solid #172033;padding-bottom:3px;margin:0 0 5px}
      .rc-info{display:grid;grid-template-columns:1fr 1fr;border:1px solid #aeb7c4;margin-bottom:7px}.rc-field{padding:4.5px 6px;border-right:1px solid #aeb7c4;border-bottom:1px solid #aeb7c4;min-height:27px}.rc-field:nth-child(2n){border-right:0}.rc-field:nth-last-child(-n+2){border-bottom:0}.rc-label{display:block;font-size:6.7px;color:#697386;text-transform:uppercase;font-weight:700;letter-spacing:.4px}.rc-value{font-size:9px;font-weight:700;margin-top:1px}
      .rc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:7px}.rc-kpi{border:1px solid #aeb7c4;text-align:center;padding:5px 3px}.rc-kpi strong{display:block;font-size:14px;line-height:1.05}.rc-kpi span{font-size:6.5px;color:#697386;text-transform:uppercase;font-weight:700}
      .rc-section{margin-top:6px;break-inside:avoid}.rc-section h2{font-size:9px;margin:0 0 4px;padding-bottom:3px;border-bottom:1px solid #172033;text-transform:uppercase;letter-spacing:.5px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #b8c0cb;padding:3px 3.5px;text-align:left;vertical-align:middle;overflow-wrap:anywhere}th{background:#eef1f5;font-size:6.8px;text-transform:uppercase;letter-spacing:.2px}td{font-size:7.5px}.center{text-align:center}.good{font-weight:700}
      .rc-two{display:grid;grid-template-columns:1fr 1fr;gap:6px}.rc-box{border:1px solid #b8c0cb;padding:5px;break-inside:avoid}.rc-box h3{font-size:7.5px;text-transform:uppercase;margin:0 0 3px}.rc-box p{margin:0;min-height:22px}
      .rc-bars{display:grid;gap:3px}.rc-bar-row{display:grid;grid-template-columns:66px 1fr 27px;gap:4px;align-items:center;font-size:7px}.rc-bar{height:6px;border:1px solid #aeb7c4;background:#f4f5f7}.rc-bar i{display:block;height:100%;background:#172033}
      .rc-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:11px;break-inside:avoid}.rc-sign{padding-top:26px;border-top:1px solid #697386;text-align:center;font-size:7.2px}.rc-sign span{display:block;color:#697386;margin-top:2px}
      .rc-footer{position:absolute;left:13mm;right:13mm;bottom:5mm;border-top:1px solid #c4cbd4;padding-top:3px;display:flex;justify-content:space-between;font-size:6.5px;color:#7a8493}
      .rc-page-no:after{content:counter(page)}.rc-note{font-size:7px;color:#687385;margin-top:3px}
      @media print{body *{visibility:hidden!important}.student-report-card-print{display:block!important;visibility:visible!important;position:static!important}.student-report-card-print *{visibility:visible!important}.rc-state{display:none!important}}
    `}</style>

    <article className="rc-sheet">
      <header className="rc-header"><div className="institute">LEARNER'S GUIDE</div><div className="document">Student Report Card</div><div className="period">Academic Record · {academicYear}</div></header>
      <div className="rc-title">Student Information</div>
      <div className="rc-info">
        <div className="rc-field"><span className="rc-label">Student Name</span><span className="rc-value">{text(student.name) || "—"}</span></div>
        <div className="rc-field"><span className="rc-label">Roll / Student ID</span><span className="rc-value">{text(student.sid) || "—"}</span></div>
        <div className="rc-field"><span className="rc-label">Class</span><span className="rc-value">{cls || "—"}</span></div>
        <div className="rc-field"><span className="rc-label">Section</span><span className="rc-value">{sec || "—"}</span></div>
        <div className="rc-field"><span className="rc-label">Batch</span><span className="rc-value">{text(batch.name) || "—"}</span></div>
        <div className="rc-field"><span className="rc-label">Parent / Guardian</span><span className="rc-value">{text(student.parentname) || "—"}</span></div>
      </div>
      <div className="rc-title">Overall Summary</div>
      <div className="rc-kpis"><div className="rc-kpi"><strong>{computed.academicAverage == null ? "—" : `${computed.academicAverage}%`}</strong><span>Academic Average</span></div><div className="rc-kpi"><strong>{computed.attendanceRate == null ? "—" : `${computed.attendanceRate}%`}</strong><span>Attendance</span></div><div className="rc-kpi"><strong>{computed.homeworkRate == null ? "—" : `${computed.homeworkRate}%`}</strong><span>Homework</span></div><div className="rc-kpi"><strong>{grade(computed.academicAverage)}</strong><span>Overall Grade</span></div></div>
      <Section title="Academic Performance"><table><thead><tr><th style={{width:"28%"}}>Subject</th><th className="center" style={{width:"13%"}}>Tests</th><th className="center" style={{width:"18%"}}>Average</th><th className="center" style={{width:"18%"}}>Highest</th><th className="center">Grade</th></tr></thead><tbody>{subjects.length ? subjects.map(r => <tr key={r.subject}><td>{r.subject}</td><td className="center">{r.tests}</td><td className="center">{r.average}%</td><td className="center">{r.highest}%</td><td className="center good">{grade(r.average)}</td></tr>) : <tr><td colSpan={5}>No academic results recorded.</td></tr>}</tbody></table></Section>
      <Section title="Performance by Subject"><div className="rc-bars">{subjects.slice(0, 8).map(r => <div className="rc-bar-row" key={r.subject}><span>{r.subject}</span><div className="rc-bar"><i style={{width:`${Math.max(0,Math.min(100,r.average))}%`}} /></div><strong>{r.average}%</strong></div>)}</div></Section>
      <div className="rc-two"><div className="rc-box"><h3>Assessment Summary</h3><p>{results.length} recorded assessment{results.length === 1 ? "" : "s"}. Overall grade: <strong>{grade(computed.academicAverage)}</strong>.</p></div><div className="rc-box"><h3>Academic Remarks</h3><p>{recentRemarks || "No assessment remarks have been recorded."}</p></div></div>
      <footer className="rc-footer"><span>LEARNER'S GUIDE · Student Report Card</span><span>Page <span className="rc-page-no" /></span></footer>
    </article>

    <article className="rc-sheet">
      <header className="rc-header"><div className="institute">LEARNER'S GUIDE</div><div className="document">Academic Performance Record</div><div className="period">{text(student.name) || "Student"} · {academicYear}</div></header>
      <Section title="Assessment History"><table><thead><tr><th style={{width:"21%"}}>Assessment</th><th style={{width:"17%"}}>Subject</th><th style={{width:"14%"}}>Date</th><th style={{width:"13%"}}>Marks</th><th style={{width:"12%"}}>Percent</th><th style={{width:"11%"}}>Grade</th><th>Result</th></tr></thead><tbody>{results.length ? results.map((r: Row, i: number) => { const p = r.total ? Math.round(r.obtained / r.total * 100) : 0; return <tr key={`${r.assessment}-${r.when}-${i}`}><td>{r.assessment}</td><td>{r.subject || "—"}</td><td>{date(r.when)}</td><td className="center">{r.obtained}/{r.total}</td><td className="center">{p}%</td><td className="center good">{grade(p)}</td><td>{p >= 40 ? "Pass" : "Needs attention"}</td></tr>; }) : <tr><td colSpan={7}>No assessment records available.</td></tr>}</tbody></table></Section>
      <Section title="Attendance Overview"><div className="rc-kpis"><div className="rc-kpi"><strong>{computed.present}</strong><span>Present</span></div><div className="rc-kpi"><strong>{computed.absent}</strong><span>Absent</span></div><div className="rc-kpi"><strong>{computed.leaveDays}</strong><span>Leave</span></div><div className="rc-kpi"><strong>{computed.attendanceRate == null ? "—" : `${computed.attendanceRate}%`}</strong><span>Attendance Rate</span></div></div><table><thead><tr><th>Month</th><th className="center">Present</th><th className="center">Absent</th><th className="center">Leave</th><th className="center">Rate</th></tr></thead><tbody>{[...monthly.entries()].map(([m, x]) => <tr key={m}><td>{m}</td><td className="center">{x.present}</td><td className="center">{x.absent}</td><td className="center">{x.leave}</td><td className="center">{percent(x.present, x.present + x.absent + x.leave) == null ? "—" : `${percent(x.present, x.present + x.absent + x.leave)}%`}</td></tr>)}</tbody></table></Section>
      <Section title="Homework & Engagement"><table><thead><tr><th>Assigned</th><th>Completed</th><th>Pending</th><th>Completion</th></tr></thead><tbody><tr><td className="center">{computed.homeworkAssigned}</td><td className="center">{computed.homeworkCompleted}</td><td className="center">{Math.max(0,computed.homeworkAssigned-computed.homeworkCompleted)}</td><td className="center good">{computed.homeworkRate == null ? "—" : `${computed.homeworkRate}%`}</td></tr></tbody></table></Section>
      <Section title="Leave Record"><table><thead><tr><th style={{width:"18%"}}>From</th><th style={{width:"18%"}}>To</th><th style={{width:"15%"}}>Status</th><th>Reason</th></tr></thead><tbody>{data.leaves.length ? data.leaves.map((r: Row) => <tr key={text(r.id)}><td>{date(r.from_date)}</td><td>{date(r.to_date)}</td><td>{text(r.status) || "—"}</td><td>{text(r.reason) || "—"}</td></tr>) : <tr><td colSpan={4}>No leave records available.</td></tr>}</tbody></table></Section>
      <footer className="rc-footer"><span>LEARNER'S GUIDE · Student Report Card</span><span>Page <span className="rc-page-no" /></span></footer>
    </article>

    <article className="rc-sheet">
      <header className="rc-header"><div className="institute">LEARNER'S GUIDE</div><div className="document">Final Review & Acknowledgement</div><div className="period">{text(student.name) || "Student"} · {academicYear}</div></header>
      <Section title="Overall Performance"><div className="rc-two"><div className="rc-box"><h3>Academic Standing</h3><p>Overall academic average: <strong>{computed.academicAverage == null ? "—" : `${computed.academicAverage}%`}</strong><br/>Overall grade: <strong>{grade(computed.academicAverage)}</strong></p></div><div className="rc-box"><h3>Attendance & Work Habits</h3><p>Attendance: <strong>{computed.attendanceRate == null ? "—" : `${computed.attendanceRate}%`}</strong><br/>Homework completion: <strong>{computed.homeworkRate == null ? "—" : `${computed.homeworkRate}%`}</strong></p></div></div></Section>
      <Section title="Teacher / Institute Remarks"><div className="rc-box"><p>{recentRemarks || "This section is reserved for the institute's academic remarks and observations."}</p></div></Section>
      <Section title="Areas for Continued Growth"><table><thead><tr><th>Area</th><th>Observation</th><th>Suggested Focus</th></tr></thead><tbody>{subjects.length ? subjects.slice().sort((a,b)=>a.average-b.average).slice(0,3).map(r => <tr key={r.subject}><td>{r.subject}</td><td>{r.average >= 75 ? "Strong current performance" : r.average >= 50 ? "Developing performance" : "Requires additional attention"}</td><td>{r.average >= 75 ? "Maintain consistency" : "Regular revision and practice"}</td></tr>) : <tr><td>Academic progress</td><td>No assessment data recorded.</td><td>Continue regular study and participation.</td></tr>}</tbody></table></Section>
      <Section title="Report Summary"><table><tbody><tr><th>Student</th><td>{text(student.name) || "—"}</td><th>Academic Year</th><td>{academicYear}</td></tr><tr><th>Class / Section</th><td>{[cls,sec].filter(Boolean).join(" / ") || "—"}</td><th>Batch</th><td>{text(batch.name) || "—"}</td></tr><tr><th>Academic Average</th><td>{computed.academicAverage == null ? "—" : `${computed.academicAverage}%`}</td><th>Attendance</th><td>{computed.attendanceRate == null ? "—" : `${computed.attendanceRate}%`}</td></tr></tbody></table></Section>
      <div className="rc-note">This report is generated from the institute's recorded academic, attendance, homework, and leave information. A blank field means no corresponding record has been entered.</div>
      <div className="rc-signatures"><div className="rc-sign">Class / Subject Teacher<span>Signature & Date</span></div><div className="rc-sign">Parent / Guardian<span>Signature & Date</span></div><div className="rc-sign">Institute / Administrator<span>Signature & Date</span></div></div>
      <footer className="rc-footer"><span>LEARNER'S GUIDE · Student Report Card</span><span>Page <span className="rc-page-no" /></span></footer>
    </article>
  </div>;
}
