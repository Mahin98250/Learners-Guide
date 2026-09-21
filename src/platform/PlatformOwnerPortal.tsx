import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";

type Institute = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
};

type Domain = {
  id: string;
  institute_id: string;
  hostname: string;
  domain_type: string;
  status: string;
  tls_status: string;
  is_primary: boolean;
};

type AuditLog = {
  id: string;
  institute_id: string | null;
  action: string;
  entity_type: string | null;
  summary: string | null;
  created_at: string;
};

function fmtDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const shell = {
  minHeight: "100vh",
  background: "#f5f7fb",
  color: "#14213d",
  fontFamily: "Poppins,system-ui,sans-serif",
};

const button = (primary = true) => ({
  border: 0,
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  background: primary ? "#4f46e5" : "#e8ecf5",
  color: primary ? "#fff" : "#24324a",
});

export default function PlatformOwnerPortal() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [domainInstitute, setDomainInstitute] = useState("");
  const [domainHostname, setDomainHostname] = useState("");

  const instituteName = useMemo(
    () => new Map(institutes.map((item) => [item.id, item.name])),
    [institutes],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: roleData, error: roleError } = await supabase.rpc("current_platform_roles");
      if (roleError) throw roleError;
      const nextRoles = (roleData || []).map((row: { role?: string }) => String(row.role || "")).filter(Boolean);
      setRoles(nextRoles);
      const isAllowed = nextRoles.length > 0;
      setAllowed(isAllowed);
      if (!isAllowed) return;

      const [institutesResult, domainsResult, auditResult] = await Promise.all([
        supabase.from("institutes").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
        supabase.from("institute_domains").select("id,institute_id,hostname,domain_type,status,tls_status,is_primary").order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("id,institute_id,action,entity_type,summary,created_at").eq("scope", "platform").order("created_at", { ascending: false }).limit(50),
      ]);
      if (institutesResult.error) throw institutesResult.error;
      if (domainsResult.error) throw domainsResult.error;
      if (auditResult.error) throw auditResult.error;
      setInstitutes((institutesResult.data || []) as Institute[]);
      setDomains((domainsResult.data || []) as Domain[]);
      setAudit((auditResult.data || []) as AuditLog[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the platform control center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createInstitute = async () => {
    setWorking("create");
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_institute", {
        p_name: createName,
        p_slug: createSlug,
        p_timezone: "Asia/Kolkata",
        p_locale: "en-IN",
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("Institute creation did not return an ID.");
      setCreateName("");
      setCreateSlug("");
      setCreateOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create institute.");
    } finally {
      setWorking("");
    }
  };

  const registerDomain = async () => {
    setWorking("domain");
    setError("");
    try {
      if (!domainInstitute) throw new Error("Select an institute.");
      const { error: rpcError } = await supabase.rpc("register_institute_domain", {
        p_institute_id: domainInstitute,
        p_hostname: domainHostname,
        p_domain_type: "custom",
      });
      if (rpcError) throw rpcError;
      setDomainHostname("");
      setDomainOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to register domain.");
    } finally {
      setWorking("");
    }
  };

  if (allowed === false) {
    return (
      <main style={{ ...shell, display: "grid", placeItems: "center", padding: 24 }}>
        <section style={{ width: "min(560px,100%)", background: "#fff", borderRadius: 24, padding: 30, boxShadow: "0 20px 60px rgba(15,23,42,.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, color: "#6b7280" }}>PLATFORM CONTROL CENTER</div>
          <h1 style={{ margin: "8px 0", fontSize: 28 }}>Platform access required</h1>
          <p style={{ color: "#64748b", lineHeight: 1.65, marginBottom: 18 }}>
            This surface is protected separately from institute roles. Add an active platform membership for the authorized operator account before using the control center.
          </p>
          <div style={{ padding: 12, background: "#f8fafc", borderRadius: 14, fontSize: 12, color: "#64748b" }}>
            Current platform roles: {roles.length ? roles.join(", ") : "none"}
          </div>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main style={{ ...shell, display: "grid", placeItems: "center" }}>Loading platform control center…</main>;
  }

  const active = institutes.filter((x) => x.status === "active").length;
  const trial = institutes.filter((x) => x.status === "trial").length;
  const customDomains = domains.filter((x) => x.domain_type === "custom").length;

  return (
    <main style={shell}>
      <header style={{ padding: "26px clamp(16px,4vw,42px) 18px", background: "linear-gradient(135deg,#17124d,#3224a6)", color: "#fff" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, opacity: 0.7 }}>PLATFORM OWNER</div>
            <h1 style={{ margin: "5px 0 4px", fontSize: "clamp(26px,4vw,38px)" }}>Control Center</h1>
            <div style={{ opacity: 0.72 }}>Multi-institute SaaS operations, tenants, domains and audit.</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>Role{roles.length === 1 ? "" : "s"}: {roles.join(", ")}</div>
        </div>
      </header>

      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "22px clamp(16px,4vw,42px) 50px" }}>
        {error && <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: "#fff1f2", color: "#b42318", border: "1px solid #fecdd3" }}>{error}</div>}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
          {[
            ["Institutes", institutes.length],
            ["Active", active],
            ["Trial", trial],
            ["Custom domains", customDomains],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 18, padding: 18 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(320px,.8fr)", gap: 16, alignItems: "start" }}>
          <div style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: 18, borderBottom: "1px solid #eef1f6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#7c3aed" }}>TENANTS</div>
                <h2 style={{ margin: "4px 0", fontSize: 22 }}>Institutes</h2>
              </div>
              <button type="button" style={button(true)} onClick={() => setCreateOpen(true)}>+ Create institute</button>
            </div>
            {institutes.map((institute) => (
              <div key={institute.id} style={{ padding: 16, borderBottom: "1px solid #eef1f6", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{institute.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{institute.slug} · created {fmtDate(institute.created_at)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ padding: "5px 9px", borderRadius: 999, background: institute.status === "active" ? "#ecfdf3" : "#fff7ed", color: institute.status === "active" ? "#027a48" : "#b54708", fontSize: 11, fontWeight: 900 }}>{institute.status}</span>
                  <button type="button" style={button(false)} onClick={() => { setDomainInstitute(institute.id); setDomainOpen(true); }}>Add domain</button>
                </div>
              </div>
            ))}
            {!institutes.length && <div style={{ padding: 28, color: "#64748b" }}>No institutes yet.</div>}
          </div>

          <div style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: 18, borderBottom: "1px solid #eef1f6" }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#0f766e" }}>DOMAINS</div>
              <h2 style={{ margin: "4px 0", fontSize: 22 }}>Portal routing</h2>
            </div>
            {domains.map((domain) => (
              <div key={domain.id} style={{ padding: 14, borderBottom: "1px solid #eef1f6" }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{domain.hostname}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                  {instituteName.get(domain.institute_id) || "Unknown institute"} · {domain.status} · TLS {domain.tls_status}
                </div>
              </div>
            ))}
            {!domains.length && <div style={{ padding: 24, color: "#64748b", fontSize: 13 }}>No domains registered. The final platform domain can be configured later without changing the tenant model.</div>}
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, overflow: "hidden", marginTop: 16 }}>
          <div style={{ padding: 18, borderBottom: "1px solid #eef1f6" }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#475569" }}>AUDIT</div>
            <h2 style={{ margin: "4px 0", fontSize: 22 }}>Recent platform activity</h2>
          </div>
          {audit.map((item) => (
            <div key={item.id} style={{ padding: 14, borderBottom: "1px solid #eef1f6", display: "grid", gridTemplateColumns: "160px 190px 1fr", gap: 12 }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(item.created_at)}</div>
              <div style={{ fontSize: 12, fontWeight: 900 }}>{item.action}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>{instituteName.get(item.institute_id || "") || item.summary || "Platform event"}</div>
            </div>
          ))}
          {!audit.length && <div style={{ padding: 24, color: "#64748b" }}>No audit entries yet.</div>}
        </section>
      </div>

      {createOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setCreateOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.42)", display: "grid", placeItems: "center", padding: 18, zIndex: 1000 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(520px,100%)", background: "#fff", borderRadius: 22, padding: 22, boxShadow: "0 24px 80px rgba(15,23,42,.2)" }}>
            <h3 style={{ margin: 0, fontSize: 21 }}>Create institute</h3>
            <p style={{ margin: "7px 0 18px", color: "#64748b", fontSize: 13 }}>Creates the tenant, settings and default roles. Owner invitation comes through the secure provisioning flow.</p>
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Institute name" style={{ width: "100%", padding: 12, borderRadius: 11, border: "1px solid #d8dee9", marginBottom: 10 }} />
            <input value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} placeholder="slug (example: abc-academy)" style={{ width: "100%", padding: 12, borderRadius: 11, border: "1px solid #d8dee9" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" style={button(false)} onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="button" style={button(true)} disabled={working === "create" || !createName.trim() || !createSlug.trim()} onClick={() => void createInstitute()}>{working === "create" ? "Creating…" : "Create institute"}</button>
            </div>
          </div>
        </div>
      )}

      {domainOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setDomainOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.42)", display: "grid", placeItems: "center", padding: 18, zIndex: 1000 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(520px,100%)", background: "#fff", borderRadius: 22, padding: 22, boxShadow: "0 24px 80px rgba(15,23,42,.2)" }}>
            <h3 style={{ margin: 0, fontSize: 21 }}>Register custom domain</h3>
            <p style={{ margin: "7px 0 18px", color: "#64748b", fontSize: 13 }}>This creates a pending verification record. DNS verification and TLS provisioning are handled by the hosting layer.</p>
            <select value={domainInstitute} onChange={(e) => setDomainInstitute(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 11, border: "1px solid #d8dee9", marginBottom: 10 }}>
              <option value="">Select institute</option>
              {institutes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={domainHostname} onChange={(e) => setDomainHostname(e.target.value)} placeholder="portal.example.org" style={{ width: "100%", padding: 12, borderRadius: 11, border: "1px solid #d8dee9" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" style={button(false)} onClick={() => setDomainOpen(false)}>Cancel</button>
              <button type="button" style={button(true)} disabled={working === "domain" || !domainInstitute || !domainHostname.trim()} onClick={() => void registerDomain()}>{working === "domain" ? "Registering…" : "Register domain"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
