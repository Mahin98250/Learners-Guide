import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";

type Institute = { id: string; name: string; slug: string };
type Person = { id: string; display_name: string | null; email: string | null; phone: string | null; status: string };
type Membership = { id: string; institute_id: string; person_id: string; role: string; status: string };
type Role = { institute_id: string; role_key: string; name: string };

export function PlatformMembershipPanel({ institutes }: { institutes: Institute[] }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [instituteId, setInstituteId] = useState("");
  const [personId, setPersonId] = useState("");
  const [roleKey, setRoleKey] = useState("institute_admin");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [peopleResult, membershipsResult, rolesResult] = await Promise.all([
      supabase.from("people").select("id,display_name,email,phone,status").eq("status", "active").order("name"),
      supabase.from("institute_memberships").select("id,institute_id,person_id,role,status").order("created_at", { ascending: false }),
      supabase.from("institute_roles").select("institute_id,role_key,name").eq("status", "active").order("display_name"),
    ]);
    if (peopleResult.error) throw peopleResult.error;
    if (membershipsResult.error) throw membershipsResult.error;
    if (rolesResult.error) throw rolesResult.error;
    setPeople((peopleResult.data || []) as Person[]);
    setMemberships((membershipsResult.data || []) as Membership[]);
    setRoles((rolesResult.data || []) as Role[]);
  }, []);

  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load memberships.")); }, [load]);

  const selectedRoles = useMemo(() => roles.filter((role) => role.institute_id === instituteId), [roles, instituteId]);
  const activeMemberships = useMemo(() => memberships.filter((item) => item.status === "active"), [memberships]);
  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((person) => [person.display_name, person.email, person.phone].some((value) => String(value || "").toLowerCase().includes(q)));
  }, [people, query]);
  const personName = useMemo(() => new Map(people.map((person) => [person.id, person.display_name || person.email || person.phone || person.id])), [people]);
  const instituteName = useMemo(() => new Map(institutes.map((item) => [item.id, item.name])), [institutes]);

  useEffect(() => {
    if (selectedRoles.length && !selectedRoles.some((role) => role.role_key === roleKey)) setRoleKey(selectedRoles[0].role_key);
  }, [selectedRoles, roleKey]);

  const assign = async () => {
    if (!instituteId || !personId || !roleKey) return;
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await supabase.rpc("platform_assign_institute_membership", {
        p_institute_id: instituteId, p_person_id: personId, p_role_key: roleKey,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to assign membership.");
    } finally { setBusy(false); }
  };

  const remove = async (membership: Membership) => {
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await supabase.rpc("platform_remove_institute_membership", {
        p_institute_id: membership.institute_id, p_person_id: membership.person_id,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove membership.");
    } finally { setBusy(false); }
  };

  return (
    <section style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: 18, borderBottom: "1px solid #eef1f6" }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#475569" }}>PEOPLE & ACCESS</div>
        <h2 style={{ margin: "4px 0", fontSize: 22 }}>Institute memberships</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Assign existing platform identities to institute workspaces without weakening tenant isolation.</p>
      </div>
      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
        <select value={instituteId} onChange={(e) => setInstituteId(e.target.value)} style={{ padding: 11, borderRadius: 10, border: "1px solid #d8dee9" }}>
          <option value="">Choose institute</option>
          {institutes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ padding: 11, borderRadius: 10, border: "1px solid #d8dee9" }}>
          <option value="">Choose person</option>
          {filteredPeople.map((person) => <option key={person.id} value={person.id}>{person.display_name || person.email || person.phone || person.id}</option>)}
        </select>
        <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} disabled={!selectedRoles.length} style={{ padding: 11, borderRadius: 10, border: "1px solid #d8dee9" }}>
          {selectedRoles.length ? selectedRoles.map((role) => <option key={role.role_key} value={role.role_key}>{role.name} · {role.role_key}</option>) : <option value="">Choose institute first</option>}
        </select>
        <button type="button" disabled={busy || !instituteId || !personId || !roleKey} onClick={() => void assign()} style={{ border: 0, borderRadius: 10, background: "#4f46e5", color: "#fff", fontWeight: 800, cursor: "pointer", opacity: busy || !instituteId || !personId || !roleKey ? .55 : 1 }}>Assign / update</button>
      </div>
      <div style={{ padding: "0 18px 12px" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter people by name, email or phone…" style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 10, border: "1px solid #d8dee9" }} />
      </div>
      {error && <div role="alert" style={{ margin: "0 18px 12px", padding: 11, borderRadius: 10, background: "#fff1f2", color: "#b42318", fontSize: 12 }}>{error}</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f8fafc", textAlign: "left", color: "#64748b" }}><th style={{ padding: 12 }}>Person</th><th style={{ padding: 12 }}>Institute</th><th style={{ padding: 12 }}>Role</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }} /></tr></thead>
          <tbody>{activeMemberships.slice(0, 40).map((membership) => (
            <tr key={membership.id} style={{ borderTop: "1px solid #eef1f6" }}>
              <td style={{ padding: 12 }}>{personName.get(membership.person_id) || membership.person_id}</td>
              <td style={{ padding: 12 }}>{instituteName.get(membership.institute_id) || membership.institute_id}</td>
              <td style={{ padding: 12 }}>{membership.role}</td>
              <td style={{ padding: 12 }}>{membership.status}</td>
              <td style={{ padding: 12, textAlign: "right" }}><button type="button" disabled={busy} onClick={() => void remove(membership)} style={{ border: 0, borderRadius: 8, padding: "7px 10px", background: "#fff1f2", color: "#b42318", cursor: "pointer" }}>Remove</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
