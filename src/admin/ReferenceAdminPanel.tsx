import { useCallback, useEffect, useState } from "react";
import { gdb } from "@/lg/data";
import { LGLogo } from "@/lg/ui";
import { AppPage } from "./ReferenceAdminRouter";
import { Sidebar, Top } from "./ReferenceAdminLayout";
import { Field, Btn } from "./ReferenceAdminControls";
import { A, META, css, type AdminUser, type PageKey, type Props, type Row } from "./ReferenceAdminShared";
import { signIn } from "@/lg/auth";

export function ReferenceAdminPanel({ user, onLogout }: Props) {
  const [page, setPage] = useState<PageKey>("dashboard"),
    [data, setData] = useState<Record<string, Row[]>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const tablesFor = useCallback(
    (p: PageKey) =>
      p === "dashboard"
        ? ["students", "teachers", "attendance", "fees", "homework", "announcements"]
        : p === "search"
          ? ["students", "teachers"]
          : p === "batches"
            ? ["batches", "timetable", "students", "teachers"]
            : p === "results"
              ? ["marks", "students", "teachers", "examschedule"]
              : p === "marks"
                ? ["marks"]
                : p === "accounts"
                  ? ["users"]
                  : META[p].table
                    ? [META[p].table!]
                    : [],
    [],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ts = tablesFor(page);
      const out: Record<string, Row[]> = {};
      await Promise.all(
        ts.map(async (t) => {
          out[t] = await gdb(t);
        }),
      );
      setData((x) => ({ ...x, ...out }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sync with Supabase");
    } finally {
      setLoading(false);
    }
  }, [page, tablesFor]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="admin">
      <style>{css}</style>
      <div className="shell" style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar page={page} setPage={setPage} onLogout={onLogout} />
        <main
          className="main"
          style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
        >
          <Top meta={META[page]} onRefresh={load} />
          {error && (
            <div
              style={{
                margin: "14px 28px 0",
                background: "#fef2f2",
                color: A.red,
                padding: 12,
                borderRadius: 12,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
          {loading && (
            <div style={{ padding: "8px 28px", color: A.sub, fontSize: 12 }}>
              Syncing with Supabase…
            </div>
          )}
          <AppPage page={page} data={data} reload={load} navigate={setPage} />
        </main>
      </div>
    </div>
  );
}

export function AdminLogin({ onSuccess }: { onSuccess: (u: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email || !password) return setError("Enter your administrator email and password.");
    setBusy(true);
    setError("");
    try {
      const r = await signIn(email, password, "admin");
      if (r.user?.role === "admin") onSuccess(r.user as AdminUser);
      else setError(r.error || "Administrator access was not granted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="admin"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "linear-gradient(160deg,#0d1f4e,#122466,#0a1835)",
      }}
    >
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 78,
              height: 78,
              borderRadius: 22,
              background: "#fff",
              padding: 6,
            }}
          >
            <LGLogo size={66} showText={false} />
          </div>
          <h1 style={{ color: "#fff", margin: "12px 0 4px" }}>Learner's Guide</h1>
          <div style={{ color: "#ffffff99", fontSize: 12 }}>Administrator access</div>
        </div>
        <div className="card" style={{ padding: 26 }}>
          <Field label="ADMIN EMAIL" value={email} onChange={setEmail} type="email" />
          <Field label="PASSWORD" value={password} onChange={setPassword} type="password" />
          <Btn onClick={submit} disabled={busy}>
            {busy ? "Signing in…" : "Sign in as Administrator 👑"}
          </Btn>
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                background: "#fef2f2",
                color: A.red,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

