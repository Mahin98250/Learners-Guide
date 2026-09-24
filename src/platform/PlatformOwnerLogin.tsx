import { useEffect, useState } from "react";
import { supabase } from "@/lg/supabase";

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status?: string;
};

type MfaChallenge = {
  factorId: string;
  challengeId: string;
  factorType: string;
  label: string;
};

type MfaEnrollment = MfaChallenge & {
  qrCode: string;
  secret: string;
};

export default function PlatformOwnerLogin({
  onAuthenticated,
}: {
  onAuthenticated: (roles: string[]) => void;
}) {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const startMfa = async () => {
    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;

    if (aal?.currentLevel === "aal2") {
      const { data: roles, error: roleError } = await supabase.rpc(
        "current_platform_roles",
      );
      if (roleError) throw roleError;
      const next = (roles || [])
        .map((row: { role?: string }) => String(row.role || ""))
        .filter(Boolean);
      if (!next.length) {
        throw new Error("This account does not have active platform owner access.");
      }
      onAuthenticated(next);
      return;
    }

    const listMfaFactors = async () => {
      const { data: nextFactors, error: nextFactorsError } =
        await supabase.auth.mfa.listFactors();
      if (nextFactorsError) throw nextFactorsError;
      return nextFactors;
    };

    let factors = await listMfaFactors();

    const verifiedFactor =
      (factors?.totp || []).find((factor: MfaFactor) => factor.status === "verified") ||
      (factors?.phone || []).find((factor: MfaFactor) => factor.status === "verified");

    if (aal?.nextLevel === "aal2" && verifiedFactor) {
      const { data: nextChallenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id });
      if (challengeError) throw challengeError;

      setEnrollment(null);
      setCode("");
      setChallenge({
        factorId: verifiedFactor.id,
        challengeId: String(nextChallenge?.id || ""),
        factorType: String(verifiedFactor.factor_type || "totp"),
        label:
          String(verifiedFactor.friendly_name || "").trim() ||
          (verifiedFactor.factor_type === "phone"
            ? "your phone"
            : "your authenticator app"),
      });
      return;
    }

    // Supabase can retain an interrupted, unverified factor. Remove every
    // stale "Mahin Owner" enrollment, then re-read factors before enrolling.
    const staleFactors = (factors?.totp || []).filter(
      (factor: MfaFactor) =>
        factor.status !== "verified" &&
        String(factor.friendly_name || "").trim() === "Mahin Owner",
    );

    for (const staleFactor of staleFactors) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: staleFactor.id,
      });
      if (unenrollError) throw unenrollError;
    }

    factors = await listMfaFactors();

    const verifiedAfterCleanup =
      (factors?.totp || []).find((factor: MfaFactor) => factor.status === "verified") ||
      (factors?.phone || []).find((factor: MfaFactor) => factor.status === "verified");

    if (aal?.nextLevel === "aal2" && verifiedAfterCleanup) {
      const { data: nextChallenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: verifiedAfterCleanup.id });
      if (challengeError) throw challengeError;

      setEnrollment(null);
      setCode("");
      setChallenge({
        factorId: verifiedAfterCleanup.id,
        challengeId: String(nextChallenge?.id || ""),
        factorType: String(verifiedAfterCleanup.factor_type || "totp"),
        label:
          String(verifiedAfterCleanup.friendly_name || "").trim() ||
          (verifiedAfterCleanup.factor_type === "phone"
            ? "your phone"
            : "your authenticator app"),
      });
      return;
    }

    let enrolled;
    let enrollError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Mahin Owner",
      });
      enrolled = result.data;
      enrollError = result.error;
      if (!enrollError) break;

      // A concurrent/interrupted enrollment may have appeared between the
      // cleanup read and enroll. Reconcile once instead of creating another
      // factor or surfacing the misleading duplicate-name error immediately.
      factors = await listMfaFactors();
      const existingVerified =
        (factors?.totp || []).find((factor: MfaFactor) => factor.status === "verified") ||
        (factors?.phone || []).find((factor: MfaFactor) => factor.status === "verified");
      if (existingVerified && aal?.nextLevel === "aal2") {
        const { data: nextChallenge, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId: existingVerified.id });
        if (challengeError) throw challengeError;

        setEnrollment(null);
        setCode("");
        setChallenge({
          factorId: existingVerified.id,
          challengeId: String(nextChallenge?.id || ""),
          factorType: String(existingVerified.factor_type || "totp"),
          label:
            String(existingVerified.friendly_name || "").trim() ||
            (existingVerified.factor_type === "phone"
              ? "your phone"
              : "your authenticator app"),
        });
        return;
      }

      const duplicateStaleFactors = (factors?.totp || []).filter(
        (factor: MfaFactor) =>
          factor.status !== "verified" &&
          String(factor.friendly_name || "").trim() === "Mahin Owner",
      );
      for (const staleFactor of duplicateStaleFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: staleFactor.id,
        });
        if (unenrollError) throw unenrollError;
      }
      if (attempt === 1) break;
    }
    if (enrollError || !enrolled) {
      throw enrollError || new Error("Unable to start Owner MFA enrollment.");
    }

    const { data: nextChallenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enrolled.id });
    if (challengeError) throw challengeError;

    setChallenge(null);
    setCode("");
    setEnrollment({
      factorId: enrolled.id,
      challengeId: String(nextChallenge?.id || ""),
      factorType: "totp",
      label: "your authenticator app",
      qrCode: String(enrolled.totp?.qr_code || ""),
      secret: String(enrolled.totp?.secret || ""),
    });
  };

  const verifyCurrentSession = async () => {
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = data.session;
      if (!session?.user) return;

      const { data: roles, error: roleError } = await supabase.rpc(
        "current_platform_roles",
      );
      if (roleError) throw roleError;

      const next = (roles || [])
        .map((row: { role?: string }) => String(row.role || ""))
        .filter(Boolean);

      if (!next.length) {
        await supabase.auth.signOut({ scope: "local" });
        setError("This Google account is not authorized for the platform owner panel.");
        return;
      }

      setError("");
      await startMfa();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to verify the owner session.",
      );
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
        setChallenge(null);
        setEnrollment(null);
        setCode("");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const continueWithGoogle = async () => {
    const normalizedEmail = ownerEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid owner email address.");
      return;
    }

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
            login_hint: normalizedEmail,
          },
        },
      });
      if (authError) throw authError;
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error ? e.message : "Unable to start Google sign-in.",
      );
    }
  };

  const verifyCode = async () => {
    const active = challenge || enrollment;
    if (!active) return;

    const normalized = code.replace(/\D/g, "").slice(0, 6);
    if (normalized.length !== 6) {
      setError("Enter the 6-digit MFA code.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: active.factorId,
        challengeId: active.challengeId,
        code: normalized,
      });
      if (verifyError) throw verifyError;

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.currentLevel !== "aal2") {
        throw new Error("MFA verification did not promote this session to AAL2.");
      }

      const { data: roles, error: roleError } = await supabase.rpc(
        "current_platform_roles",
      );
      if (roleError) throw roleError;
      const next = (roles || [])
        .map((row: { role?: string }) => String(row.role || ""))
        .filter(Boolean);
      if (!next.length) {
        throw new Error("This account does not have active platform owner access.");
      }

      setChallenge(null);
      setEnrollment(null);
      setCode("");
      onAuthenticated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "MFA verification failed.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <main
        className="owner-login-glass"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Poppins,sans-serif",
        }}
      >
        Checking owner security…
      </main>
    );
  }

  if (challenge || enrollment) {
    return (
      <main
        className="owner-login-glass"
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
            width: "min(520px,100%)",
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
            MAHIN · OWNER SECURITY
          </div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 28 }}>
            {enrollment ? "Set up MFA" : "Verify MFA"}
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
            {enrollment
              ? "Protect the Owner Panel with an authenticator app. Scan the QR code, then enter the 6-digit code it generates."
              : `Enter the 6-digit code from ${challenge?.label || "your MFA factor"} to unlock the Owner Panel.`}
          </p>

          {enrollment && (
            <div style={{ marginTop: 18 }}>
              {enrollment.qrCode && (
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    padding: 16,
                    border: "1px solid #e7ebf2",
                    borderRadius: 16,
                    background: "#f8fafc",
                  }}
                >
                  <img
                    src={enrollment.qrCode.startsWith("data:") ? enrollment.qrCode : `data:image/svg+xml,${encodeURIComponent(enrollment.qrCode)}`}
                    alt="Owner MFA QR code"
                    width={220}
                    height={220}
                  />
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
                Can&apos;t scan it? Enter this setup key manually:
              </div>
              <code
                style={{
                  display: "block",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #e7ebf2",
                  wordBreak: "break-all",
                  fontSize: 12,
                }}
              >
                {enrollment.secret}
              </code>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                margin: "14px 0",
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

          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            aria-label="MFA code"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 13,
              marginTop: 6,
              borderRadius: 11,
              border: "1px solid #d8dee9",
              fontSize: 20,
              letterSpacing: 5,
              textAlign: "center",
            }}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => void verifyCode()}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 11,
              padding: 13,
              marginTop: 12,
              background: "#4f46e5",
              color: "#fff",
              fontWeight: 900,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy
              ? "Verifying…"
              : enrollment
                ? "Verify and enable MFA"
                : "Verify and continue"}
          </button>

          <button
            type="button"
            onClick={() => void supabase.auth.signOut({ scope: "local" })}
            style={{
              width: "100%",
              border: 0,
              background: "transparent",
              color: "#64748b",
              padding: 12,
              marginTop: 4,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancel and sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className="owner-login-glass"
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
          MAHIN
        </div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>
          Platform Owner
        </h1>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          Owner access is restricted to the authorized Google account, platform
          owner membership, and MFA verification.
        </p>

        <label
          htmlFor="owner-email"
          style={{
            display: "block",
            marginTop: 16,
            fontSize: 11,
            fontWeight: 900,
            color: "#475569",
            letterSpacing: 0.6,
          }}
        >
          OWNER EMAIL
          <input
            id="owner-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void continueWithGoogle();
            }}
            placeholder="Enter your Google account email"
            aria-label="Owner email"
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: 7,
              padding: 12,
              borderRadius: 11,
              border: "1px solid #d8dee9",
              background: "#fff",
              color: "#14213d",
              fontWeight: 700,
              outline: "none",
            }}
          />
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
          disabled={busy || !ownerEmail.trim()}
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
