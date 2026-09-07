import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lg/supabase";
import { LOGO_IMG_SRC } from "@/lg/ui";

type Row = Record<string, any>;
type StudentReportCardPrintProps = { student: Row; onReady?: () => void; onError?: (message: string) => void };

const clean = (value: any) => String(value ?? "").trim();
const lower = (value: any) => clean(value).toLowerCase();
const num = (value: any) => Number(value || 0);
const fmtDate = (value: any) => { const text = clean(value); if (!text) return "—"; const date = new Date(text); return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };
const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : null;
const grade = (value: number | null) => value == null ? "—" : value >= 90 ? "A+" : value >= 80 ? "A" : value >= 70 ? "B+" : value >= 60 ? "B" : value >= 50 ? "C" : value >= 40 ? "D" : "F";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="src-section"><h2>{title}</h2>{children}</section>;
}

export function StudentReportCardPrint({ student, onReady, onError }: StudentReportCardPrintProps) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: any | null }>({ loading: true, error: "", data: null });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const id = clean(student.id);
        const [attendance, resultRows, legacyMarks, homework, leaves, batches, academicYears] = await Promise.all([
          supabase.from("attendance").select("id,sid,date,status").eq("sid", id).order("date", { ascending: true }),
          supabase.from("test_results").select("id,test_id,student_id,marks,remarks,created_at").eq("student_id", id).order("created_at", { ascending: true }),
          supabase.from("marks").select("id,sid,subject,exam,marks,total,totalMarks,score,date").eq("sid", id).order("date", { ascending: true }),
          supabase.from("homework").select("id,subject,given,due,completedby,batch_id").order("given", { ascending: true }),
          supabase.from("leave_requests").select("id,from_date,to_date,status,reason").eq("student_id", id).order("from_date", { ascending: true }),
          supabase.from("batch_students").select("batch_id,status").eq("student_id", id),
          supabase.from("academic_years").select("id,name,start_date,end_date,status").order("start_date", { ascending: false }).limit(1),
        ]);
        for (const query of [attendance, resultRows, legacyMarks, homework, leaves, batches, academicYears]) if (query.error) throw query.error;

        const ids = [...new Set((resultRows.data || []).map((row: Row) => clean(row.test_id)).filter(Boolean))];
        const testsResult = ids.length ? await supabase.from("tests").select("id,title,subject,test_date,total_marks,batch_id,status").in("id", ids) : { data: [], error: null } as any;
        if (testsResult.error) throw testsResult.error;
        const testMap = new Map((testsResult.data || []).map((test: Row) => [clean(test.id), test]));
        const canonical = (resultRows.data || []).map((row: Row) => ({ ...row, test: testMap.get(clean(row.test_id)) })).filter((row: Row) => row.test);
        const resultKeys = new Set(canonical.map((row: Row) => `${lower(row.test?.subject)}|${clean(row.test?.test_date)}|${num(row.marks)}`));
        const legacy = (legacyMarks.data || []).filter((row: Row) => !resultKeys.has(`${lower(row.subject)}|${clean(row.date)}|${num(row.score ?? row.marks)}`));

        const batchIds = new Set((batches.data || []).map((row: Row) => clean(row.batch_id)).filter(Boolean));
        const scopedHomework = (homework.data || []).filter((row: Row) => !row.batch_id || batchIds.has(clean(row.batch_id)));
        const year = (academicYears.data || [])[0] || null;
        const currentBatchId = (batches.data || [])[0]?.batch_id ? clean((batches.data || [])[0].batch_id) : "";

        if (!live) return;
        setState({ loading: false, error: "", data: { attendance: attendance.data || [], results: canonical, marks: legacy, homework: scopedHomework, leaves: leaves.data || [], academicYear: year, currentBatchId } });
      } catch (error) {
        if (!live) return;
        const message = error instanceof Error ? error.message : "Unable to generate the student report card.";
        setState({ loading: false, error: message, data: null });
        onError?.(message);
      }
    })();
    return () => { live = false; };
  }, [student.id, onError]);

  useEffect(() => {
    if (!state.loading && state.data && !state.error) onReady?.();
  }, [state.loading, state.data, state.error, onReady]);

  const computed = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const present = data.attendance.filter((row: Row) => lower(row.status) === "present").length;
    const absent = data.attendance.filter((row: Row) => lower(row.status) === "absent").length;
    const leave = data.attendance.filter((row: Row) => lower(row.status) === "leave" || lower(row.status) === "on leave").length;
    const attendanceRate = pct(present, data.attendance.length);
    const scores = [
      ...data.results.map((row: Row) => { const total = num(row.test?.total_marks); return total > 0 ? num(row.marks) / total * 100 : null; }),
      ...data.marks.map((row: Row) => { const total = num(row.total ?? row.totalMarks); return total > 0 ? num(row.score ?? row.marks) / total * 100 : null; }),
    ].filter((value: any): value is number => typeof value === "number" && Number.isFinite(value));
    const academicAverage = scores.length ? Math.round(scores.reduce((sum: number, value: number) => sum + value, 0) / scores.length) : null;
    const completedHomework = data.homework.filter((row: Row) => Array.isArray(row.completedby) ? row.completedby.map(String).includes(clean(student.id)) : clean(row.completedby).split(",").map(s => s.trim()).includes(clean(student.id))).length;
    const homeworkAssigned = data.homework.length;
    const homeworkPending = Math.max(0, homeworkAssigned - completedHomework);
    const homeworkRate = pct(completedHomework, homeworkAssigned);
    return { present, absent, leave, attendanceRate, academicAverage, completedHomework, homeworkAssigned, homeworkPending, homeworkRate };
  }, [state.data, student.id]);

  if (state.loading) return <div className="student-report-card-print student-report-card-state">Preparing report card…</div>;
  if (state.error || !state.data || !computed) return <div className="student-report-card-print student-report-card-state">Unable to generate report card.</div>;

  const data = state.data;
  const resultRows = [...data.results, ...data.marks.map((row: Row) => ({ ...row, legacy: true, score: row.score ?? row.marks, totalMarks: row.total ?? row.totalMarks }))];
  const subjectMap = new Map<string, { scores: number[]; tests: number }>();
  resultRows.forEach((row: Row) => {
    const subject = clean(row.test?.subject || row.subject) || "Other";
    const score = num(row.marks ?? row.score);
    const total = num(row.test?.total_marks ?? row.totalMarks) || 100;
    const item = subjectMap.get(subject) || { scores: [], tests: 0 };
    item.scores.push((score / total) * 100); item.tests += 1; subjectMap.set(subject, item);
  });
  const subjects = [...subjectMap.entries()].map(([subject, item]) => ({ subject, tests: item.tests, average: Math.round(item.scores.reduce((sum, value) => sum + value, 0) / item.scores.length), highest: Math.round(Math.max(...item.scores)) })).sort((a, b) => a.subject.localeCompare(b.subject));

  return <div className="student-report-card-print">
    <style>{`
      @page{size:A4;margin:10mm}.student-report-card-print{display:none}.student-report-card-print,.student-report-card-print *{box-sizing:border-box}.student-report-card-print{font-family:Arial,Helvetica,sans-serif;color:#182033;background:#fff;line-height:1.4;font-size:11px}.student-report-card-print .src-document{max-width:190mm;margin:0 auto}.student-report-card-print .src-brand{display:flex;align-items:center;gap:12px;border-bottom:2px solid #182033;padding-bottom:10px;margin-bottom:14px}.student-report-card-print .src-brand img{width:42px;height:42px;object-fit:contain}.student-report-card-print .src-brand strong{font-size:19px;letter-spacing:.2px}.student-report-card-print .src-brand span{display:block;font-size:11px;color:#657084;margin-top:2px}.student-report-card-print .src-title{text-align:center;margin:6px 0 16px}.student-report-card-print .src-title h1{font-size:20px;letter-spacing:.5px;margin:0}.student-report-card-print .src-title p{margin:4px 0 0;color:#657084}.student-report-card-print .src-info-grid{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid #cfd6e2;margin-bottom:14px}.student-report-card-print .src-info-grid>div{padding:7px 9px;border-right:1px solid #cfd6e2;border-bottom:1px solid #cfd6e2}.student-report-card-print .src-info-grid>div:nth-child(2n){border-right:0}.student-report-card-print .src-info-grid>div:nth-last-child(-n+2){border-bottom:0}.student-report-card-print .src-label{text-transform:uppercase;font-size:8px;font-weight:700;color:#6b7483;letter-spacing:.5px}.student-report-card-print .src-value{font-size:11px;font-weight:700;margin-top:2px}.student-report-card-print .src-section{margin-top:13px;break-inside:avoid}.student-report-card-print .src-section h2{font-size:12px;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #182033;padding-bottom:5px;margin:0 0 7px}.student-report-card-print table{width:100%;border-collapse:collapse}.student-report-card-print th,.student-report-card-print td{border:1px solid #cfd6e2;padding:6px 7px;text-align:left;vertical-align:top}.student-report-card-print th{background:#f1f4f8;font-size:9px;text-transform:uppercase;letter-spacing:.3px}.student-report-card-print td{font-size:10px}.student-report-card-print .src-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.student-report-card-print .src-summary{border:1px solid #cfd6e2;padding:8px;text-align:center;break-inside:avoid}.student-report-card-print .src-summary strong{display:block;font-size:17px}.student-report-card-print .src-summary span{font-size:8px;color:#6b7483;text-transform:uppercase}.student-report-card-print .src-note{border:1px solid #cfd6e2;min-height:52px;padding:8px}.student-report-card-print .src-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px;break-inside:avoid}.student-report-card-print .src-sign{padding-top:34px;border-top:1px solid #7a8494;text-align:center;font-size:9px;color:#566174}.student-report-card-print .src-footer{margin-top:16px;padding-top:7px;border-top:1px solid #cfd6e2;display:flex;justify-content:space-between;color:#7a8494;font-size:8px}
      @media print{html,body{background:#fff!important;margin:0!important;padding:0!important}body *{visibility:hidden!important}.student-report-card-print{display:block!important;visibility:visible!important;position:static!important;width:100%!important;margin:0!important;padding:0!important}.student-report-card-print *{visibility:visible!important}.student-report-card-state{display:none!important}}
    `}</style>
    <div className="src-document">
      <header className="src-brand"><img src={LOGO_IMG_SRC} alt="Learner's Guide"/><div><strong>LEARNER'S GUIDE</strong><span>Academic Learning Institute</span></div></header>
      <div className="src-title"><h1>Student Academic Report</h1><p>Official academic and activity record</p></div>
      <div className="src-info-grid">
        <div><span className="src-label">Student Name</span><div className="src-value">{clean(student.name) || "—"}</div></div>
        <div><span className="src-label">Roll No.</span><div className="src-value">{clean(student.sid) || "—"}</div></div>
        <div><span className="src-label">Class</span><div className="src-value">{clean(student.cls) || "—"}</div></div>
        <div><span className="src-label">Section</span><div className="src-value">{clean(student.sec) || "—"}</div></div>
        <div><span className="src-label">Academic Year</span><div className="src-value">{clean(data.academicYear?.name) || "—"}</div></div>
        <div><span className="src-label">Parent / Guardian</span><div className="src-value">{clean(student.parentname) || "—"}</div></div>
      </div>

      <Section title="Academic Performance">
        <table><thead><tr><th>Subject</th><th>Tests</th><th>Average</th><th>Highest</th><th>Performance / Grade</th></tr></thead><tbody>{subjects.length ? subjects.map(row => <tr key={row.subject}><td>{row.subject}</td><td>{row.tests}</td><td>{row.average}%</td><td>{row.highest}%</td><td>{row.average}% · {grade(row.average)}</td></tr>) : <tr><td colSpan={5}>No academic results are available.</td></tr>}</tbody></table>
      </Section>

      <Section title="Examination Results">
        <table><thead><tr><th>Test / Exam</th><th>Subject</th><th>Date</th><th>Marks</th><th>Percentage</th><th>Grade / Result</th></tr></thead><tbody>{resultRows.length ? resultRows.map((row: Row, index: number) => { const obtained = num(row.marks ?? row.score); const total = num(row.test?.total_marks ?? row.totalMarks) || 100; const score = Math.round((obtained / total) * 100); return <tr key={`${clean(row.test?.id) || row.id || index}`}><td>{clean(row.test?.title || row.exam) || "Assessment"}</td><td>{clean(row.test?.subject || row.subject) || "—"}</td><td>{fmtDate(row.test?.test_date || row.date)}</td><td>{obtained}/{total}</td><td>{score}%</td><td>{grade(score)} · {score >= 40 ? "Pass" : "Needs attention"}</td></tr>; }) : <tr><td colSpan={6}>No examination results are available.</td></tr>}</tbody></table>
      </Section>

      <Section title="Attendance">
        <div className="src-summary-grid"><div className="src-summary"><strong>{computed.present}</strong><span>Present</span></div><div className="src-summary"><strong>{computed.absent}</strong><span>Absent</span></div><div className="src-summary"><strong>{computed.leave}</strong><span>Leave</span></div><div className="src-summary"><strong>{computed.attendanceRate == null ? "—" : `${computed.attendanceRate}%`}</strong><span>Attendance</span></div></div>
      </Section>

      <Section title="Homework">
        <div className="src-summary-grid"><div className="src-summary"><strong>{computed.homeworkAssigned}</strong><span>Assigned</span></div><div className="src-summary"><strong>{computed.completedHomework}</strong><span>Completed</span></div><div className="src-summary"><strong>{computed.homeworkPending}</strong><span>Pending</span></div><div className="src-summary"><strong>{computed.homeworkRate == null ? "—" : `${computed.homeworkRate}%`}</strong><span>Completion</span></div></div>
      </Section>

      <Section title="Leave Record">
        <table><thead><tr><th>From</th><th>To</th><th>Status</th><th>Reason</th></tr></thead><tbody>{data.leaves.length ? data.leaves.map((row: Row) => <tr key={row.id}><td>{fmtDate(row.from_date)}</td><td>{fmtDate(row.to_date)}</td><td>{clean(row.status) || "—"}</td><td>{clean(row.reason) || "—"}</td></tr>) : <tr><td colSpan={4}>No leave records are available.</td></tr>}</tbody></table>
      </Section>

      <Section title="Overall Performance">
        <div className="src-summary-grid"><div className="src-summary"><strong>{computed.academicAverage == null ? "—" : `${computed.academicAverage}%`}</strong><span>Academic Average</span></div><div className="src-summary"><strong>{computed.attendanceRate == null ? "—" : `${computed.attendanceRate}%`}</strong><span>Attendance</span></div><div className="src-summary"><strong>{computed.homeworkRate == null ? "—" : `${computed.homeworkRate}%`}</strong><span>Homework</span></div><div className="src-summary"><strong>{computed.academicAverage != null ? grade(computed.academicAverage) : "—"}</strong><span>Overall Assessment</span></div></div>
      </Section>

      <Section title="Teacher / Institute Remarks"><div className="src-note">Academic performance, attendance, homework completion, and overall progress are summarised from the records currently available in the institute system.</div></Section>

      <div className="src-signatures"><div className="src-sign">Class Teacher</div><div className="src-sign">Parent / Guardian</div><div className="src-sign">Institute / Admin</div></div>
      <footer className="src-footer"><span>Generated from Learner's Guide records</span><span>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></footer>
    </div>
  </div>;
}
