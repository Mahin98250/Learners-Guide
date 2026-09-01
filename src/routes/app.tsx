import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { getCurrentUser, signOut, onAuthStateChange } from "@/lg/auth";
import { clearCache } from "@/lg/data";
import { GLOBAL_CSS, LGLogo } from "@/lg/ui";
import { LeaveAccess } from "@/lg/LeaveAccess";
import { PushNotificationPrompt } from "@/lg/pushNotifications";
import ChangePassword from "@/lg/ChangePassword";

const TeacherAppWithHomeworkFiles = lazy(() => import("@/lg/teacherHomeworkApp").then((module) => ({ default: module.TeacherAppWithHomeworkFiles })));
const StudentApp = lazy(() => import("@/lg/student").then((module) => ({ default: module.StudentApp })));
const ParentApp = lazy(() => import("@/lg/parentWorkflows").then((module) => ({ default: module.ParentApp })));

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

function PortalLoading() {
  return <Splash label="Loading your dashboard…" />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useNavigate();
  useEffect(() => {
    // Keep the existing route-level error behavior intact.
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { reset(); }} className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Try again</button>
          <button onClick={() => router({ to: "/" })} className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Go home</button>
        </div>
      </div>
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
  // cached records. Treat a return to the foreground as a fresh portal session:
  // clear the non-authoritative cache, re-check Auth, then remount the portal so
  // every section performs its normal Supabase read again. This is deliberately
  // scoped to lifecycle restoration; ordinary in-app navigation is untouched.
  useEffect(() => {
    const refreshAfterRestore = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      clearCache();
      setPortalRefreshKey((key) => key + 1);
      void load();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshAfterRestore();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", refreshAfterRestore);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", refreshAfterRestore);
    };
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
      <Suspense fallback={<PortalLoading />}>{portal}</Suspense>
      {(user.role === "student" || user.role === "parent") && <LeaveAccess user={user} student={null} />}
      <PushNotificationPrompt user={user} />
      <ChangePassword />
    </div>
  );
}
