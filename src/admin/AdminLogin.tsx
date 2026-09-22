import { useState } from "react";
import { LGLogo } from "@/lg/ui/branding";
import { GLOBAL_CSS } from "@/lg/ui/styles";
import { signIn } from "@/lg/auth";
import { C } from "@/lg/data/constants";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 750, color: C.sub, marginBottom: 6 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", border: "1.5px solid " + C.border, borderRadius: 11, background: C.light, color: C.text, outline: "none" }}
      />
    </label>
  );
}

export function AdminLogin({ onSuccess }: { onSuccess: (user: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError("Enter your administrator email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await signIn(email, password, "admin");
      if (result.user?.role === "admin") onSuccess(result.user as AdminUser);
      else setError(result.error || "Administrator access was not granted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "linear-gradient(160deg,#0d1f4e,#122466,#0a1835)", fontFamily: "'Poppins',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-grid", placeItems: "center", width: 78, height: 78, borderRadius: 22, background: "#fff", padding: 6 }}>
            <LGLogo size={66} showText={false} />
          </div>
          <h1 style={{ color: "#fff", margin: "12px 0 4px" }}>Mahin</h1>
          <div style={{ color: "#ffffff99", fontSize: 12 }}>Administrator access</div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} style={{ background: "#fff", borderRadius: 20, padding: 26, boxShadow: "0 4px 20px rgba(15,27,61,.07)" }}>
          <Field label="ADMIN EMAIL" value={email} onChange={setEmail} type="email" />
          <Field label="PASSWORD" value={password} onChange={setPassword} type="password" />
          <button type="submit" disabled={busy} style={{ width: "100%", border: 0, borderRadius: 12, padding: "12px 16px", background: C.accent, color: "#fff", fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Signing in…" : "Sign in as Administrator 👑"}
          </button>
          {error && <div role="alert" style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fef2f2", color: C.red, fontSize: 12 }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
