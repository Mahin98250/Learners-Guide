import { useState, type ComponentProps } from "react";
import { PeopleAnalyticsPage as LegacyPeopleAnalyticsPage } from "@/admin/PeopleAnalyticsPageLegacy";
import { StudentReportCardPrint } from "@/admin/StudentReportCardPrint";

type Student = Record<string, any>;

type ReportCardLauncherProps = ComponentProps<typeof LegacyPeopleAnalyticsPage> & { selectedStudent?: Student | null };

export function PeopleAnalyticsPage(props: ReportCardLauncherProps) {
  const [printStudent, setPrintStudent] = useState<Student | null>(null);
  return <div>
    <LegacyPeopleAnalyticsPage {...props} onGenerateStudentReport={setPrintStudent} />
    {printStudent && <div className="student-report-launcher">
      <StudentReportCardPrint
        student={printStudent}
        onReady={() => window.print()}
        onError={() => setPrintStudent(null)}
      />
      <button type="button" className="student-report-cancel" onClick={() => setPrintStudent(null)}>Cancel</button>
    </div>}
  </div>;
}
