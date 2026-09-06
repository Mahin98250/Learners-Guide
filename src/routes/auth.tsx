import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoginScreen } from "@/lg/LoginScreen";

const title = "Sign in — Learner's Guide";
const description = "Sign in to Learner's Guide with credentials provided by your institute administrator.";

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
  const openRecovery = () => {
    const query = new URLSearchParams({ role });
    window.location.assign(`/reset-password?${query.toString()}`);
  };
  return <LoginScreen role={role} onBack={() => navigate({ to: "/" })} onLogin={() => navigate({ to: "/app" })} onForgotPassword={openRecovery} />;
}
