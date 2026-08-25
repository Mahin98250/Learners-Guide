import { useState } from "react";
import { supabase } from "@/lg/supabase";

const PASSWORD_MIN = 8;

export default function ChangePassword({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const close = () => {
    if (busy) return;
    setOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!currentPassword) return setError("Enter your current password.");
    if (newPassword.length < PASSWORD_MIN) return setError(`New password must be at least ${PASSWORD_MIN} characters.`);
    if (newPassword !== confirmPassword) return setError("New password and confirmation do not match.");
    if (newPassword === currentPassword) return setError("New password must be different from your current password.");

    setBusy(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) throw new Error("Your active login session could not be verified. Please sign in again.");
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: userData.user.email, password: currentPassword });
      if (verifyError) throw new Error("Current password is incorrect.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message || "Unable to change your password.");
      setSuccess("Password changed successfully. Your current session remains active.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change your password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); setSuccess(""); }}
        aria-label="Change password"
        title="Change password"
        style={compact ? {
          border: "1px solid rgba(255,255,255,.2)",
          background: "rgba(255,255,255,.06)",
          color: "#fff",
          borderRadius: 12,
          padding: "9px 12px",
          fontWeight: 700,
          cursor: "pointer",
          width: "100%",
          marginBottom: 8,
        } : {
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          right: "calc(env(safe-area-inset-right, 0px) + 12px)",
          zIndex: 90,
          width: 44,
          height: 44,
          minWidth: 44,
          minHeight: 44,
          border: "1px solid rgba(67,87,232,.12)",
          background: "rgba(255,255,255,.96)",
          color: "#25306b",
          borderRadius: 13,
          padding: 0,
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "0 6px 22px rgba(15,27,61,.16)",
          display: "grid",
          placeItems: "center",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>🔑</span>
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="change-password-title" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(8,12,30,.58)", display: "grid", placeItems: "center", padding: "calc(18px + env(safe-area-inset-top, 0px)) 18px calc(18px + env(safe-area-inset-bottom, 0px))" }}>
          <form onSubmit={changePassword} style={{ width: "min(430px, 100%)", maxHeight: "calc(100dvh - 36px)", overflowY: "auto", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 24px 70px rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div id="change-password-title" style={{ fontSize: 20, fontWeight: 850, color: "#17214d" }}>Change Password</div>
                <div style={{ fontSize: 12, color: "#68708a", marginTop: 4 }}>Use your current password, then choose a new one.</div>
              </div>
              <button type="button" onClick={close} disabled={busy} aria-label="Close" style={{ border: 0, background: "#f3f5fa", borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            {error && <div role="alert" style={{ background: "#fff1f2", color: "#b42318", border: "1px solid #fecdd3", borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 12 }}>{error}</div>}
            {success && <div role="status" style={{ background: "#ecfdf3", color: "#067647", border: "1px solid #abefc6", borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 12 }}>{success}</div>}
            {[['Current password', currentPassword, setCurrentPassword], ['New password', newPassword, setNewPassword], ['Confirm new password', confirmPassword, setConfirmPassword]].map(([label, value, setter]) => (
              <label key={label} style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 750, color: "#4f5874", marginBottom: 6 }}>{label}</span>
                <input type="password" autoComplete={label === "Current password" ? "current-password" : "new-password"} value={value} onChange={(e) => setter(e.target.value)} disabled={busy} style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", border: "1px solid #d8ddea", borderRadius: 11, background: "#f8faff", color: "#17214d" }} />
              </label>
            ))}
            <div style={{ fontSize: 11, color: "#68708a", marginBottom: 16 }}>Minimum 8 characters. The current password is verified by Supabase Auth and is never stored by the app.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={close} disabled={busy} style={{ flex: 1, border: "1px solid #d8ddea", background: "#fff", borderRadius: 11, padding: 11, fontWeight: 750, cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={busy} style={{ flex: 1, border: 0, background: "#4357e8", color: "#fff", borderRadius: 11, padding: 11, fontWeight: 800, cursor: "pointer" }}>{busy ? "Changing…" : "Change Password"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
