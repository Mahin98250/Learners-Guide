import { useState } from "react";
import { ReferenceAdminPanel } from "@/admin/ReferenceAdminPanel";
import { LeaveRequests } from "@/lg/LeaveRequests";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };

export function AdminWithDrive({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  return (
    <>
      <ReferenceAdminPanel user={user} onLogout={onLogout} />
      <button type="button" onClick={() => setLeaveOpen(true)} aria-label="Open leave requests" style={{ position: "fixed", right: 16, bottom: "calc(76px + env(safe-area-inset-bottom, 0px))", zIndex: 1200, border: "1px solid rgba(255,255,255,.28)", borderRadius: 999, padding: "11px 15px", background: "rgba(24,32,68,.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", color: "#fff", fontWeight: 900, boxShadow: "0 10px 28px rgba(15,23,42,.22)", cursor: "pointer" }}>
        🏖️ Leave Requests
      </button>
      <button type="button" onClick={onLogout} aria-label="Logout from admin panel" style={{ display: "none", position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1199, border: "1px solid rgba(255,255,255,.25)", borderRadius: 999, padding: "12px 18px", background: "#0F1B3D", color: "#fff", fontWeight: 800, boxShadow: "0 10px 30px rgba(15,27,61,.3)", cursor: "pointer" }} className="mobile-admin-logout">🚪 Logout</button>
      <style>{`@media(max-width:900px){.mobile-admin-logout{display:block!important}}`}</style>
      {leaveOpen && <div role="dialog" aria-modal="true" onClick={() => setLeaveOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(15,23,42,.52)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: "min(760px,100%)", maxHeight: "90vh", overflowY: "auto", background: "#f8fafc", borderRadius: 22, padding: 18, boxShadow: "0 24px 70px rgba(15,23,42,.28)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div><div style={{ fontSize: 11, fontWeight: 800, color: "#635bdf", letterSpacing: 1, textTransform: "uppercase" }}>Attendance & Leave</div><h2 style={{ margin: "3px 0 0", fontSize: 22, color: "#182044" }}>Leave Requests</h2></div><button type="button" onClick={() => setLeaveOpen(false)} aria-label="Close leave requests" style={{ border: 0, borderRadius: 10, padding: "8px 11px", background: "#e9edf5", cursor: "pointer", fontSize: 16 }}>✕</button></div>
          <LeaveRequests user={user} canReview />
        </div>
      </div>}
    </>
  );
}
