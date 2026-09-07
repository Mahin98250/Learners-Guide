import { useEffect, useState } from "react";
import "@/admin/admin-mobile.css";
import { ReferenceAdminPanel } from "@/admin/ReferenceAdminPanel";
import { MaterialsDriveV2 } from "@/admin/MaterialsDriveV2";
import { LeaveRequests } from "@/lg/LeaveRequests";
import { PeopleAnalyticsPage } from "@/admin/PeopleAnalyticsPage";
import { AdvancedAdminHome } from "@/admin/AdvancedAdminHome";
import { AdminManagementHub } from "@/admin/AdminManagementHub";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };

function GlassBack({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="admin-mobile-back" onClick={onClick} aria-label={label} title={label}>←</button>;
}

export function AdminWithDrive({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const [advancedHome, setAdvancedHome] = useState(true);
  const [managementHub, setManagementHub] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  useEffect(() => {
    if (advancedHome || managementHub) return;
    const mountAdminNavigation = () => {
      const nav = document.querySelector<HTMLElement>(".navrow");
      if (!nav) return;
      Array.from(nav.querySelectorAll<HTMLElement>(".nav")).forEach((item) => {
        const text = (item.textContent || "").trim();
        if (text.includes("Messages")) {
          const active = item.classList.contains("active");
          item.style.display = "none";
          if (active) Array.from(nav.querySelectorAll<HTMLElement>(".nav")).find((x) => (x.textContent || "").trim().includes("Dashboard"))?.click();
        }
      });
      const materialNav = Array.from(nav.querySelectorAll<HTMLElement>(".nav")).find((item) => (item.textContent || "").trim().includes("Study Materials"));
      if (materialNav && !materialNav.dataset.driveBound) {
        materialNav.dataset.driveBound = "true";
        materialNav.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); setMaterialsOpen(true); }, true);
      }
      if (!nav.querySelector(".admin-analytics-nav")) {
        const button = document.createElement("button"); button.type = "button"; button.className = "nav admin-analytics-nav"; button.setAttribute("aria-label", "Open People and Analytics");
        button.innerHTML = "<span aria-hidden=\"true\">📈</span><span>People & Analytics</span>";
        button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); setAnalyticsOpen(true); }, true); nav.appendChild(button);
      }
      if (nav.querySelector(".admin-leave-nav")) return;
      const button = document.createElement("button"); button.type = "button"; button.className = "nav admin-leave-nav"; button.setAttribute("aria-label", "Open leave requests");
      button.innerHTML = "<span aria-hidden=\"true\">🏖️</span><span>Leave Requests</span>";
      button.style.cssText = "border:0;background:transparent;color:#ffffff8c;width:100%;padding:11px 14px;margin:3px 0;border-radius:12px;text-align:left;display:flex;align-items:center;gap:12px;cursor:pointer;font:inherit;";
      button.addEventListener("click", () => setLeaveOpen(true)); nav.appendChild(button);
    };
    mountAdminNavigation(); const observer = new MutationObserver(mountAdminNavigation); observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [advancedHome, managementHub]);

  if (advancedHome) return <AdvancedAdminHome user={user} onOpenManagement={() => setManagementHub(true)} onLogout={onLogout} />;
  if (managementHub) return <AdminManagementHub user={user} onOpenLegacy={() => setManagementHub(false)} onBack={() => setAdvancedHome(true)} onLogout={onLogout} />;
  if (analyticsOpen) return <div style={{ minHeight: "100vh", position: "relative" }}><GlassBack onClick={() => setAnalyticsOpen(false)} label="Back to Admin" /><PeopleAnalyticsPage onClose={() => setAnalyticsOpen(false)} /></div>;
  if (materialsOpen) return <div style={{ minHeight: "100vh", background: "#F0F4FF", position: "relative" }}><GlassBack onClick={() => setMaterialsOpen(false)} label="Back to Admin" /><div style={{ padding: "12px 18px 12px 70px", background: "#0F1B3D", display: "flex", alignItems: "center", gap: 12, minHeight: 68 }}><span style={{ color: "#fff", fontWeight: 800, flex: 1 }}>Study Materials · Drive</span><button type="button" onClick={onLogout} style={{ border: "1px solid #ef444466", borderRadius: 10, padding: "9px 13px", background: "#ef44441a", color: "#fecaca", fontWeight: 800, cursor: "pointer" }}>↪ Logout</button></div><MaterialsDriveV2 onClose={() => setMaterialsOpen(false)} /></div>;

  return <div style={{ position: "relative" }}><GlassBack onClick={() => setManagementHub(true)} label="Back to Management" /><ReferenceAdminPanel user={user} onLogout={onLogout} /><button type="button" onClick={onLogout} aria-label="Logout from admin panel" style={{ display: "none", position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1199, border: "1px solid rgba(255,255,255,.25)", borderRadius: 999, padding: "12px 18px", background: "#0F1B3D", color: "#fff", fontWeight: 800, boxShadow: "0 10px 30px rgba(15,27,61,.3)", cursor: "pointer" }} className="mobile-admin-logout">🚪 Logout</button><style>{`@media(max-width:900px){.mobile-admin-logout{display:block!important}.admin-leave-nav{min-width:130px!important;white-space:nowrap!important;color:#0F1B3D!important}.admin-leave-nav:hover{background:#F0F4FF!important}}@media(min-width:901px){.admin-leave-nav:hover{background:#ffffff12!important}.admin-leave-nav{color:#ffffff8c!important}.admin-leave-nav:focus-visible{outline:2px solid #4361EE;outline-offset:2px}}`}</style>{leaveOpen&&<div className="admin-leave-dialog" role="dialog" aria-modal="true" aria-label="Leave Requests" onClick={() => setLeaveOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(15,23,42,.52)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div onClick={e => e.stopPropagation()} style={{ width: "min(760px,100%)", maxHeight: "90vh", overflowY: "auto", background: "#f8fafc", borderRadius: 22, padding: 18, boxShadow: "0 24px 70px rgba(15,23,42,.28)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div><div style={{ fontSize: 11, fontWeight: 800, color: "#635bdf", letterSpacing: 1, textTransform: "uppercase" }}>Attendance & Leave</div><h2 style={{ margin: "3px 0 0", fontSize: 22, color: "#182044" }}>Leave Requests</h2></div><button type="button" onClick={() => setLeaveOpen(false)} aria-label="Close leave requests" style={{ border: 0, borderRadius: 10, padding: "8px 11px", background: "#e9edf5", cursor: "pointer", fontSize: 16 }}>✕</button></div><LeaveRequests user={user} student={null} canReview /></div></div>}</div>;
}
