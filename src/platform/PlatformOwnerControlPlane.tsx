import { useEffect, useRef, useState } from "react";
import PlatformOwnerLogin from "@/platform/PlatformOwnerLogin";
import {
  getPlatformInstituteOverview,
  getPlatformInstituteStatusCounts,
  invalidatePlatformInstituteStatusCounts,
  listPlatformInstitutes,
  type PlatformInstitute,
  type PlatformInstituteCursor,
  type PlatformInstituteOverview,
} from "@/platform/platform-tenant-data";
import { supabase } from "@/lg/supabase";

type PlatformSettings = { product_name: string; legal_name: string; public_website_url: string; default_app_domain: string; support_email: string; default_timezone: string; settings: Record<string, unknown> };
import "./owner-liquid-glass.css";

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

const OWNER_NAV = [
  { group: "Overview", items: [
    { key: "dashboard", icon: "⌂", label: "Dashboard" },
    { key: "institutes", icon: "🏫", label: "Institutes" },
  ]},
  { group: "Platform", items: [
    { key: "analytics", icon: "↗", label: "Analytics" },
    { key: "storage", icon: "▣", label: "Storage" },
    { key: "domains", icon: "◎", label: "Domains" },
  ]},
  { group: "Management", items: [
    { key: "activity", icon: "☷", label: "Activity & Audit" },
    { key: "health", icon: "♥", label: "System Health" },
  ]},
  { group: "Configuration", items: [
    { key: "settings", icon: "⚙", label: "Platform Settings" },
    { key: "security", icon: "🔐", label: "Security" },
  ]},
] as const;

function formatBytes(bytes: number | null) {
  if (bytes == null) return "Not configured";
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = -1;
  do { value /= 1024; index += 1; } while (value >= 1024 && index < units.length - 1);
  return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) + " " + units[index];
}

function errorIsUnauthorized(error: unknown) {
  return Number((error as { status?: number } | null)?.status) === 401 ||
    /jwt|unauthorized/i.test(String((error as { message?: string } | null)?.message || ""));
}

