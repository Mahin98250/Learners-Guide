import { useEffect, useState } from "react";
import { StudentReportCardPrint } from "@/admin/StudentReportCardPrint";

type Props = { student: Record<string, any>; onClose: () => void };

export function PeopleAnalyticsReportBridge({ student, onClose }: Props) {
  const [printReady, setPrintReady] = useState(false);

  useEffect(() => {
    if (!printReady) return;
    const timer = window.setTimeout(() => window.print(), 80);
    return () => window.clearTimeout(timer);
  }, [printReady]);

  return <>
    <StudentReportCardPrint student={student} onReady={() => setPrintReady(true)} />
    {!printReady && <div className="report-card-progress" aria-live="polite">Preparing the official student report…</div>}
    {printReady && <button type="button" className="report-card-close" onClick={onClose}>Close print preview</button>}
  </>;
}
