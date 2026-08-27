import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser, signOut, onAuthStateChange } from "@/lg/auth";
import { clearCache } from "@/lg/data";
import { AdminLogin } from "@/admin/ReferenceAdminPanel";
import { AdminWithDrive } from "@/admin/AdminWithDrive";

export type AdminRouteUser = { id: string; name: string; phone: string; role: string; ref: string | null };
export const Route = createFileRoute("/admin")({ ssr: false, component: AdminRoute });

function AdminRoute() {
  const [user, setUser] = useState<AdminRouteUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncLock = useRef(false);
  const lastSync = useRef(0);

  const syncAdmin = useCallback(async (current: AdminRouteUser) => {
    if (syncLock.current) return;
    syncLock.current = true;
    // The admin pages load the data they need themselves. Do not download every
    // institute table before the dashboard can render.
    setUser(current);
    setChecking(false);
    setSyncing(false);
    lastSync.current = Date.now();
    syncLock.current = false;
  }, []);

  const load = useCallback(async () => {
    setChecking(true);
    const current = (await getCurrentUser()) as AdminRouteUser | null;
    if (!current || current.role !== "admin") {
      clearCache();
      setUser(null);
      setChecking(false);
      return;
    }
    await syncAdmin(current);
  }, [syncAdmin]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const { data } = onAuthStateChange((event: string, nextUser: AdminRouteUser | null) => {
      if (!nextUser || nextUser.role !== "admin") {
        clearCache();
        setUser(null);
        setChecking(false);
        return;
      }
      if (["SIGNED_IN", "USER_UPDATED"].includes(event)) void syncAdmin(nextUser);
    });
    return () => { data.subscription.unsubscribe(); };
  }, [syncAdmin]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      // Avoid re-downloading the entire admin dataset whenever the browser/app
      // regains focus. Individual pages own their refresh behavior.
      if (document.visibilityState !== "visible" || !user) return;
      if (Date.now() - lastSync.current < 30000) return;
      lastSync.current = Date.now();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => { document.removeEventListener("visibilitychange", refreshWhenVisible); window.removeEventListener("focus", refreshWhenVisible); };
  }, [user]);

  if (checking && !user) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Loading admin portal…</div>;
  if (!user) return <AdminLogin onSuccess={(admin) => { setUser(admin as AdminRouteUser); void syncAdmin(admin as AdminRouteUser); }} />;
  return <AdminWithDrive user={user} onLogout={async () => { clearCache(); await signOut(); setUser(null); window.location.assign("/"); }} />;
}
