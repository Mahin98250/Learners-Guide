import { ReferenceAdminPanel } from "@/admin/ReferenceAdminPanel";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };

/**
 * Keep the complete admin experience as the single source of truth.
 * Adds a mobile-safe logout control because the sidebar actions are hidden on
 * smaller screens.
 */
export function AdminWithDrive({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  return (
    <>
      <ReferenceAdminPanel user={user} onLogout={onLogout} />
      <button
        type="button"
        onClick={onLogout}
        aria-label="Logout from admin panel"
        style={{
          display: "none",
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 999,
          border: "1px solid rgba(255,255,255,.25)",
          borderRadius: 999,
          padding: "12px 18px",
          background: "#0F1B3D",
          color: "#fff",
          fontWeight: 800,
          boxShadow: "0 10px 30px rgba(15,27,61,.3)",
          cursor: "pointer",
        }}
        className="mobile-admin-logout"
      >
        🚪 Logout
      </button>
      <style>{`@media(max-width:900px){.mobile-admin-logout{display:block!important}}`}</style>
    </>
  );
}
