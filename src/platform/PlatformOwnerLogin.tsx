import { useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";

const OWNER_EMAIL = "patelmahin140@gmail.com";

type Props = { onAuthenticated: (roles: string[]) => void };

function redirectTarget() {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${window.location.origin}${normalizedBase}owner`;
}

export default function PlatformOwnerLogin({ onAuthenticated }: Props) {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const verifyOwnerSession = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) return;

      const email = String(sessionData.session.user.email || "").trim().toLowerCase();
      if (email !== OWNER_EMAIL) {
        await supabase.auth.signOut({ scope: "local" });
        setError("This Google account is not the authorized platform owner account.");
        return;
      }

      const { data: roles, error: roleError } = await supabase.rpc("current_platform_roles");
      if (roleError) throw roleError;

      const next = (roles || [])
        .map((row: { role?: string }) => String(row.role || ""))
        .filter(Boolean);

      if (next.length) {
        onAuthenticated(next);
      } else {
        await supabase.auth.signOut({ scope: "local" });
        setError("This account is authenticated, but it has no active platform-owner access.");
      }
    } catch {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setError("Unable to verify platform-owner access.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void verifyOwnerSession();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void verifyOwnerSession();
      if (event === "SIGNED_OUT") setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setBusy(true);
    setError("");

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTarget(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (oauthError) {
      setError("Google sign-in is unavailable. Make sure Google OAuth is enabled for this Supabase project.");
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>
        Checking platform session…
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7fb", fontFamily: "Poppins,system-ui,sans-serif" }}>
      <section style={{ width: "min(460px,100%)", background: "#fff", borderRadius: 24, padding: 30, border: "1px solid #e7ebf2", boxShadow: "0 24px 80px rgba(15,23,42,.12)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: "#4f46e5" }}>LEARNER&apos;S GUIDE</div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Platform Owner</h1>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          Owner access is restricted to the authorized Google account below. Platform membership is verified in the database after Google authentication.
        </p>

        <div style={{ padding: 13, borderRadius: 12, background: "#f8fafc", border: "1px solid #e7ebf2", margin: "16px 0", fontSize: 13 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", letterSpacing: 1 }}>AUTHORIZED OWNER ACCOUNT</div>
          <div style={{ marginTop: 4, fontWeight: 900 }}>{OWNER_EMAIL}</div>
        </div>

        {error && (
          <div role="alert" style={{ margin: "8px 0 12px", padding: 11, borderRadius: 10, background: "#fff1f2", color: "#b42318", fontSize: 12 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void signInWithGoogle()}
          style={{ width: "100%", border: 0, borderRadius: 11, padding: 13, background: "#4f46e5", color: "#fff", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>

        <p style={{ margin: "14px 0 0", color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>
          A Google account alone does not grant owner access. The signed-in account must match the authorized email and have an active platform membership.
        </p>
      </section>
    </main>
  );
}
