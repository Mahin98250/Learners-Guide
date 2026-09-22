import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";

type Institute = { id: string; name: string; slug: string; status?: string };
type Person = { id: string; display_name: string | null; email: string | null; phone: string | null; status: string };
type Membership = { id: string; institute_id: string; person_id: string; role: string; role_id: string | null; status: string; created_at?: string };
type Role = { id: string; institute_id: string; role_key: string; name: string; description: string | null; is_system: boolean; status: string };
type Permission = { code: string; name: string; description: string | null };
type RolePermission = { role_id: string; permission_code: string };

const button = (primary = false) => ({
  border: 0,
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 800,
  cursor: "pointer",
  background: primary ? "#4f46e5" : "#edf1f7",
  color: primary ? "#fff" : "#24324a",
});
const input = { width: "100%", boxSizing: "border-box" as const, padding: 10, borderRadius: 10, border: "1px solid #d8dee9" };

export function PlatformMembershipPanel({ institutes }: { institutes: Institute[] }) {
  const [instituteId, setInstituteId] = useState(institutes[0]?.id || "");
  const [people, setPeople] = useState<Person[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [personId, setPersonId] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [tab, setTab] = useState<"members" | "roles">("members");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleKeyNew, setRoleKeyNew] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!instituteId) return;
    setError("");
    const [peopleResult, membershipsResult, rolesResult, permissionsResult] = await Promise.all([
      supabase.from("people").select("id,display_name,email,phone,status").order("display_name"),
      supabase.from("institute_memberships").select("id,institute_id,person_id,role,role_id,status,created_at").eq("institute_id", instituteId).order("created_at", { ascending: false }),
      supabase.from("institute_roles").select("id,institute_id,role_key,name,description,is_system,status").eq("institute_id", instituteId).eq("status", "active").order("is_system", { ascending: false }).order("name"),
      supabase.from("permissions").select("code,name,description").order("code"),
    ]);
    if (peopleResult.error) throw peopleResult.error;
    if (membershipsResult.error) throw membershipsResult.error;
    if (rolesResult.error) throw rolesResult.error;
    if (permissionsResult.error) throw permissionsResult.error;

    setPeople((peopleResult.data || []) as Person[]);
    setMemberships((membershipsResult.data || []) as Membership[]);
    setRoles((rolesResult.data || []) as Role[]);
    setPermissions((permissionsResult.data || []) as Permission[]);

    const ids = (rolesResult.data || []).map((r: any) => r.id);
    if (ids.length) {
      const rp = await supabase.from("institute_role_permissions").select("role_id,permission_code").in("role_id", ids);
      if (rp.error) throw rp.error;
      setRolePermissions((rp.data || []) as RolePermission[]);
    } else {
      setRolePermissions([]);
    }
  }, [instituteId]);

  useEffect(() => {
    if (!instituteId && institutes[0]) setInstituteId(institutes[0].id);
  }, [instituteId, institutes]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load people and roles."));
  }, [load]);

  const institute = institutes.find((x) => x.id === instituteId);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const filteredMemberships = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return memberships.filter((m) => {
      if (!q) return true;
      const p = personMap.get(m.person_id);
      return [p?.display_name, p?.email, p?.phone, m.role, m.status].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [memberships, memberSearch, personMap]);

  const selectedRoles = roles;
  const selectedRole = roleMap.get(selectedRoleId);
  const selectedRolePermissionSet = useMemo(
    () => new Set(rolePermissions.filter((x) => x.role_id === selectedRoleId).map((x) => x.permission_code)),
    [rolePermissions, selectedRoleId],
  );
  const activeMembers = memberships.filter((m) => m.status === "active").length;
  const suspendedMembers = memberships.filter((m) => m.status === "suspended").length;
  const ownerCount = memberships.filter((m) => m.status === "active" && m.role === "institute_owner").length;

  useEffect(() => {
    if (!selectedRoleId || !roles.some((r) => r.id === selectedRoleId)) setSelectedRoleId(roles[0]?.id || "");
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (roleKey && roles.some((r) => r.role_key === roleKey)) return;
    setRoleKey(roles[0]?.role_key || "");
  }, [roles, roleKey]);

  const assign = async () => {
    if (!instituteId || !personId || !roleKey) return;
    setBusy("assign"); setError(""); setNotice("");
    try {
      const r = await supabase.rpc("platform_assign_institute_membership", {
        p_institute_id: instituteId, p_person_id: personId, p_role_key: roleKey,
      });
      if (r.error) throw r.error;
      setNotice("Membership role updated.");
      setPersonId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update membership.");
    } finally { setBusy(""); }
  };

  const changeStatus = async (m: Membership, status: string) => {
    setBusy("status:" + m.id); setError(""); setNotice("");
    try {
      const r = await supabase.rpc("platform_set_institute_membership_status", {
        p_institute_id: m.institute_id, p_person_id: m.person_id, p_status: status,
      });
      if (r.error) throw r.error;
      setNotice("Membership status updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update membership status.");
    } finally { setBusy(""); }
  };

  const createRole = async () => {
    if (!instituteId || !roleKeyNew.trim() || !roleName.trim()) return;
    setBusy("create-role"); setError(""); setNotice("");
    try {
      const r = await supabase.rpc("platform_create_institute_role", {
        p_institute_id: instituteId, p_role_key: roleKeyNew.trim(), p_name: roleName.trim(), p_description: roleDescription.trim(),
      });
      if (r.error) throw r.error;
      setRoleKeyNew(""); setRoleName(""); setRoleDescription(""); setCreateRoleOpen(false);
      setNotice("Custom role created. Configure its permissions in the Roles tab.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create role.");
    } finally { setBusy(""); }
  };

  const setPermission = async (permission: Permission, enabled: boolean) => {
    if (!selectedRole || selectedRole.is_system) return;
    setBusy("permission:" + permission.code); setError(""); setNotice("");
    try {
      const r = await supabase.rpc("platform_set_role_permission", {
        p_role_id: selectedRole.id, p_permission_code: permission.code, p_enabled: enabled,
      });
      if (r.error) throw r.error;
      setRolePermissions((prev) => enabled
        ? [...prev.filter((x) => !(x.role_id === selectedRole.id && x.permission_code === permission.code)), { role_id: selectedRole.id, permission_code: permission.code }]
        : prev.filter((x) => !(x.role_id === selectedRole.id && x.permission_code === permission.code)));
      setNotice("Role permission saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update role permission.");
    } finally { setBusy(""); }
  };

  const archiveRole = async () => {
    if (!selectedRole || selectedRole.is_system || !window.confirm(`Archive the custom role “${selectedRole.name}”? Active members must be reassigned first.`)) return;
    setBusy("archive-role"); setError(""); setNotice("");
    try {
      const r = await supabase.rpc("platform_archive_institute_role", { p_role_id: selectedRole.id });
      if (r.error) throw r.error;
      setNotice("Custom role archived.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to archive role.");
    } finally { setBusy(""); }
  };

  return (
    <section className="owner-membership-panel" style={{ marginTop: 16, background: "#fff", border: "1px solid #e7ebf2", borderRadius: 22, overflow: "hidden" }}>
      <div style={{ padding: 20, background: "linear-gradient(135deg,#f8f7ff,#fff)", borderBottom: "1px solid #eef1f6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: "#4f46e5" }}>PHASE 1 · PEOPLE & ROLES</div>
            <h2 style={{ margin: "5px 0", fontSize: 24 }}>Access Control Center</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Manage institute memberships and custom role permissions through protected owner operations.</p>
          </div>
          <select value={instituteId} onChange={(e) => setInstituteId(e.target.value)} style={{ ...input, width: 260, alignSelf: "center" }}>
            {institutes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div role="alert" style={{ margin: 16, padding: 11, borderRadius: 11, background: "#fff1f2", color: "#b42318", border: "1px solid #fecdd3", fontSize: 12 }}>{error}</div>}
      {notice && <div style={{ margin: "16px 16px 0", padding: 11, borderRadius: 11, background: "#ecfdf3", color: "#027a48", border: "1px solid #bbf7d0", fontSize: 12 }}>{notice}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, padding: 16 }}>
        {[
          ["Active members", activeMembers],
          ["Suspended", suspendedMembers],
          ["Active roles", roles.length],
          ["Institute owners", ownerCount],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ padding: 14, border: "1px solid #e7ebf2", borderRadius: 15, background: "#fbfcfe" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 25, fontWeight: 900, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 16px 16px", borderBottom: "1px solid #eef1f6" }}>
        <button type="button" onClick={() => setTab("members")} style={button(tab === "members")}>People & memberships</button>
        <button type="button" onClick={() => setTab("roles")} style={button(tab === "roles")}>Roles & permissions</button>
      </div>

      {tab === "members" && (
        <>
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1.1fr 1.1fr .9fr auto", gap: 9 }}>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={input}>
              <option value="">Add or update person…</option>
              {people.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.display_name || p.email || p.phone || p.id}</option>)}
            </select>
            <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} style={input}>
              {selectedRoles.map((r) => <option key={r.id} value={r.role_key}>{r.name}</option>)}
            </select>
            <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Filter members…" style={input} />
            <button type="button" disabled={busy === "assign" || !personId || !roleKey} onClick={() => void assign()} style={{ ...button(true), opacity: !personId || !roleKey ? .55 : 1 }}>
              {busy === "assign" ? "Saving…" : "Assign role"}
            </button>
          </div>

          <div style={{ padding: "0 16px 16px", color: "#64748b", fontSize: 11 }}>
            {institute?.name || "Institute"} · {filteredMemberships.length} memberships shown · Owner actions are MFA-protected server operations.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ textAlign: "left", background: "#f8fafc", color: "#64748b" }}>
                {["Person", "Contact", "Role", "Status", "Action"].map((x) => <th key={x} style={{ padding: 12 }}>{x}</th>)}
              </tr></thead>
              <tbody>
                {filteredMemberships.slice(0, 100).map((m) => {
                  const p = personMap.get(m.person_id);
                  const busyRow = busy === "status:" + m.id;
                  return <tr key={m.id} style={{ borderTop: "1px solid #eef1f6" }}>
                    <td style={{ padding: 12, fontWeight: 800 }}>{p?.display_name || p?.email || p?.phone || m.person_id}</td>
                    <td style={{ padding: 12, color: "#64748b" }}>{p?.email || p?.phone || "—"}</td>
                    <td style={{ padding: 12 }}>
                      <select value={m.role} disabled={busyRow} onChange={(e) => {
                        void (async () => {
                          setBusy("status:" + m.id);
                          setError(""); setNotice("");
                          const r = await supabase.rpc("platform_assign_institute_membership", { p_institute_id: m.institute_id, p_person_id: m.person_id, p_role_key: e.target.value });
                          if (r.error) setError(r.error.message); else setNotice("Role updated.");
                          await load(); setBusy("");
                        })();
                      }} style={{ padding: 7, borderRadius: 8, border: "1px solid #d8dee9" }}>
                        {roles.map((r) => <option key={r.id} value={r.role_key}>{r.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 12 }}>
                      <select value={m.status} disabled={busyRow} onChange={(e) => void changeStatus(m, e.target.value)} style={{ padding: 7, borderRadius: 8, border: "1px solid #d8dee9" }}>
                        <option value="active">active</option><option value="suspended">suspended</option><option value="revoked">revoked</option>
                      </select>
                    </td>
                    <td style={{ padding: 12, color: "#64748b" }}>{p?.status || "unknown"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!filteredMemberships.length && <div style={{ padding: 24, color: "#64748b" }}>No memberships found for this institute.</div>}
        </>
      )}

      {tab === "roles" && (
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "minmax(230px,.55fr) minmax(0,1.45fr)", gap: 16 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
              <b>Roles</b>
              <button type="button" onClick={() => setCreateRoleOpen(true)} style={button(true)}>+ Custom role</button>
            </div>
            <div style={{ display: "grid", gap: 7 }}>
              {roles.map((r) => <button key={r.id} type="button" onClick={() => setSelectedRoleId(r.id)} style={{ textAlign: "left", padding: 12, borderRadius: 12, border: selectedRoleId === r.id ? "2px solid #4f46e5" : "1px solid #e1e6ef", background: selectedRoleId === r.id ? "#f5f3ff" : "#fff", cursor: "pointer" }}>
                <div style={{ fontWeight: 900 }}>{r.name}</div>
                <div style={{ marginTop: 3, fontSize: 10, color: "#64748b" }}>{r.role_key} · {r.is_system ? "System" : "Custom"}</div>
              </button>)}
            </div>
          </div>
          <div>
            {selectedRole ? <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
                <div><div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 900 }}>{selectedRole.is_system ? "SYSTEM ROLE" : "CUSTOM ROLE"}</div><h3 style={{ margin: "4px 0" }}>{selectedRole.name}</h3><p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{selectedRole.description || "No description."}</p></div>
                {!selectedRole.is_system && <button type="button" disabled={busy === "archive-role"} onClick={() => void archiveRole()} style={{ ...button(false), color: "#b42318", background: "#fff1f2" }}>Archive</button>}
              </div>
              <div style={{ padding: 13, borderRadius: 14, background: "#f8fafc", border: "1px solid #e7ebf2", marginBottom: 10, fontSize: 11, color: "#64748b" }}>
                {selectedRole.is_system ? "System-role permissions are protected by the platform baseline. Create a custom role when an institute needs a different access profile." : "Custom-role permissions can be changed here. Every change is written to the platform audit stream."}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 }}>
                {permissions.map((permission) => {
                  const checked = selectedRolePermissionSet.has(permission.code);
                  return <label key={permission.code} style={{ display: "flex", gap: 9, padding: 10, border: "1px solid #e7ebf2", borderRadius: 11, alignItems: "flex-start", opacity: selectedRole.is_system ? .65 : 1 }}>
                    <input type="checkbox" checked={checked} disabled={selectedRole.is_system || busy === "permission:" + permission.code} onChange={(e) => void setPermission(permission, e.target.checked)} />
                    <span><b style={{ fontSize: 12 }}>{permission.name}</b><span style={{ display: "block", fontSize: 10, color: "#64748b", marginTop: 2 }}>{permission.code}</span></span>
                  </label>;
                })}
              </div>
            </> : <div style={{ padding: 24, color: "#64748b" }}>Select a role to manage its permissions.</div>}
          </div>
        </div>
      )}

      {createRoleOpen && <div role="dialog" aria-modal="true" onClick={() => setCreateRoleOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 18, zIndex: 1000 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px,100%)", background: "#fff", borderRadius: 20, padding: 22 }}>
          <h3 style={{ marginTop: 0 }}>Create custom role</h3>
          <p style={{ color: "#64748b", fontSize: 12 }}>Create the role first, then configure its permissions. System roles remain protected.</p>
          <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Role name" style={{ ...input, marginBottom: 9 }} />
          <input value={roleKeyNew} onChange={(e) => setRoleKeyNew(e.target.value)} placeholder="role_key e.g. exam_coordinator" style={{ ...input, marginBottom: 9 }} />
          <textarea value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="Description (optional)" rows={3} style={{ ...input, resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => setCreateRoleOpen(false)} style={button(false)}>Cancel</button>
            <button type="button" disabled={busy === "create-role" || !roleName.trim() || !roleKeyNew.trim()} onClick={() => void createRole()} style={button(true)}>{busy === "create-role" ? "Creating…" : "Create role"}</button>
          </div>
        </div>
      </div>}
    </section>
  );
}
