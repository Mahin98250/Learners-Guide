import { Suspense, lazy, useEffect, useState } from "react";
import PlatformOwnerLogin from "@/platform/PlatformOwnerLogin";
import {
  getPlatformInstituteDetail,
  getPlatformInstituteStatusCounts,
  listPlatformInstitutes,
  type PlatformInstitute,
  type PlatformInstituteCursor,
  type PlatformInstituteDetail,
} from "@/platform/platform-tenant-data";
import { supabase } from "@/lg/supabase";
import "./owner-liquid-glass.css";

const LegacyOperations = lazy(() => import("@/platform/PlatformOwnerPortal"));

const shell = {
  minHeight: "100vh",
  background: "#f5f7fb",
  color: "#14213d",
  fontFamily: "Poppins,system-ui,sans-serif",
};

const button = (primary = true) => ({
  border: 0,
  borderRadius: 11,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  background: primary ? "#4f46e5" : "#e8ecf5",
  color: primary ? "#fff" : "#24324a",
});

function errorIsUnauthorized(error: unknown) {
  return Number((error as { status?: number } | null)?.status) === 401 ||
    /jwt|unauthorized/i.test(String((error as { message?: string } | null)?.message || ""));
}

export default function PlatformOwnerControlPlane() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [institutes, setInstitutes] = useState<PlatformInstitute[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cursor, setCursor] = useState<PlatformInstituteCursor | null>(null);
  const [nextCursor, setNextCursor] = useState<PlatformInstituteCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "trial" | "active" | "suspended" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PlatformInstitute | null>(null);
  const [detail, setDetail] = useState<PlatformInstituteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusWorking, setStatusWorking] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createHostname, setCreateHostname] = useState("");
  const [createWorking, setCreateWorking] = useState(false);

  const loadDirectory = async (next: PlatformInstituteCursor | null = null) => {
    setDirectoryLoading(true);
    setError("");
    try {
      const page = await listPlatformInstitutes({
        limit: 50,
        cursor: next,
        search: query,
        status,
      });
      setInstitutes(page.items);
      setHasMore(page.has_more);
      setNextCursor(page.next_cursor);
      setCursor(next);
    } catch (e) {
      if (errorIsUnauthorized(e)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setAuthenticated(false);
        setAllowed(false);
        return;
      }
      setError(e instanceof Error ? e.message : "Unable to load the institute directory.");
    } finally {
      setDirectoryLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const verify = async () => {
      try {
        const session = await supabase.auth.getSession();
        if (session.error || !session.data.session) {
          setAuthenticated(false);
          setAllowed(false);
          setLoading(false);
          return;
        }

        const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal.error) throw aal.error;
        if (aal.data?.currentLevel !== "aal2") {
          setAuthenticated(false);
          setAllowed(false);
          setLoading(false);
          return;
        }

        const rolesResult = await supabase.rpc("current_platform_roles");
        if (rolesResult.error) throw rolesResult.error;
        const nextRoles = (rolesResult.data || [])
          .map((row: { role?: string }) => String(row.role || ""))
          .filter(Boolean);

        setRoles(nextRoles);
        setAuthenticated(true);
        setAllowed(nextRoles.length > 0);

        if (!nextRoles.length) setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to verify platform access.");
        setAuthenticated(false);
        setAllowed(false);
        setLoading(false);
      }
    };

    void verify();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthenticated(false);
        setAllowed(false);
        setRoles([]);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authenticated !== true) return;
    const timer = window.setTimeout(async () => {
      setCursor(null);
      await loadDirectory(null);
      const nextCounts = await getPlatformInstituteStatusCounts().catch(() => null);
      if (nextCounts) setCounts(nextCounts);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, status, authenticated]);

  const openDetail = async (institute: PlatformInstitute) => {
    setSelected(institute);
    setDetail(null);
    setDetailLoading(true);
    setError("");
    try {
      setDetail(await getPlatformInstituteDetail(institute.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load institute details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const createInstitute = async () => {
    if (!createName.trim() || !createSlug.trim() || createWorking) return;
    setCreateWorking(true);
    setError("");
    try {
      const result = await supabase.rpc("platform_provision_institute", {
        p_name: createName.trim(),
        p_slug: createSlug.trim().toLowerCase(),
        p_hostname: createHostname.trim().toLowerCase() || null,
      });
      if (result.error) throw result.error;
      setCreateName("");
      setCreateSlug("");
      setCreateHostname("");
      setCreateOpen(false);
      setSearch("");
      setQuery("");
      setStatus("all");
      setCursor(null);
      await loadDirectory(null);
    } catch (e) {
      if (errorIsUnauthorized(e)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setAuthenticated(false);
        setAllowed(false);
        return;
      }
      setError(e instanceof Error ? e.message : "Unable to create institute.");
    } finally {
      setCreateWorking(false);
    }
  };

  const changeInstituteStatus = async (nextStatus: "trial" | "active" | "suspended" | "archived") => {
    if (!selected || statusWorking || selected.status === nextStatus) return;
    setStatusWorking(true);
    setError("");
    try {
      const result = await supabase.rpc("platform_set_institute_status", {
        p_institute_id: selected.id,
        p_status: nextStatus,
      });
      if (result.error) throw result.error;
      setSelected({ ...selected, status: nextStatus });
      setDetail((current) => current ? { ...current, institute: { ...current.institute, status: nextStatus } } : current);
      await loadDirectory(null);
    } catch (e) {
      if (errorIsUnauthorized(e)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setAuthenticated(false);
        setAllowed(false);
        return;
      }
      setError(e instanceof Error ? e.message : "Unable to change institute status.");
    } finally {
      setStatusWorking(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setAuthenticated(false);
    setAllowed(false);
    setRoles([]);
  };

  const authed = (nextRoles: string[]) => {
    setRoles(nextRoles);
    setAuthenticated(true);
    setAllowed(nextRoles.length > 0);
    setLoading(true);
  };

  if (authenticated === false) {
    return <PlatformOwnerLogin onAuthenticated={authed} />;
  }

  if (allowed === false) {
    return (
      <main className="owner-liquid-glass owner-state-card" style={{ ...shell, display: "grid", placeItems: "center", padding: 24 }}>
        <section style={{ background: "#fff", padding: 30, borderRadius: 24, maxWidth: 560 }}>
          <b>PLATFORM CONTROL CENTER</b>
          <h1>Platform access required</h1>
          <p>Active platform membership and AAL2 verification are required for this surface.</p>
        </section>
      </main>
    );
  }

  if (operationsOpen) {
    return (
      <Suspense
        fallback={
          <main style={{ ...shell, display: "grid", placeItems: "center" }}>
            Loading full platform operations…
          </main>
        }
      >
        <LegacyOperations />
      </Suspense>
    );
  }

  if (loading) {
    return <main className="owner-liquid-glass owner-state-card" style={{ ...shell, display: "grid", placeItems: "center" }}>Loading tenant directory…</main>;
  }

  return (
    <main className="owner-liquid-glass" style={shell}>
      <header style={{ padding: "25px clamp(16px,4vw,42px) 20px", background: "linear-gradient(135deg,#17124d,#3224a6)", color: "#fff" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.6, opacity: .72 }}>PLATFORM OWNER · CONTROL PLANE</div>
            <h1 style={{ margin: "5px 0", fontSize: "clamp(28px,4vw,40px)" }}>Tenant Directory</h1>
            <div style={{ opacity: .75 }}>Bounded, searchable institute operations for the multi-tenant platform.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setCreateOpen(true)} style={{ ...button(true), background: "#fff", color: "#3224a6" }}>＋ Create institute</button>
            <span style={{ fontSize: 12, opacity: .8 }}>{roles.join(" · ")}</span>
            <button onClick={() => void signOut()} style={{ ...button(false), background: "rgba(255,255,255,.14)", color: "#fff" }}>Sign out</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "22px clamp(16px,4vw,42px) 60px" }}>
        {error && <div role="alert" style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "#fff1f2", color: "#b42318", border: "1px solid #fecdd3" }}>{error}</div>}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {[
            ["Total", counts.total],
            ["Active", counts.active],
            ["Trial", counts.trial],
            ["Suspended", counts.suspended],
            ["Archived", counts.archived],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 900 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 5 }}>{Number(value) || 0}</div>
            </div>
          ))}
        </section>

        <section style={{ marginTop: 16, background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ padding: 18, borderBottom: "1px solid #eef1f6", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setQuery(search.trim()); setCursor(null); } }}
              placeholder="Search institute name or slug…"
              style={{ flex: "1 1 280px", minWidth: 220, padding: 11, borderRadius: 10, border: "1px solid #d8dee9" }}
              aria-label="Search institutes"
            />
            <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setCursor(null); }} style={{ padding: 11, borderRadius: 10, border: "1px solid #d8dee9" }}>
              <option value="all">All statuses</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
            <button style={button(false)} onClick={() => { setQuery(search.trim()); setCursor(null); }}>Apply</button>
            <button style={button(true)} disabled={directoryLoading} onClick={() => void loadDirectory(cursor)}>
              {directoryLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {directoryLoading && <div style={{ padding: 12, fontSize: 12, color: "#64748b" }}>Loading bounded results…</div>}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f8fafc" }}>
                  {["Institute", "Slug", "Status", "Created", "Details"].map((heading) => <th key={heading} style={{ padding: 12, fontSize: 11, color: "#64748b" }}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {institutes.map((institute) => (
                  <tr key={institute.id} style={{ borderTop: "1px solid #eef1f6" }}>
                    <td style={{ padding: 13, fontWeight: 900 }}>{institute.name}</td>
                    <td style={{ padding: 13, fontSize: 12, color: "#64748b" }}>{institute.slug}</td>
                    <td style={{ padding: 13 }}><span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>{institute.status}</span></td>
                    <td style={{ padding: 13, fontSize: 12, color: "#64748b" }}>{new Date(institute.created_at).toLocaleString()}</td>
                    <td style={{ padding: 13 }}><button style={button(false)} onClick={() => void openDetail(institute)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!institutes.length && <div style={{ padding: 28, color: "#64748b" }}>No institutes match the current search.</div>}

          <div style={{ padding: 14, borderTop: "1px solid #eef1f6", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Showing up to 50 tenants per page · server-side search/filtering</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={button(false)} disabled={!cursor || directoryLoading} onClick={() => void loadDirectory(null)}>First page</button>
              <button style={button(true)} disabled={!hasMore || directoryLoading || !nextCursor} onClick={() => void loadDirectory(nextCursor)}>Next page</button>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 16, padding: 18, background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#2563eb", letterSpacing: 1 }}>LAZY OPERATIONS</div>
          <h2 style={{ margin: "4px 0" }}>Advanced platform controls</h2>
          <p style={{ margin: "6px 0 14px", color: "#64748b", fontSize: 13 }}>
            Provisioning, domains, entitlements, administrator invitations, messaging, audit and platform settings are loaded only when you open the full operations surface.
          </p>
          <button style={button(true)} onClick={() => setOperationsOpen(true)}>Open full platform operations</button>
        </section>
      </div>

      {createOpen && (
        <div role="dialog" aria-modal="true" onClick={() => { if (!createWorking) setCreateOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 18, zIndex: 1200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(620px,100%)", background: "#fff", borderRadius: 24, padding: 24, boxShadow: "0 30px 80px rgba(15,23,42,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#4f46e5", letterSpacing: 1.4 }}>INSTITUTE ONBOARDING</div>
                <h2 style={{ margin: "5px 0 2px" }}>Create institute</h2>
                <div style={{ fontSize: 12, color: "#64748b" }}>The platform will create the workspace and its baseline setup automatically.</div>
              </div>
              <button disabled={createWorking} style={button(false)} onClick={() => setCreateOpen(false)}>Close</button>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginTop: 18 }}>
              Institute name
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="ABC Academy" style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #d8dee9", marginTop: 5 }} />
            </label>

            <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginTop: 12 }}>
              Portal slug
              <input value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} placeholder="abc-academy" style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #d8dee9", marginTop: 5 }} />
            </label>

            <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginTop: 12 }}>
              Custom domain <span style={{ fontWeight: 500, color: "#64748b" }}>(optional)</span>
              <input value={createHostname} onChange={(e) => setCreateHostname(e.target.value)} placeholder="academy.com" style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #d8dee9", marginTop: 5 }} />
            </label>

            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e7ebf2", fontSize: 11, color: "#64748b" }}>
              New institutes start in <b>Trial</b>. A custom domain is optional and can be connected after creation.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button disabled={createWorking} style={button(false)} onClick={() => setCreateOpen(false)}>Cancel</button>
              <button disabled={!createName.trim() || !createSlug.trim() || createWorking} style={button(true)} onClick={() => void createInstitute()}>
                {createWorking ? "Creating…" : "Create institute"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div role="dialog" aria-modal="true" onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 18, zIndex: 1100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(760px,100%)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 24, padding: 24, boxShadow: "0 30px 80px rgba(15,23,42,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#4f46e5", letterSpacing: 1.4 }}>TENANT DETAIL · ON DEMAND</div>
                <h2 style={{ margin: "5px 0 2px" }}>{selected.name}</h2>
                <div style={{ fontSize: 12, color: "#64748b" }}>{selected.slug} · {selected.status}</div>
              </div>
              <button style={button(false)} onClick={() => setSelected(null)}>Close</button>
            </div>

            {detailLoading && <div style={{ padding: 28, color: "#64748b" }}>Loading tenant details…</div>}

            {detail && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                  {[
                    ["Members", detail.membership_count],
                    ["Active members", detail.active_membership_count],
                    ["Domains", detail.domains.length],
                    ["Entitlements", detail.entitlements.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e7ebf2" }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{Number(value) || 0}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #e7ebf2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <b>Institute status</b>
                      <div style={{ marginTop: 5, fontSize: 12, color: "#64748b" }}>Change the workspace lifecycle state from the fast control center.</div>
                    </div>
                    <select
                      value={selected.status}
                      disabled={statusWorking}
                      onChange={(e) => void changeInstituteStatus(e.target.value as "trial" | "active" | "suspended" | "archived")}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #d8dee9", fontWeight: 800 }}
                      aria-label="Institute status"
                    >
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  {statusWorking && <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>Saving status…</div>}
                </div>

                <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #e7ebf2" }}>
                  <b>Domains</b>
                  {detail.domains.length ? detail.domains.map((domain) => (
                    <div key={domain.id} style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid #eef1f6", fontSize: 12 }}>
                      <strong>{domain.hostname}</strong> · {domain.status} · TLS {domain.tls_status}{domain.is_primary ? " · primary" : ""}
                    </div>
                  )) : <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>No domains registered.</div>}
                </div>

                <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #e7ebf2" }}>
                  <b>Feature entitlements</b>
                  {detail.entitlements.length ? detail.entitlements.map((item) => (
                    <div key={item.feature_code} style={{ display: "flex", justifyContent: "space-between", marginTop: 9, paddingTop: 9, borderTop: "1px solid #eef1f6", fontSize: 12 }}>
                      <span>{item.feature_code}</span><strong>{item.enabled ? "Enabled" : "Disabled"}</strong>
                    </div>
                  )) : <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>No explicit entitlement overrides.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
