import { useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";

const OWNER_EMAIL = "patelmahin140@gmail.com";

export default function PlatformOwnerLogin({
  onAuthenticated,
}: {
  onAuthenticated: (roles: string[]) => void;
}) {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const verifyCurrentSession = async () => {
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = data.session;
      if (!session?.user) return;

      const email = String(session.user.email || "").trim().toLowerCase();
      if (email !== OWNER_EMAIL) {
        await supabase.auth.signOut({ scope: "local" });
        setError(`Only the authorized owner account (${OWNER_EMAIL}) can access this panel.`);
        return;
      }

      const { data: roles, error: roleError } = await supabase.rpc(
        "current_platform_roles",
      );
      if (roleError) throw roleError;

      const next = (roles || [])
        .map((row: { role?: string }) => String(row.role || ""))
        .filter(Boolean);

      if (next.length) {
        onAuthenticated(next);
        return;
      }

      await supabase.auth.signOut({ scope: "local" });
      setError("This Google account is not authorized for the platform owner panel.");
    } catch (e) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setError(e instanceof Error ? e.message : "Unable to verify the owner session.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void verifyCurrentSession();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setChecking(false);
        setBusy(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const continueWithGoogle = async () => {
    setBusy(true);
    setError("");

    const redirectTo = new URL(
      `${import.meta.env.BASE_URL}owner`,
      window.location.origin,
    ).toString();

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (authError) throw authError;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Unable to start Google sign-in.");
    }
  };

  if (checking) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Poppins,sans-serif",
        }}
      >
        Checking owner session…
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f5f7fb",
        fontFamily: "Poppins,system-ui,sans-serif",
      }}
    >
      <section
        style={{
          width: "min(460px,100%)",
          background: "#fff",
          borderRadius: 24,
          padding: 30,
          border: "1px solid #e7ebf2",
          boxShadow: "0 24px 80px rgba(15,23,42,.12)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.5,
            color: "#4f46e5",
          }}
        >
          LEARNER&apos;S GUIDE
        </div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Platform Owner</h1>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          Owner access is restricted to the authorized Google account and verified
          platform membership.
        </p>

        <label
          style={{
            display: "block",
            marginTop: 16,
            fontSize: 11,
            fontWeight: 900,
            color: "#475569",
            letterSpacing: 0.6,
          }}
        >
          AUTHORIZED GOOGLE ACCOUNT
          <div
            style={{
              marginTop: 7,
              padding: 12,
              borderRadius: 11,
              border: "1px solid #d8dee9",
              background: "#f8fafc",
              color: "#14213d",
              fontWeight: 800,
            }}
          >
            {OWNER_EMAIL}
          </div>
        </label>

        {error && (
          <div
            role="alert"
            style={{
              margin: "12px 0",
              padding: 11,
              borderRadius: 10,
              background: "#fff1f2",
              color: "#b42318",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void continueWithGoogle()}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 11,
            padding: 13,
            marginTop: 14,
            background: "#4f46e5",
            color: "#fff",
            fontWeight: 900,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>

        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            color: "#94a3b8",
            fontSize: 11,
          }}
        >
          No password login is exposed on the Owner panel.
        </div>
      </section>
    </main>
  );
}
