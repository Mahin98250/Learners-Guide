import { useEffect, useState } from "react";
import { C } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { Badge, Card, Sec } from "@/lg/ui";

export function STAttendanceFixed({ student }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setError("");
      try {
        // Attendance has historically used both the student's UUID and SID in
        // different records. Read both identifiers so older and newer records
        // remain visible, then de-duplicate them by attendance row id.
        const identifiers = [...new Set(
          [student?.id, student?.sid]
            .map((value) => String(value ?? "").trim())
            .filter(Boolean),
        )];
        if (!identifiers.length) { setRows([]); return; }

        const { data, error: queryError } = await supabase
          .from("attendance")
          .select("id,sid,date,status,by,created_at")
          .in("sid", identifiers)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;

        const uniqueRows = [...new Map((data || []).map((row) => [String(row.id), row])).values()];
        if (live) setRows(uniqueRows);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Unable to load attendance.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [student?.id, student?.sid]);

  const present = rows.filter((r) => String(r.status || "").toLowerCase() === "present").length;
  const absent = rows.filter((r) => String(r.status || "").toLowerCase() === "absent").length;
  const leave = rows.filter((r) => String(r.status || "").toLowerCase() === "leave").length;
  const rate = rows.length ? Math.round((present / rows.length) * 100) : null;

  return <div>
    {error && <Card style={{ color: C.red, marginBottom: 12, background: "#FEF2F2" }}>{error}</Card>}
    <Card style={{ textAlign: "center", padding: 24, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: C.sub }}>Overall Attendance</div>
      <div style={{ fontSize: 48, fontWeight: 900, color: rate == null ? C.sub : rate >= 75 ? C.green : C.red }}>{rate == null ? "—" : `${rate}%`}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12, fontSize: 12 }}><span>✅ {present}</span><span>❌ {absent}</span><span>🟡 {leave}</span></div>
    </Card>
    <Sec title="Attendance Log 📋" />
    {loading ? <Card style={{ padding: 26, textAlign: "center", color: C.sub }}>Loading attendance…</Card> : rows.length ? rows.map((r) => <Card key={r.id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{r.date || "—"}</span><Badge label={r.status || "unknown"} /></Card>) : <Card style={{ padding: 26, textAlign: "center", color: C.sub }}>No attendance records have been saved for this student yet.</Card>}
  </div>;
}