function formatPercent(value: number) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "0%";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function statusTone(status: string) {
  if (status === "active") return { background: "#ecfdf3", color: "#067647" };
  if (status === "trial") return { background: "#eff8ff", color: "#175cd3" };
  if (status === "suspended") return { background: "#fffaeb", color: "#b54708" };
  if (status === "archived") return { background: "#f2f4f7", color: "#475467" };
  return { background: "#fef3f2", color: "#b42318" };
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
  const [overview, setOverview] = useState<PlatformInstituteOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createHostname, setCreateHostname] = useState("");
  const [createWorking, setCreateWorking] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsWorking, setSettingsWorking] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const directoryRequestRef = useRef(0);

  const loadDirectory = async (next: PlatformInstituteCursor | null = null) => {
    const requestId = directoryRequestRef.current + 1;
    directoryRequestRef.current = requestId;
    setDirectoryLoading(true);
    setError("");
    try {
      const page = await listPlatformInstitutes({
        limit: 50,
        cursor: next,
        search: query,
        status,
      });

      // A slower response for an older search/filter must never overwrite newer results.
      if (requestId !== directoryRequestRef.current) return;

      setInstitutes(page.items);
      setHasMore(page.has_more);
      setNextCursor(page.next_cursor);
      setCursor(next);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      if (requestId !== directoryRequestRef.current) return;
      if (errorIsUnauthorized(e)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setAuthenticated(false);
        setAllowed(false);
        return;
      }
      setError(e instanceof Error ? e.message : "Unable to load the institute directory.");
    } finally {
      if (requestId === directoryRequestRef.current) {
        setDirectoryLoading(false);
        setLoading(false);
      }
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
    const timer = window.setTimeout(() => {
      setCursor(null);
      void loadDirectory(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, status, authenticated]);

  useEffect(() => {
    if (authenticated !== true) return;
    void getPlatformInstituteStatusCounts().then(setCounts).catch((e) => {
      setError(e instanceof Error ? e.message : "Unable to load institute status counts.");
    });
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
        if (rpcError) throw rpcError;
        setPlatformSettings((data || null) as PlatformSettings | null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load platform settings.");
      }
    })();
  }, [authenticated]);

  const openOverview = async (institute: PlatformInstitute) => {
    setSelected(institute);
    setOverview(null);
    setOverviewLoading(true);
    setError("");
    try {
      setOverview(await getPlatformInstituteOverview(institute.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load institute overview.");
    } finally {
      setOverviewLoading(false);
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
      invalidatePlatformInstituteStatusCounts();
      void getPlatformInstituteStatusCounts().then(setCounts).catch(() => {});
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

  const savePlatformSettings = async () => {
    if (!platformSettings || settingsWorking) return;
    setSettingsWorking(true); setError("");
    try {
      const domain = platformSettings.default_app_domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      const enabled = platformSettings.settings.default_subdomains_enabled === true;
      if (enabled && !domain) throw new Error("A platform default app domain is required before automatic subdomains can be enabled.");
      const result = await supabase.rpc("platform_update_settings", {
        p_product_name: platformSettings.product_name.trim(),
        p_legal_name: platformSettings.legal_name.trim(),
        p_public_website_url: platformSettings.public_website_url.trim(),
        p_default_app_domain: domain || null,
        p_support_email: platformSettings.support_email.trim().toLowerCase(),
        p_default_timezone: platformSettings.default_timezone.trim() || "Asia/Kolkata",
        p_settings: platformSettings.settings,
      });
      if (result.error) throw result.error;
      setPlatformSettings(result.data as PlatformSettings);
      setSettingsOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save platform settings."); }
    finally { setSettingsWorking(false); }
  };

  const refreshCommandCenter = async () => {
    setError("");
    await Promise.allSettled([
      loadDirectory(null),
      getPlatformInstituteStatusCounts().then(setCounts),
    ]);
    setLastRefreshedAt(new Date().toISOString());
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

  if (loading) {
    return <main className="owner-liquid-glass owner-state-card" style={{ ...shell, display: "grid", placeItems: "center" }}>Loading tenant directory…</main>;
  }

  const selectSection = (key: string) => {
    setActiveSection(key);
    setSidebarOpen(false);
    if (key === "settings") setSettingsOpen(true);
  };

  const activeNav = OWNER_NAV.flatMap((group) => group.items).find((item) => item.key === activeSection);

  return (
    <main className="owner-liquid-glass" style={shell}>
      <button type="button" className="owner-sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "Close owner navigation" : "Open owner navigation"} aria-expanded={sidebarOpen}>{sidebarOpen ? "×" : "☰"}</button>
      <div className={`owner-sidebar-backdrop ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`owner-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="owner-sidebar-brand"><div className="owner-sidebar-logo">LG</div><div><strong>Platform Owner</strong><span>Control Center</span></div></div>
        <nav className="owner-sidebar-nav" aria-label="Owner navigation">
          {OWNER_NAV.map((group) => <div className="owner-sidebar-group" key={group.group}><div className="owner-sidebar-label">{group.group}</div>{group.items.map((item) => <button type="button" key={item.key} className={`owner-sidebar-item ${activeSection === item.key ? "active" : ""}`} onClick={() => selectSection(item.key)}><span className="owner-sidebar-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}</div>)}
        </nav>
        <div className="owner-sidebar-footer"><div className="owner-sidebar-status"><span className="owner-online-dot" /> Platform secured</div><button type="button" className="owner-sidebar-signout" onClick={() => void signOut()}>↪ <span>Sign out</span></button></div>
      </aside>
      <div className="owner-main-shell">
      <header className="owner-header" style={{ padding: "25px clamp(16px,4vw,42px) 20px", background: "linear-gradient(135deg,#17124d,#3224a6)", color: "#fff" }}>
        <div className="owner-header-inner" style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.6, opacity: .72 }}>PLATFORM OWNER · CONTROL PLANE</div>
            <h1 style={{ margin: "5px 0", fontSize: "clamp(28px,4vw,40px)" }}>Institute Overview</h1>
            <div style={{ opacity: .75 }}>Monitor institute health without changing institute-managed data.</div>
          </div>
          <div className="owner-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setSettingsOpen(true)} style={{ ...button(false), background: "rgba(255,255,255,.14)", color: "#fff" }}>Platform settings</button>
            <button onClick={() => setCreateOpen(true)} style={{ ...button(true), background: "#fff", color: "#3224a6" }}>＋ Create institute</button>
            <span style={{ fontSize: 12, opacity: .8 }}>{roles.join(" · ")}</span>
            <button onClick={() => void signOut()} style={{ ...button(false), background: "rgba(255,255,255,.14)", color: "#fff" }}>Sign out</button>
          </div>
        </div>
      </header>

      {activeSection === "dashboard" || activeSection === "institutes" ? <div className="owner-dashboard" style={{ maxWidth: 1280, margin: "0 auto", padding: "22px clamp(16px,4vw,42px) 60px" }}>
        {error && <div role="alert" style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "#fff1f2", color: "#b42318", border: "1px solid #fecdd3" }}>{error}</div>}

        <section className="owner-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
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

        <section className="owner-pulse-grid" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(280px,1fr)", gap: 12 }}>
          <div className="owner-pulse-card" style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#4f46e5", letterSpacing: 1.2 }}>PLATFORM PULSE</div>
                <h2 style={{ margin: "5px 0 2px", fontSize: 20 }}>Command center</h2>
                <div style={{ fontSize: 12, color: "#64748b" }}>A quick operational view built from platform-level aggregates.</div>
              </div>
              <button style={button(false)} onClick={() => void refreshCommandCenter()} disabled={directoryLoading}>↻ Refresh all</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 15 }}>
              <div style={{ padding: 13, borderRadius: 14, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>ACTIVE SHARE</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{formatPercent((Number(counts.total) || 0) ? ((Number(counts.active) || 0) / (Number(counts.total) || 1)) * 100 : 0)}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>of all institutes</div>
              </div>
              <div style={{ padding: 13, borderRadius: 14, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>TRIAL SHARE</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{formatPercent((Number(counts.total) || 0) ? ((Number(counts.trial) || 0) / (Number(counts.total) || 1)) * 100 : 0)}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>currently in trial</div>
              </div>
              <div style={{ padding: 13, borderRadius: 14, background: "#f8fafc" }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>ATTENTION QUEUE</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{(Number(counts.suspended) || 0) + (Number(counts.archived) || 0)}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>suspended + archived</div>
              </div>
            </div>
          </div>
          <div className="owner-filter-card" style={{ background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: 1 }}>QUICK FILTERS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {(["all", "active", "trial", "suspended", "archived"] as const).map((nextStatus) => (
                <button key={nextStatus} onClick={() => { setStatus(nextStatus); setCursor(null); }} style={{ ...button(status !== nextStatus), textTransform: "capitalize", padding: "9px 12px" }}>
                  {nextStatus}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #eef1f6", fontSize: 11, color: "#64748b" }}>
              Last refreshed: <b style={{ color: "#24324a" }}>{formatDateTime(lastRefreshedAt)}</b>
            </div>
          </div>
        </section>

        <section className="owner-directory" style={{ marginTop: 16, background: "#fff", border: "1px solid #e7ebf2", borderRadius: 20, overflow: "hidden" }}>
          <div className="owner-directory-toolbar" style={{ padding: 18, borderBottom: "1px solid #eef1f6", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

          <div className="owner-directory-table-wrap" style={{ overflowX: "auto" }}>
            <table className="owner-directory-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f8fafc" }}>
                  {["Institute", "Slug", "Status", "Created", "Overview"].map((heading) => <th key={heading} style={{ padding: 12, fontSize: 11, color: "#64748b" }}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {institutes.map((institute) => (
                  <tr key={institute.id} style={{ borderTop: "1px solid #eef1f6" }}>
                    <td style={{ padding: 13, fontWeight: 900 }}>{institute.name}</td>
                    <td style={{ padding: 13, fontSize: 12, color: "#64748b" }}>{institute.slug}</td>
                    <td style={{ padding: 13 }}><span style={{ ...statusTone(institute.status), display: "inline-flex", padding: "5px 9px", borderRadius: 999, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{institute.status}</span></td>
                    <td style={{ padding: 13, fontSize: 12, color: "#64748b" }}>{new Date(institute.created_at).toLocaleString()}</td>
                    <td style={{ padding: 13 }}><button style={button(false)} onClick={() => void openOverview(institute)}>View health</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!institutes.length && <div style={{ padding: 28, color: "#64748b" }}>No institutes match the current search.</div>}

          <div className="owner-pagination" style={{ padding: 14, borderTop: "1px solid #eef1f6", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Showing up to 50 tenants per page · server-side search/filtering</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={button(false)} disabled={!cursor || directoryLoading} onClick={() => void loadDirectory(null)}>First page</button>
              <button style={button(true)} disabled={!hasMore || directoryLoading || !nextCursor} onClick={() => void loadDirectory(nextCursor)}>Next page</button>
            </div>
          </div>
        </section>


      </div> : null}

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
              New institutes start in <b>Trial</b>. {platformSettings?.settings.default_subdomains_enabled && platformSettings.default_app_domain ? <>Automatic portal: <b>{createSlug.trim().toLowerCase() || "your-slug"}.{platformSettings.default_app_domain}</b>.</> : <>Automatic subdomains are currently disabled; configure them in Platform settings.</>}{" "}A custom domain is optional and can be connected now or later.
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
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px,100%)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 24, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#4f46e5", letterSpacing: 1.4 }}>READ-ONLY INSTITUTE HEALTH</div>
                <h2 style={{ margin: "5px 0 2px" }}>{selected.name}</h2>
                <div style={{ fontSize: 12, color: "#64748b" }}>{selected.slug} · {selected.status} · created {formatDateTime(selected.created_at)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={button(false)} onClick={() => void navigator.clipboard?.writeText(selected.slug)}>Copy slug</button>
                <button style={button(false)} onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
            {overviewLoading && <div style={{ padding: 28, color: "#64748b" }}>Loading institute health…</div>}
            {overview && (
              <div style={{ marginTop: 18 }}>
                <div style={{ padding: 13, borderRadius: 14, background: "#f8fafc", border: "1px solid #e7ebf2", fontSize: 12 }}>
                  <b>Monitoring only.</b> The platform owner can see institute health, but cannot edit students, teachers, admin roles, or institute-managed records here.
                </div>
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
                  {[
                    ["People", overview.people.total_active > 0 ? "Configured" : "No active members"],
                    ["Admin coverage", overview.people.admin_portals > 0 ? "Admin portal present" : "Needs admin portal"],
                    ["Storage", overview.storage.limit_bytes ? "Quota configured" : "Quota not configured"],
                    ["Content", (overview.activity.materials + overview.activity.homework + overview.activity.tests) > 0 ? "Content is present" : "No tracked content yet"],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: 13, borderRadius: 14, border: "1px solid #e7ebf2", background: "#fff" }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>{label}</div>
                      <div style={{ marginTop: 5, fontSize: 14, fontWeight: 900 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, padding: 16, borderRadius: 16, border: "1px solid #e7ebf2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div><b>Content footprint</b><div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>Tracked activity records across the institute.</div></div>
                    <strong>{overview.activity.materials + overview.activity.homework + overview.activity.tests + overview.activity.announcements}</strong>
                  </div>
                  {[
                    ["Study materials", overview.activity.materials],
                    ["Homework", overview.activity.homework],
                    ["Tests", overview.activity.tests],
                    ["Announcements", overview.activity.announcements],
                  ].map(([label, value]) => {
                    const total = overview.activity.materials + overview.activity.homework + overview.activity.tests + overview.activity.announcements;
                    const width = total ? Math.max(3, (Number(value) / total) * 100) : 0;
                    return (
                      <div key={String(label)} style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}><span>{label}</span><b style={{ color: "#24324a" }}>{Number(value)}</b></div>
                        <div style={{ height: 7, marginTop: 5, borderRadius: 999, background: "#edf0f5", overflow: "hidden" }}><div style={{ height: "100%", width: width + "%", background: "#4f46e5", borderRadius: 999 }} /></div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
                  {[
                    ["Students", overview.people.students],
                    ["Teachers", overview.people.teachers],
                    ["Admin portals", overview.people.admin_portals],
                    ["Active members", overview.people.total_active],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ padding: 15, borderRadius: 16, background: "#f8fafc", border: "1px solid #e7ebf2" }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>{label}</div>
                      <div style={{ fontSize: 26, fontWeight: 900, marginTop: 5 }}>{Number(value)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, padding: 16, borderRadius: 16, border: "1px solid #e7ebf2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div><b>Storage</b><div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>Tracked study-material and homework file usage.</div></div>
                    <strong>{formatBytes(overview.storage.used_bytes)} / {formatBytes(overview.storage.limit_bytes)}</strong>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: "#e8ecf5", marginTop: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: overview.storage.limit_bytes ? String(Math.min(100, overview.storage.used_bytes / overview.storage.limit_bytes * 100)) + "%" : "0%", background: "#4f46e5" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 12 }}>
                    <div><div style={{ fontSize: 10, color: "#64748b" }}>Study materials</div><b>{formatBytes(overview.storage.tracked_sources.study_materials_bytes)}</b></div>
                    <div><div style={{ fontSize: 10, color: "#64748b" }}>Homework files</div><b>{formatBytes(overview.storage.tracked_sources.homework_bytes)}</b></div>
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: 16, borderRadius: 16, border: "1px solid #e7ebf2" }}>
                  <b>Institute activity</b>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginTop: 12 }}>
                    {[
                      ["Study materials", overview.activity.materials],
                      ["Homework", overview.activity.homework],
                      ["Tests", overview.activity.tests],
                      ["Announcements", overview.activity.announcements],
                      ["Attendance records", overview.activity.attendance_records],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ padding: 12, borderRadius: 12, background: "#f8fafc" }}>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
                        <b style={{ fontSize: 20 }}>{Number(value)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection !== "dashboard" && activeSection !== "institutes" && activeSection !== "settings" && <section className="owner-section-placeholder"><div className="owner-placeholder-icon">{activeNav?.icon}</div><h2>{activeNav?.label}</h2><p>This platform section is now part of the Owner navigation. Platform-level controls can be added here without exposing institute-managed users or roles.</p></section>}

      {settingsOpen && platformSettings && (
        <div role="dialog" aria-modal="true" onClick={() => { if (!settingsWorking) setSettingsOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 18, zIndex: 1300 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px,100%)", background: "#fff", borderRadius: 24, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}><div><b>PLATFORM CONFIGURATION</b><h2 style={{ margin: "5px 0" }}>Platform settings</h2><div style={{ fontSize: 12, color: "#64748b" }}>Configure the platform namespace used for automatic tenant subdomains.</div></div><button disabled={settingsWorking} style={button(false)} onClick={() => setSettingsOpen(false)}>Close</button></div>
            {(["product_name","legal_name","public_website_url","default_app_domain","support_email","default_timezone"] as const).map((key) => (
              <label key={key} style={{ display: "block", fontSize: 12, fontWeight: 800, marginTop: 12 }}>{key.replaceAll("_"," ")}
                <input value={platformSettings[key] || ""} onChange={(e) => setPlatformSettings({...platformSettings,[key]:e.target.value})} style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 10, border: "1px solid #d8dee9", marginTop: 5 }} />
              </label>
            ))}
            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 15, padding: 12, borderRadius: 12, background: "#f8fafc", fontSize: 12 }}><input type="checkbox" checked={platformSettings.settings.default_subdomains_enabled === true} onChange={(e) => setPlatformSettings({...platformSettings,settings:{...platformSettings.settings,default_subdomains_enabled:e.target.checked}})} /><span><b>Enable automatic institute subdomains</b><br/><span style={{ color: "#64748b" }}>New institutes get slug + default app domain automatically.</span></span></label>
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fffbeb", color: "#92400e", fontSize: 11 }}>Enable this only after wildcard DNS and TLS are configured for the platform domain.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><button disabled={settingsWorking} style={button(false)} onClick={() => setSettingsOpen(false)}>Cancel</button><button disabled={settingsWorking} style={button(true)} onClick={() => void savePlatformSettings()}>{settingsWorking ? "Saving…" : "Save settings"}</button></div>
          </div>
        </div>
      )}

      </div>
    </main>
  );
}
