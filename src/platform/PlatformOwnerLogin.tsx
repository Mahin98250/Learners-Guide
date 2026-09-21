import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";

export default function PlatformOwnerLogin({ onAuthenticated }: { onAuthenticated: (roles: string[]) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  const verify = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: roles, error } = await supabase.rpc("current_platform_roles");
      if (error) throw error;
      const next = (roles || []).map((row: { role?: string }) => String(row.role || "")).filter(Boolean);
      if (next.length) onAuthenticated(next);
      else await supabase.auth.signOut({ scope: "local" });
    } catch {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void verify();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !data.user) throw new Error("Invalid email or password.");
      const { data: roles, error: roleError } = await supabase.rpc("current_platform_roles");
      if (roleError) throw roleError;
      const next = (roles || []).map((row: { role?: string }) => String(row.role || "")).filter(Boolean);
      if (!next.length) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("This account does not have active platform access.");
      }
      onAuthenticated(next);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Checking platform session…</main>;

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7fb", fontFamily: "Poppins,system-ui,sans-serif" }}>
    <section style={{ width: "min(460px,100%)", background: "#fff", borderRadius: 24, padding: 30, border: "1px solid #e7ebf2", boxShadow: "0 24px 80px rgba(15,23,42,.12)" }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: "#4f46e5" }}>LEARNER&apos;S GUIDE</div>
      <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Platform Owner</h1>
      <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>Sign in with the authorized platform operator account. Platform membership is verified in the database.</p>
      <form onSubmit={submit}>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="Owner email" style={{ width: "100%", boxSizing: "border-box", padding: 12, margin: "8px 0", borderRadius: 11, border: "1px solid #d8dee9" }} />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Password" style={{ width: "100%", boxSizing: "border-box", padding: 12, margin: "8px 0", borderRadius: 11, border: "1px solid #d8dee9" }} />
        {error && <div role="alert" style={{ margin: "8px 0", padding: 11, borderRadius: 10, background: "#fff1f2", color: "#b42318", fontSize: 12 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", border: 0, borderRadius: 11, padding: 13, marginTop: 8, background: "#4f46e5", color: "#fff", fontWeight: 900 }}>{busy ? "Signing in…" : "Sign in securely"}</button>
      </form>
    </section>
  </main>;
}
