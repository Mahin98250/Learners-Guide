import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { Card } from "@/lg/ui";

type Row = Record<string, any>;
type ProfileType = "student" | "teacher" | "parent";

const clean = (v: unknown) => String(v ?? "").trim();
const Cx = { bg: "#F0F4FF", text: "#0F1B3D", sub: "#64748B", border: "#E2E8F0", accent: "#4361EE", red: "#EF4444" };

export function AdminProfilePage({ onBack }: { onBack?: () => void }) {
  const [type, setType] = useState<ProfileType>("student");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const table = type === "student" ? "students" : type === "teacher" ? "teachers" : "users";
        let q = supabase.from(table).select("*").order("name");
        if (type === "parent") q = q.eq("role", "parent");
        const { data, error: e } = await q;
        if (e) throw e;
        if (live) setRows(data || []);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Unable to load profiles.");
      }
    })();
    return () => { live = false; };
  }, [type]);

  const list = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((r) => !q || `${r.name || ""} ${r.sid || r.tid || r.phone || r.email || r.id || ""}`.toLowerCase().includes(q));
  }, [rows, query]);

  if (selected) return <div style={{ minHeight: "100%", background: Cx.bg, padding: 26, color: Cx.text }}><ProfileDetail type={type} profile={selected} onBack={() => setSelected(null)} /></div>;

  return (
    <div style={{ minHeight: "100%", background: Cx.bg, padding: 26, color: Cx.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div><h2 style={{ margin: 0 }}>🔎 User Profiles</h2><div style={{ fontSize: 12, color: Cx.sub }}>Live profiles from Supabase.</div></div>
        {onBack && <button type="button" onClick={onBack}>← Back</button>}
      </div>
      {error && <Card style={{ color: Cx.red, marginBottom: 12 }}>{error}</Card>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["student", "teacher", "parent"] as ProfileType[]).map((t) => <button key={t} type="button" onClick={() => { setType(t); setSelected(null); setQuery(""); }}>{t} {t === type ? `(${rows.length})` : ""}</button>)}
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${type}…`} style={{ width: "100%", padding: 12, boxSizing: "border-box", marginBottom: 12 }} />
      {list.map((r) => <button key={String(r.id)} type="button" onClick={() => setSelected(r)} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, border: 0, borderTop: `1px solid ${Cx.border}`, background: "transparent" }}><b>{r.name || "Unnamed"}</b><div style={{ fontSize: 11, color: Cx.sub }}>{r.sid || r.tid || r.phone || r.email || r.id}</div></button>)}
    </div>
  );
}

function ProfileDetail({ type, profile, onBack }: { type: ProfileType; profile: Row; onBack: () => void }) {
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [results, setResults] = useState<Row[]>([]);
  const [fees, setFees] = useState<Row[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (type === "parent") return;
        const id = clean(profile.id);
        const [a, r, f] = await Promise.all([
          supabase.from("attendance").select("id,sid,date,status").eq("sid", id),
          supabase.from("test_results").select("id,test_id,student_id,marks,remarks").eq("student_id", id),
          supabase.from("fees").select("id,sid,amount,status,due").eq("sid", id),
        ]);
        if (live) { setAttendance(a.data || []); setResults(r.data || []); setFees(f.data || []); }
      } catch { /* keep profile visible even if detail reads fail */ }
    })();
    return () => { live = false; };
  }, [profile, type]);

  return (
    <div>
      <button type="button" onClick={onBack}>← Back</button>
      <h2>{profile.name || "Profile"}</h2>
      {type === "parent" ? <Card>Parent profile · {profile.email || profile.phone || "No contact"}</Card> : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <Card>Attendance: {attendance.length}</Card><Card>Results: {results.length}</Card><Card>Fees: {fees.length}</Card>
        </div>
      )}
    </div>
  );
}
