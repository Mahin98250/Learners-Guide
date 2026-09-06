import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser, signOut, onAuthStateChange } from "@/lg/auth";
import { clearCache } from "@/lg/data";

const AdminLogin = lazy(() =>
  import("@/admin/ReferenceAdminPanel").then((module) => ({ default: module.AdminLogin })),
);
const AdminWithDrive = lazy(() =>
  import("@/admin/AdminWithDrive").then((module) => ({ default: module.AdminWithDrive })),
);

export type AdminRouteUser = { id: string; name: string; phone: string; role: string; ref: string | null };
export const Route = createFileRoute("/admin")({ ssr: false, component: AdminRoute });

function AdminRoute() {
  const [user, setUser] = useState<AdminRouteUser | null>(null);
  const [checking, setChecking] = useState(true);
  const syncLock = useRef(false);
  const lastSync = useRef(0);

  const syncAdmin = useCallback(async (current: AdminRouteUser) => {
    if (syncLock.current) return;
    syncLock.current = true;
    setUser(current);
    setChecking(false);
    lastSync.current = Date.now();
    syncLock.current = false;
  }, []);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const current = (await getCurrentUser()) as AdminRouteUser | null;
      if (!current || current.role !== "admin") {
        clearCache();
        setUser(null);
        setChecking(false);
        return;
      }
      await syncAdmin(current);
    } catch {
      setChecking(false);
    }
  }, [syncAdmin]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || !user) return;
      if (Date.now() - lastSync.current < 30000) return;
      void load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [user, load]);

  if (checking && !user) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Loading admin portal…</div>;
  if (!user) {
    return (
      <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Loading admin sign-in…</div>}>
        <AdminLogin onSuccess={(admin: AdminRouteUser) => { setUser(admin); void syncAdmin(admin); }} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Loading admin portal…</div>}>
      <AdminWithDrive user={user} onLogout={async () => { clearCache(); await signOut(); setUser(null); window.location.assign("/"); }} />
    </Suspense>
  );
}
