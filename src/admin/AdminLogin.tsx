import { useState } from "react";
import { LGLogo } from "@/lg/ui";
import { signIn } from "@/lg/auth";
import { A, css, type AdminUser } from "./ReferenceAdminShared";
import { Btn, Field } from "./ReferenceAdminControls";

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
          <Btn onClick={() => void submit()} disabled={busy}>
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
