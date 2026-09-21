import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/lg/auth";
import { clearCache } from "@/lg/data";
import { DesktopOnlyGate } from "@/admin/DesktopOnlyGate";
import { InstituteWorkspaceGate, InstituteWorkspaceProvider } from "@/lg/tenant-context";
import { getVerifiedAdminAccess } from "@/lg/admin-access";

const AdminLogin = lazy(() =>
  import("@/admin/AdminLogin").then((module) => ({ default: module.AdminLogin })),
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
      const access = await getVerifiedAdminAccess("people.manage");
      if (!access) {
        clearCache();
        setUser(null);
        setChecking(false);
        return;
      }
      await syncAdmin(access.user as AdminRouteUser);
    } catch {
      clearCache();
      setUser(null);
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

  return (
    <DesktopOnlyGate>
      {checking && !user ? (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>
          Loading admin portal…
        </div>
      ) : !user ? (
        <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Loading admin sign-in…</div>}>
          <AdminLogin onSuccess={() => { void load(); }} />
        </Suspense>
      ) : (
        <InstituteWorkspaceProvider>
          <InstituteWorkspaceGate>
            <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Loading admin portal…</div>}>
              <AdminWithDrive user={user} onLogout={async () => { clearCache(); await signOut(); setUser(null); window.location.assign("/"); }} />
            </Suspense>
          </InstituteWorkspaceGate>
        </InstituteWorkspaceProvider>
      )}
    </DesktopOnlyGate>
  );
}
