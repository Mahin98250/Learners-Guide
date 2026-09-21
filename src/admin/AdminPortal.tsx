import { useCallback, useEffect, useState } from "react";
import { clearCache } from "@/lg/data";
import { signOut } from "@/lg/auth";
import { supabase } from "@/lg/supabase";
import { getVerifiedAdminAccess } from "@/lg/admin-access";
import { AdminWithDrive } from "./AdminWithDrive";
import AdminLogin from "./auth/AdminLogin";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };

/** Single source of truth for the admin experience. */
export default function AdminPortal() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const access = await getVerifiedAdminAccess("people.manage");
      setUser(access?.user ? (access.user as AdminUser) : null);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getVerifiedAdminAccess("people.manage").then((access) => {
      if (!mounted) return;
      setUser(access?.user ? (access.user as AdminUser) : null);
      setChecking(false);
    }).catch(() => {
      if (!mounted) return;
      setUser(null);
      setChecking(false);
    });
    return () => { mounted = false; };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn("Remote admin logout failed; clearing local session:", error);
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    } finally {
      setUser(null);
      clearCache();
      const base = import.meta.env.BASE_URL || "/";
      const homeUrl = new URL(base.endsWith("/") ? base : `${base}/`, window.location.origin).href;
      window.location.replace(homeUrl);
    }
  }, []);

  const handleForgotPassword = useCallback(() => {
    const base = import.meta.env.BASE_URL || "/";
    const root = `${window.location.origin}${base.endsWith("/") ? base : `${base}/`}`;
    window.location.assign(new URL("reset-password", root).href);
  }, []);

  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Poppins, system-ui, sans-serif", color: "#0F1B3D" }}>Loading admin portal…</div>;
  if (!user) return <AdminLogin onAuthenticated={() => void refreshUser()} onForgotPassword={handleForgotPassword} />;
  return <AdminWithDrive user={user} onLogout={handleLogout} />;
}
