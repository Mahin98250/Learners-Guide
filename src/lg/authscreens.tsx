import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { C, ROLES } from "@/lg/data";
import { LGLogo, GLOBAL_CSS, Bubbles, BackBtn } from "@/lg/ui";
import type { InstituteTenant } from "@/lg/tenant";

export type Role = "teacher" | "student" | "parent";

export function RoleSelect({ onNext, tenant }: { onNext: (role: Role) => void; tenant?: InstituteTenant | null }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role | "">("");
  const brandName = tenant?.display_name || tenant?.name || "Learner's Guide";
  const primaryColor = tenant?.primary_color || "#FFFFFF";

  const choose = (role: Role) => {
    setSelected(role);
    onNext(role);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: "#fff",
        fontFamily: "'Poppins',sans-serif",
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <style>{GLOBAL_CSS}</style>
      <Bubbles />
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          position: "relative",
          zIndex: 1,
          padding: "28px 20px 40px",
        }}
      >
        <BackBtn onClick={() => navigate({ to: "/" })} />

        <div style={{ textAlign: "center", padding: "52px 0 30px" }}>
          <div
            style={{
              display: "inline-flex",
              width: 78,
              height: 78,
              borderRadius: 24,
              background: "rgba(255,255,255,.12)",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(255,255,255,.14)",
              boxShadow: "0 18px 45px rgba(0,0,0,.2)",
              overflow: "hidden",
            }}
          >
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt="" style={{ width: 62, height: 62, objectFit: "contain" }} />
            ) : (
              <LGLogo size={62} showText={false} light />
            )}
          </div>
          <h1 style={{ margin: "20px 0 7px", fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}>
            {brandName}
          </h1>
          {tenant?.primary_color && (
            <div style={{ width: 42, height: 4, borderRadius: 999, background: primaryColor, margin: "0 auto 8px" }} />
          )}
          <p style={{ margin: 0, color: "rgba(255,255,255,.62)", fontSize: 14 }}>
            Choose how you want to sign in.
          </p>
        </div>

        <section style={{ display: "grid", gap: 14 }} aria-label="Choose account type">
          {ROLES.map((role) => {
            const active = selected === role.key;
            const emoji = role.key === "teacher" ? "👨‍🏫" : role.key === "student" ? "🎓" : "👨‍👩‍👧";
            return (
              <button
                key={role.key}
                type="button"
                onClick={() => choose(role.key as Role)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 15,
                  textAlign: "left",
                  padding: "18px 18px",
                  borderRadius: 22,
                  border: `1px solid ${active ? role.color : "rgba(255,255,255,.12)"}`,
                  background: active ? "rgba(255,255,255,.13)" : "rgba(0,0,0,.18)",
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: active ? `0 12px 32px ${role.color}33` : "0 10px 30px rgba(0,0,0,.12)",
                  backdropFilter: "blur(18px)",
                  transition: "transform .18s ease, border-color .18s ease, background .18s ease",
                }}
              >
                <span
                  style={{
                    width: 54,
                    height: 54,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 17,
                    background: role.grad,
                    fontSize: 25,
                    boxShadow: `0 8px 22px ${role.color}44`,
                  }}
                >
                  {emoji}
                </span>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: 17 }}>{role.label}</strong>
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                    {role.sub}
                  </span>
                </span>
                <span style={{ fontSize: 22, color: "rgba(255,255,255,.5)" }}>›</span>
              </button>
            );
          })}
        </section>

        <p style={{ textAlign: "center", margin: "24px 0 0", color: "rgba(255,255,255,.35)", fontSize: 11 }}>
          Login credentials are provided by your institute administrator.
        </p>
      </div>
    </main>
  );
}
