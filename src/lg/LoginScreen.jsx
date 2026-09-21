import React, { useState } from "react";
import { C, ROLES } from "@/lg/data";
import { signIn } from "@/lg/auth";
import { LGLogo, GLOBAL_CSS, Bubbles, Inp, WBtn, EyeBtn, BackBtn } from "@/lg/ui";

export function LoginScreen({ role, onBack, onLogin, onForgotPassword, tenant }) {
  const [loginId, setLoginId] = useState("");
  const [pass, setPass] = useState("");
  const [showP, setShowP] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const rc = ROLES.find((r) => r.key === role) || ROLES[0];
  const roleEmojis = { teacher: "👨‍🏫", student: "🎓", parent: "👨‍👩‍👧" };
  const brandName = tenant?.display_name || tenant?.name || "Learner's Guide";
  const primaryColor = tenant?.primary_color || "#4357e8";

  const handle = async () => {
    if (!loginId || !pass) { setErr("Fill all fields."); return; }
    setLoading(true); setErr("");
    const { user, error } = await signIn(loginId.trim(), pass, role);
    setLoading(false);
    if (user) { onLogin(user); return; }
    setErr(error || "Could not sign in. Please try again.");
  };

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: "'Poppins',sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style><Bubbles />
      <div style={{ position: "absolute", top: 18, left: 18, zIndex: 10 }}><BackBtn onClick={onBack} /></div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "76px 22px 40px" }}>
        <div className="fu" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div className="logo-float" style={{ border: `2px solid ${primaryColor}55`, borderRadius: 18, padding: 4 }}>
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt="" style={{ width: 62, height: 62, objectFit: "contain", display: "block" }} />
            ) : (
              <LGLogo size={70} showText={false} light />
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 1.2 }}>{brandName}</div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 15, background: rc.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 8px 22px ${rc.color}44` }}>{roleEmojis[role] || "🔐"}</div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Welcome back!</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>Login as {rc.label}</div></div>
          </div>
        </div>
        <div className="fu d1" style={{ background: "rgba(0,0,0,.22)", borderRadius: 26, padding: "24px 20px", backdropFilter: "blur(20px)", border: "1.5px solid rgba(255,255,255,.1)" }}>
          <Inp label="Phone / Email" val={loginId} set={setLoginId} ph={role === "student" ? "Roll Number / SID (e.g. LG001)" : role === "teacher" ? "Phone Number (e.g. 9001000001)" : "Parent Phone (e.g. 9001000005)"} icon="📱" />
          <Inp label="Password" type={showP ? "text" : "password"} val={pass} set={setPass} ph="Enter password" icon="🔒" right={<EyeBtn open={showP} onClick={() => setShowP((s) => !s)} />} />
          {err && <div className="fu" role="alert" style={{ background: "rgba(239,68,68,.18)", color: "#fca5a5", padding: "9px 13px", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <button type="button" className="pressable" onClick={onForgotPassword} style={{ fontSize: 12, color: "rgba(255,255,255,.65)", textDecoration: "underline", padding: "3px 6px", border: 0, background: "transparent", borderRadius: 6, cursor: "pointer" }}>Forgot Password?</button>
          </div>
          <WBtn ch={loading ? <><span className="spinning">⟳</span> Signing in…</> : "Login →"} onClick={handle} dis={loading} />
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "rgba(255,255,255,.35)" }}>Login credentials are provided by your institute administrator.</div>
      </div>
    </div>
  );
}
