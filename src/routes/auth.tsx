import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoginScreen } from "@/lg/LoginScreen";
import { resolveInstituteForCurrentHostname, type InstituteTenant } from "@/lg/tenant";

const title = "Sign in — Learner's Guide";
const description = "Sign in with credentials provided by your institute administrator.";

type AuthSearch = { role: "teacher" | "student" | "parent" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    role: ["teacher", "student", "parent"].includes(String(search["role"])) ? (String(search["role"]) as AuthSearch["role"]) : "student",
  }),
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { role } = Route.useSearch();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<InstituteTenant | null>(null);

  useEffect(() => {
    let mounted = true;
    void resolveInstituteForCurrentHostname()
      .then((resolved) => { if (mounted) setTenant(resolved); })
      .catch((error) => console.warn("Unable to resolve institute domain:", error));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = tenant?.display_name ? `Sign in — ${tenant.display_name}` : title;
  }, [tenant?.display_name]);

  const openRecovery = () => {
    const query = new URLSearchParams({ role });
    window.location.assign(`/reset-password?${query.toString()}`);
  };

  return (
    <LoginScreen
      role={role}
      tenant={tenant}
      onBack={() => navigate({ to: "/" })}
      onLogin={() => navigate({ to: "/app" })}
      onForgotPassword={openRecovery}
    />
  );
}
