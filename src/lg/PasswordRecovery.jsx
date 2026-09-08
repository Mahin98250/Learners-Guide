import React, { useEffect, useMemo, useState } from "react";
import { C } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { GLOBAL_CSS, LGLogo, Bubbles, BackBtn, WBtn, Inp, EyeBtn } from "@/lg/ui";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordChecks = (value) => ({ length: value.length >= 10, upper: /[A-Z]/.test(value), lower: /[a-z]/.test(value), number: /\d/.test(value) });

export function PasswordRecovery({ role = "student", onBack }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mode, setMode] = useState("request");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const strongEnough = checks.length && checks.upper && checks.lower && checks.number;
  const roleLabel = role === "parent" ? "parent" : role === "teacher" ? "teacher" : role === "admin" ? "administrator" : "student";
  const identifierLabel = role === "student" ? "Student ID (SID)" : role === "admin" ? "Administrator email" : "Phone number";
  const identifierPlaceholder = role === "student" ? "e.g. LG001" : role === "admin" ? "admin@institute.com" : "e.g. 9876543210";

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (active && data.session) setMode("update");
    };
    void check();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const request = async () => {
    const clean = identifier.trim();
    setError(""); setMessage("");
    if (!clean) { setError(role === "student" ? "Enter your Student ID." : role === "admin" ? "Enter your administrator email." : "Enter your phone number."); return; }
    if (role === "admin" && !emailPattern.test(clean)) { setError("Enter a valid administrator email address."); return; }
    if (cooldown) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("password-recovery-request", { body: { role, identifier: clean } });
      if (fnError) {
        let detail = "";
        try { const body = await fnError.context?.json?.(); detail = body?.error || ""; } catch { /* ignore */ }
        throw new Error(detail || fnError.message || "Recovery service is temporarily unavailable. Please try again.");
      }
      setMessage(data?.message || "If the details match an active account with a verified recovery email, a reset link has been sent. Check the recovery email inbox and spam folder.");
      setCooldown(45);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start password recovery. Please try again or contact the institute administrator.");
    } finally { setLoading(false); }
  };

  const update = async () => {
    setError(""); setMessage("");
    if (!strongEnough) { setError("Use at least 10 characters with an uppercase letter, lowercase letter, and number."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("This reset link has expired or is no longer valid. Request a new reset link.");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut({ scope: "local" });
      setPassword(""); setConfirm(""); setShowPassword(false); setShowConfirm(false); setMode("request");
      setMessage("Password changed successfully. You have been signed out for security. Return to login and use your new password.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your password. Request a new reset link and try again.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: "'Poppins',sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style><Bubbles />
      <div style={{ position: "absolute", top: 18, left: 18, zIndex: 10 }}><BackBtn onClick={onBack} /></div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "76px 22px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <LGLogo size={70} showText={false} light />
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 900, color: "#fff" }}>PASSWORD RECOVERY</div>
          <div style={{ marginTop: 7, fontSize: 12, color: "rgba(255,255,255,.5)" }}>{mode === "update" ? "Choose a new password" : `Verify your ${roleLabel} account first`}</div>
        </div>
        <div style={{ background: "rgba(0,0,0,.22)", borderRadius: 26, padding: "24px 20px", backdropFilter: "blur(20px)", border: "1.5px solid rgba(255,255,255,.1)" }}>
          {mode === "request" ? <>
            <div style={{ color: "#fff", fontSize: 12, lineHeight: 1.6, marginBottom: 15 }}>Enter the account identifier below. If it matches an active account with a verified recovery email, a reset link will be sent there. The recovery email itself is never shown on this screen.</div>
            <Inp label={identifierLabel} val={identifier} set={setIdentifier} ph={identifierPlaceholder} icon={role === "student" ? "🎓" : role === "admin" ? "🛡️" : "📱"} />
            {message && <div role="status" style={{ background: "rgba(34,197,94,.16)", color: "#86efac", padding: "10px 13px", borderRadius: 10, fontSize: 12, marginBottom: 12 }}>{message}</div>}
            {error && <div role="alert" style={{ background: "rgba(239,68,68,.18)", color: "#fca5a5", padding: "10px 13px", borderRadius: 10, fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <WBtn ch={loading ? "Verifying…" : cooldown ? `Try again in ${cooldown}s` : "Verify & Send Reset Link →"} onClick={request} dis={loading || !!cooldown} />
            <div style={{ marginTop: 13, textAlign: "center", color: "rgba(255,255,255,.45)", fontSize: 10 }}>Reset links are delivered only to the recovery email configured by your institute administrator.</div>
          </> : <>
            <Inp label="New Password" type={showPassword ? "text" : "password"} val={password} set={setPassword} ph="At least 10 characters" icon="🔒" right={<EyeBtn open={showPassword} onClick={() => setShowPassword((value) => !value)} />} />
            <div style={{ display: "grid", gap: 4, margin: "-4px 0 12px", fontSize: 10, color: "rgba(255,255,255,.58)" }}>
              <div style={{ color: checks.length ? "#86efac" : "rgba(255,255,255,.58)" }}>• 10+ characters</div><div style={{ color: checks.upper ? "#86efac" : "rgba(255,255,255,.58)" }}>• One uppercase letter</div><div style={{ color: checks.lower ? "#86efac" : "rgba(255,255,255,.58)" }}>• One lowercase letter</div><div style={{ color: checks.number ? "#86efac" : "rgba(255,255,255,.58)" }}>• One number</div>
            </div>
            <Inp label="Confirm Password" type={showConfirm ? "text" : "password"} val={confirm} set={setConfirm} ph="Enter the password again" icon="🔒" right={<EyeBtn open={showConfirm} onClick={() => setShowConfirm((value) => !value)} />} />
            {error && <div role="alert" style={{ background: "rgba(239,68,68,.18)", color: "#fca5a5", padding: "10px 13px", borderRadius: 10, fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <WBtn ch={loading ? "Updating…" : "Set New Password →"} onClick={update} dis={loading} />
          </>}
        </div>
      </div>
    </div>
  );
}
