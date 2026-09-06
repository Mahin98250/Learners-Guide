import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, signOut, onAuthStateChange } from "@/lg/auth";
import { clearCache } from "@/lg/data";
import { GLOBAL_CSS, LGLogo } from "@/lg/ui";
import { TeacherAppWithHomeworkFiles } from "@/lg/teacherHomeworkApp";
import { StudentApp } from "@/lg/student";
import { ParentApp } from "@/lg/parentWorkflows";
import { LeaveAccess } from "@/lg/LeaveAccess";
import { PushNotificationPrompt } from "@/lg/pushNotifications";
import ChangePassword from "@/lg/ChangePassword";

const title = "My Dashboard — Learner's Guide";
const description = "Your Learner's Guide dashboard: classes, attendance, homework, exams, results and study materials.";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppShell,
});

type SessionUser = { id: string; name: string; phone: string; role: string; ref: string | null };

function Splash({ label, retry }: { label: string; retry?: () => void }) {
  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "linear-gradient(160deg,#1a1060 0%,#2d1b8e 45%,#0e0a3a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 28,
      }}
    >
      <style>{GLOBAL_CSS}</style>
      <div className="logo-float">
        <LGLogo size={72} showText={false} light />
      </div>
      <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 600 }}>{label}</div>
      {retry && (
        <button onClick={retry} style={{ border: 0, borderRadius: 12, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>
          Retry
        </button>
      )}
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portalRefreshKey, setPortalRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const current = (await getCurrentUser()) as SessionUser | null;
      if (!current) {
        clearCache();
        setUser(null);
        setReady(false);
        navigate({ to: "/", replace: true });
        return;
      }
      setUser(current);
      setReady(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load your session");
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const { data } = onAuthStateChange((event: string, nextUser: SessionUser | null) => {
      if (!nextUser) {
        clearCache();
        setUser(null);
        setReady(false);
        navigate({ to: "/", replace: true });
        return;
      }
      if (["SIGNED_IN", "USER_UPDATED"].includes(event)) {
        setUser(nextUser);
        setReady(true);
        setPortalRefreshKey((key) => key + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  // Browsers can restore a frozen/BFCache page with old component state and
  // cached records. Only a genuine BFCache restore gets a fresh portal mount;
  // ordinary tab visibility changes must not trigger repeated Supabase reads.
  useEffect(() => {
    const refreshAfterRestore = () => {
      clearCache();
      setPortalRefreshKey((key) => key + 1);
      void load();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshAfterRestore();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [load]);

  if (loadError) return <Splash label={loadError} retry={() => void load()} />;
  if (!ready || !user) return <Splash label="Loading your dashboard…" />;

  const logout = async () => {
    clearCache();
    await signOut();
    setUser(null);
    navigate({ to: "/", replace: true });
  };

  const portal =
    user.role === "teacher" ? (
      <TeacherAppWithHomeworkFiles key={portalRefreshKey} user={user} onLogout={logout} />
    ) : user.role === "student" ? (
      <StudentApp key={portalRefreshKey} user={user} onLogout={logout} />
    ) : user.role === "parent" ? (
      <ParentApp key={portalRefreshKey} user={user} onLogout={logout} />
    ) : null;

  const portalClass = user.role === "admin" ? "portal-admin" : `portal-${user.role}`;

  return (
    <div className={`lg-app-shell ${portalClass}`} data-portal={user.role}>
      {portal}
      {(user.role === "student" || user.role === "parent") && <LeaveAccess user={user} student={null} />}
      <PushNotificationPrompt user={user} />
      <ChangePassword />
    </div>
  );
}
