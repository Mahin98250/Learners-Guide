import { useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";
import { C } from "@/lg/data";
import { Card, Sec } from "@/lg/ui";
import { relativeDate } from "@/lg/dateUtils";

export function StudentAnnouncements({ student }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // RLS is the source of truth for audience/batch visibility. Do not
        // reproduce the authorization rules in a client-side target filter.
        const { data, error: queryError } = await supabase
          .from("announcements")
          .select("id,title,desc,date,target,created_at")
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;
        if (live) setRows(data || []);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Unable to load announcements.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [student?.id]);

  return (
    <div>
      {error && <Card style={{ color: C.red, background: "#FEF2F2", marginBottom: 12 }}>{error}</Card>}
      <Sec title="Announcements & News 📢" />
      {loading ? (
        <Card style={{ padding: 28, textAlign: "center", color: C.sub }}>Loading announcements…</Card>
      ) : rows.length ? (
        rows.map((row) => {
          const d = relativeDate(row.date || row.created_at);
          return (
            <Card key={row.id} style={{ marginBottom: 10, borderLeft: d.primary === "Today" ? "4px solid #EF4444" : "1px solid #EEF2FF" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 900, minWidth: 0 }}>{row.title || "Announcement"}</div>
                <span style={{ flexShrink: 0, padding: "4px 9px", borderRadius: 999, background: d.primary === "Today" ? "#FEE2E2" : "#EEF2FF", color: d.primary === "Today" ? "#B91C1C" : C.accent, fontSize: 10, fontWeight: 900 }}>{d.primary}</span>
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>{d.secondary || "Announcement date"}</div>
              {row.desc && <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{row.desc}</div>}
            </Card>
          );
        })
      ) : (
        <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>No announcements are available for you right now.</Card>
      )}
    </div>
  );
}
