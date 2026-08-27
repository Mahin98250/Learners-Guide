import { ReferenceAdminPanel } from "@/admin/ReferenceAdminPanel";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };

/**
 * Keep the complete, original admin experience as the single source of truth.
 * The reference panel already contains every admin section and its responsive
 * navigation; this wrapper must not replace it with a reduced mobile menu.
 */
export function AdminWithDrive({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  return <ReferenceAdminPanel user={user} onLogout={onLogout} />;
}
