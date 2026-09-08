import { useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";
import { C } from "@/lg/data";
import { Card, Sec } from "@/lg/ui";

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
        rows.map((row) => (
          <Card key={row.id} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 900 }}>{row.title || "Announcement"}</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{row.date || row.created_at || "—"}</div>
            {row.desc && <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{row.desc}</div>}
          </Card>
        ))
      ) : (
        <Card style={{ padding: 24, textAlign: "center", color: C.sub }}>No announcements are available for you right now.</Card>
      )}
    </div>
  );
}
