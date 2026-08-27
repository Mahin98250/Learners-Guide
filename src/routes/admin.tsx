import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser, signOut, onAuthStateChange } from "@/lg/auth";
import { clearCache, hydrateForRole } from "@/lg/data";
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
    // Render the authenticated shell immediately. Data synchronization is deliberately
    // background work so a large institute dataset cannot block first paint.
    setUser(current);
    setChecking(false);
    setSyncing(true);
    try {
      await hydrateForRole("admin");
      lastSync.current = Date.now();
    } catch (error) {
      console.warn("Admin background sync skipped:", error instanceof Error ? error.message : error);
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
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
      if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) void syncAdmin(nextUser);
    });
    return () => { data.subscription.unsubscribe(); };
  }, [syncAdmin]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || !user || syncLock.current) return;
      if (Date.now() - lastSync.current < 15000) return;
      void (async () => {
        const current = (await getCurrentUser()) as AdminRouteUser | null;
        if (!current || current.role !== "admin") return;
        await syncAdmin(current);
      })();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => { document.removeEventListener("visibilitychange", refreshWhenVisible); window.removeEventListener("focus", refreshWhenVisible); };
  }, [syncAdmin, user]);

  if (checking && !user) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins,sans-serif" }}>Loading admin portal…</div>;
  if (!user) return <AdminLogin onSuccess={(admin) => { setUser(admin as AdminRouteUser); void syncAdmin(admin as AdminRouteUser); }} />;
  return <><AdminWithDrive user={user} onLogout={async () => { clearCache(); await signOut(); setUser(null); window.location.assign("/"); }} />{syncing && <div aria-live="polite" style={{ position: "fixed", right: 14, bottom: 14, zIndex: 999, background: "#0F1B3D", color: "#fff", borderRadius: 14, padding: "10px 14px", fontSize: 12, fontWeight: 700 }}>Syncing data…</div>}</>;
}
