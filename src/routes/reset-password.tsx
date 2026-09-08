import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PasswordRecovery } from "@/lg/PasswordRecovery";

const title = "Reset Password — Learner's Guide";

type RecoverySearch = { role: "teacher" | "student" | "parent" | "admin" };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): RecoverySearch => ({
    role: ["teacher", "student", "parent", "admin"].includes(String(search["role"])) ? (String(search["role"]) as RecoverySearch["role"]) : "student",
  }),
  head: () => ({ meta: [{ title }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { role } = Route.useSearch();
  return <PasswordRecovery role={role} onBack={() => navigate({ to: "/" })} />;
}
