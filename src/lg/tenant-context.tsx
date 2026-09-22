import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { clearCache } from "@/lg/data";
import {
  getCurrentInstituteContext,
  clearInstituteContextCache,
  setPreferredInstituteId,
  type InstituteMembershipContext,
  type InstituteTenant,
} from "@/lg/tenant";

export type InstituteWorkspaceValue = {
  tenant: InstituteTenant | null;
  membership: InstituteMembershipContext | null;
  memberships: InstituteMembershipContext[];
  instituteId: string | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  selectInstitute: (instituteId: string) => Promise<void>;
};

const InstituteWorkspaceContext = createContext<InstituteWorkspaceValue | null>(null);

export function InstituteWorkspaceProvider({ children }: PropsWithChildren) {
  const [tenant, setTenant] = useState<InstituteTenant | null>(null);
  const [membership, setMembership] = useState<InstituteMembershipContext | null>(null);
  const [memberships, setMemberships] = useState<InstituteMembershipContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const context = await getCurrentInstituteContext();
      setTenant(context.tenant);
      setMembership(context.membership);
      setMemberships(context.memberships);
    } catch (e) {
      setTenant(null);
      setMembership(null);
      setMemberships([]);
      setError(e instanceof Error ? e.message : "Unable to resolve the institute workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectInstitute = useCallback(async (instituteId: string) => {
    const valid = memberships.some((item) => item.institute_id === instituteId);
    if (!valid) throw new Error("You do not belong to that institute.");
    clearCache();
    clearInstituteContextCache();
    setPreferredInstituteId(instituteId);
    await refresh();
  }, [memberships, refresh]);

  const value = useMemo<InstituteWorkspaceValue>(() => ({
    tenant,
    membership,
    memberships,
    instituteId: membership?.institute_id ?? null,
    loading,
    error,
    refresh,
    selectInstitute,
  }), [tenant, membership, memberships, loading, error, refresh, selectInstitute]);

  return <InstituteWorkspaceContext.Provider value={value}>{children}</InstituteWorkspaceContext.Provider>;
}

export function useInstituteWorkspace() {
  const value = useContext(InstituteWorkspaceContext);
  if (!value) throw new Error("useInstituteWorkspace must be used inside InstituteWorkspaceProvider");
  return value;
}

export function InstituteWorkspaceGate({ children }: PropsWithChildren) {
  const { tenant, membership, memberships, loading, error, selectInstitute } = useInstituteWorkspace();

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,system-ui,sans-serif", color: "#24324a", padding: 24 }}>Resolving institute workspace…</div>;
  }

  if (error) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7fb", fontFamily: "Poppins,system-ui,sans-serif" }}>
        <section style={{ width: "min(560px,100%)", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: 26, boxShadow: "0 18px 50px rgba(15,23,42,.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.1, color: "#b42318" }}>WORKSPACE ERROR</div>
          <h1 style={{ margin: "7px 0 8px", fontSize: 26 }}>Institute context could not be verified</h1>
          <p style={{ color: "#64748b", lineHeight: 1.65 }}>{error}</p>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 8, border: 0, borderRadius: 10, padding: "10px 14px", background: "#4f46e5", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Retry</button>
        </section>
      </main>
    );
  }

  if (!membership && memberships.length > 1) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7fb", fontFamily: "Poppins,system-ui,sans-serif" }}>
        <section style={{ width: "min(720px,100%)", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: 26, boxShadow: "0 18px 50px rgba(15,23,42,.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.1, color: "#4f46e5" }}>INSTITUTE WORKSPACE</div>
          <h1 style={{ margin: "7px 0 8px", fontSize: 28 }}>Choose an institute</h1>
          <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 18 }}>This account belongs to more than one institute. Choose the workspace you want to open.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {memberships.map((item) => (
              <button key={item.institute_id} type="button" onClick={() => void selectInstitute(item.institute_id)} style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "#fff", cursor: "pointer" }}>
                <strong style={{ display: "block", color: "#172033" }}>{item.institute_id}</strong>
                <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#64748b" }}>Role: {item.role}</span>
              </button>
            ))}
          </div>
          {tenant && <div style={{ marginTop: 14, fontSize: 12, color: "#64748b" }}>Portal host selected: {tenant.display_name || tenant.name}</div>}
        </section>
      </main>
    );
  }

  if (!membership) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7fb", fontFamily: "Poppins,system-ui,sans-serif" }}>
        <section style={{ width: "min(560px,100%)", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: 26, boxShadow: "0 18px 50px rgba(15,23,42,.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.1, color: "#b42318" }}>ACCESS BLOCKED</div>
          <h1 style={{ margin: "7px 0 8px", fontSize: 26 }}>No active institute membership</h1>
          <p style={{ color: "#64748b", lineHeight: 1.65 }}>This account is not assigned to an active institute workspace.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
