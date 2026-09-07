import { ModernAdminPortal } from "@/admin/ModernAdminPortal";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };

export function AdminWithDrive({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  return <ModernAdminPortal user={user} onLogout={onLogout} />;
}
