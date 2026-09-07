import { useMemo, useState } from "react";
import { LeaveRequests } from "@/lg/LeaveRequests";
import { PeopleAnalyticsPage } from "@/admin/PeopleAnalyticsPage";
import { MaterialsDriveV2 } from "@/admin/MaterialsDriveV2";
import { ModernAdminDashboard } from "@/admin/ModernAdminDashboard";
import AdminRecordsPage from "@/admin/records/AdminRecordsPage";
import TeacherRecordsPage from "@/admin/records/TeacherRecordsPage";
import BatchesTimetablePage from "@/admin/batches/BatchesTimetablePage";
import TestManagementPage from "@/admin/tests/TestManagementPage";
import { LGLogo } from "@/lg/ui";
import "@/admin/modern-admin.css";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type Item = { key: string; icon: string; label: string; special?: "dashboard" | "analytics" | "materials" | "leave" | "students" | "teachers" | "batches" | "tests" };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  { label: "Overview", items: [{ key: "Dashboard", icon: "⌂", label: "Dashboard", special: "dashboard" }] },
  { label: "People", items: [
    { key: "Students", icon: "🎓", label: "Students", special: "students" },
    { key: "Teachers", icon: "👨‍🏫", label: "Teachers", special: "teachers" },
    { key: "User Accounts", icon: "🔐", label: "User Accounts" },
    { key: "Search Profiles", icon: "⌕", label: "Search Profiles" },
  ] },
  { label: "Academic", items: [
    { key: "Batches & Timetable", icon: "▦", label: "Batches & Timetable", special: "batches" },
    { key: "Attendance", icon: "✓", label: "Attendance" },
    { key: "Homework", icon: "✎", label: "Homework" },
    { key: "Exam Schedule", icon: "▤", label: "Exam Schedule", special: "tests" },
    { key: "Student Results", icon: "🏆", label: "Student Results" },
    { key: "Marks Overview", icon: "◒", label: "Marks Overview" },
    { key: "Study Materials", icon: "📚", label: "Study Materials", special: "materials" },
  ] },
  { label: "Operations", items: [
    { key: "Fees", icon: "₹", label: "Fees" },
    { key: "Announcements", icon: "📢", label: "Announcements" },
    { key: "Leave Requests", icon: "☷", label: "Leave Requests", special: "leave" },
  ] },
  { label: "Insights", items: [{ key: "People & Analytics", icon: "↗", label: "Analytics", special: "analytics" }] },
];

const allItems = GROUPS.flatMap((group) => group.items);

export function ModernAdminPortal({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const [active, setActive] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = useMemo(() => allItems.find((item) => item.key === active) || allItems[0], [active]);

  const choose = (item: Item) => { setActive(item.key); setMobileOpen(false); };
  const go = (label: string) => { const item = allItems.find((x) => x.key === label || x.label === label); if (item) choose(item); };

  const renderPage = () => {
    if (activeItem.special === "dashboard") return <ModernAdminDashboard user={user} onNavigate={go} />;
    if (activeItem.special === "students") return <div className="modern-admin-native-page"><AdminRecordsPage kind="students" /></div>;
    if (activeItem.special === "teachers") return <div className="modern-admin-native-page"><TeacherRecordsPage /></div>;
    if (activeItem.special === "batches") return <div className="modern-admin-native-page"><BatchesTimetablePage /></div>;
    if (activeItem.special === "tests") return <div className="modern-admin-native-page"><TestManagementPage /></div>;
    if (activeItem.special === "analytics") return <div className="modern-admin-special"><PeopleAnalyticsPage onClose={() => choose(allItems[0])} /></div>;
    if (activeItem.special === "materials") return <div className="modern-admin-special"><MaterialsDriveV2 onClose={() => choose(allItems[0])} /></div>;
    if (activeItem.special === "leave") return <div className="modern-admin-special modern-admin-leave"><LeaveRequests user={user} student={null} canReview /></div>;
    return <div className="modern-admin-native-placeholder"><div className="modern-admin-placeholder-icon">✦</div><h2>{activeItem.label}</h2><p>This section is being migrated into the new Admin workspace. Existing data and permissions remain unchanged.</p></div>;
  };

  return (
    <div className="modern-admin">
      <button type="button" className="modern-admin-mobile-back" onClick={() => { if (mobileOpen) setMobileOpen(false); else choose(allItems[0]); }} aria-label={mobileOpen ? "Close navigation" : "Back to dashboard"}>{mobileOpen ? "×" : "←"}</button>
      <aside className={`modern-admin-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="modern-admin-brand"><div className="modern-admin-brand-mark"><LGLogo size={58} showText={false} /></div><div><strong>Learner's Guide</strong><span>Admin Portal</span></div></div>
        <div className="modern-admin-profile"><div className="modern-admin-avatar">{(user.name || "A").trim().charAt(0).toUpperCase()}</div><div className="modern-admin-profile-copy"><strong>{user.name || "Admin"}</strong><span>Administrator</span></div><span className="modern-admin-online" title="Signed in" /></div>
        <nav className="modern-admin-nav" aria-label="Admin navigation">
          {GROUPS.map((group) => <div className="modern-admin-nav-group" key={group.label}><div className="modern-admin-nav-label">{group.label}</div>{group.items.map((item) => <button type="button" key={item.key} className={`modern-admin-nav-item ${active === item.key ? "active" : ""}`} onClick={() => choose(item)}><span className="modern-admin-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}</div>)}
        </nav>
        <div className="modern-admin-sidebar-bottom"><div className="modern-admin-current-admin"><span>Signed in as</span><strong>{user.name || "Admin"}</strong></div><button type="button" className="modern-admin-logout" onClick={onLogout}>↪ <span>Logout</span></button></div>
      </aside>
      <main className="modern-admin-main">
        <header className="modern-admin-topbar"><div className="modern-admin-heading"><span className="modern-admin-breadcrumb">Learner's Guide <b>•</b> Admin</span><h1>{activeItem.label}</h1></div><div className="modern-admin-top-actions"><div className="modern-admin-top-admin"><div className="modern-admin-avatar small">{(user.name || "A").trim().charAt(0).toUpperCase()}</div><div><strong>{user.name || "Admin"}</strong><span>Administrator</span></div></div><button type="button" className="modern-admin-top-logout" onClick={onLogout}>Logout</button></div></header>
        <section className="modern-admin-content">{renderPage()}</section>
      </main>
    </div>
  );
}
