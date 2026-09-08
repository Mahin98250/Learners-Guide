import { lazy, Suspense, useMemo, useState } from "react";
import { LGLogo } from "@/lg/ui";
import "@/admin/modern-admin.css";
import "@/admin/modern-admin-native.css";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type Special = "dashboard" | "materials" | "leave" | "students" | "teachers" | "batches" | "tests" | "homework" | "announcements" | "attendance" | "results" | "marks" | "fees" | "accounts" | "profiles" | "analytics" | "report-cards" | "account-security" | "create-admin";
type Item = { key: string; icon: string; label: string; special?: Special };
type Group = { label: string; items: Item[] };

type Loader = () => Promise<unknown>;

const loadAdminRecords: Loader = () => import("@/admin/records/AdminRecordsPage");
const loadTeacherRecords: Loader = () => import("@/admin/records/TeacherRecordsPage");
const loadBatches: Loader = () => import("@/admin/batches/BatchesTimetablePage");
const loadTests: Loader = () => import("@/admin/tests/TestManagementPage");
const loadHomework: Loader = () => import("@/admin/HomeworkPage");
const loadAnnouncements: Loader = () => import("@/admin/AnnouncementsPage");
const loadReportCards: Loader = () => import("@/admin/ReportCardsPage");
const loadMaterials: Loader = () => import("@/admin/MaterialsDriveV2");
const loadLeave: Loader = () => import("@/lg/LeaveRequests");
const loadAccount: Loader = () => import("@/admin/AdminAccountPage");
const loadSectionPages: Loader = () => import("@/admin/ModernAdminSectionPages");

const AdminRecordsPage = lazy(() => loadAdminRecords.then((module) => ({ default: module.default })));
const TeacherRecordsPage = lazy(() => loadTeacherRecords.then((module) => ({ default: module.default })));
const BatchesTimetablePage = lazy(() => loadBatches.then((module) => ({ default: module.default })));
const TestManagementPage = lazy(() => loadTests.then((module) => ({ default: module.default })));
const HomeworkPage = lazy(() => loadHomework.then((module) => ({ default: module.default })));
const AnnouncementsPage = lazy(() => loadAnnouncements.then((module) => ({ default: module.default })));
const ReportCardsPage = lazy(() => loadReportCards.then((module) => ({ default: module.default })));
const MaterialsDriveV2 = lazy(() => loadMaterials.then((module) => ({ default: module.MaterialsDriveV2 })));
const LeaveRequests = lazy(() => loadLeave.then((module) => ({ default: module.LeaveRequests })));
const AdminAccountPage = lazy(() => loadAccount.then((module) => ({ default: module.default })));
const ModernAdminSectionPage = lazy(() => loadSectionPages.then((module) => ({ default: module.ModernAdminSectionPage })));
const ModernAdminDashboard = lazy(() => import("@/admin/ModernAdminDashboard").then((module) => ({ default: module.ModernAdminDashboard })));

const preloaders: Partial<Record<Special, Loader>> = {
  dashboard: () => import("@/admin/ModernAdminDashboard"),
  students: loadAdminRecords,
  teachers: loadTeacherRecords,
  batches: loadBatches,
  tests: loadTests,
  homework: loadHomework,
  announcements: loadAnnouncements,
  "report-cards": loadReportCards,
  materials: loadMaterials,
  leave: loadLeave,
  "account-security": loadAccount,
  "create-admin": loadAccount,
  attendance: loadSectionPages,
  results: loadSectionPages,
  marks: loadSectionPages,
  fees: loadSectionPages,
  accounts: loadSectionPages,
  profiles: loadSectionPages,
  analytics: loadSectionPages,
};

const GROUPS: Group[] = [
  { label: "Overview", items: [{ key: "Dashboard", icon: "⌂", label: "Dashboard", special: "dashboard" }] },
  { label: "People", items: [
    { key: "Students", icon: "🎓", label: "Students", special: "students" },
    { key: "Teachers", icon: "👨‍🏫", label: "Teachers", special: "teachers" },
    { key: "User Accounts", icon: "🔐", label: "User Accounts", special: "accounts" },
    { key: "Search Profiles", icon: "⌕", label: "Search Profiles", special: "profiles" },
  ] },
  { label: "Academic", items: [
    { key: "Batches & Timetable", icon: "▦", label: "Batches & Timetable", special: "batches" },
    { key: "Attendance", icon: "✓", label: "Attendance", special: "attendance" },
    { key: "Homework", icon: "✎", label: "Homework", special: "homework" },
    { key: "Exam Schedule", icon: "▤", label: "Exam Schedule", special: "tests" },
    { key: "Student Results", icon: "🏆", label: "Student Results", special: "results" },
    { key: "Marks Overview", icon: "◒", label: "Marks Overview", special: "marks" },
    { key: "Study Materials", icon: "📚", label: "Study Materials", special: "materials" },
    { key: "Report Cards", icon: "▤", label: "Report Cards", special: "report-cards" },
  ] },
  { label: "Operations", items: [
    { key: "Fees", icon: "₹", label: "Fees", special: "fees" },
    { key: "Announcements", icon: "📢", label: "Announcements", special: "announcements" },
    { key: "Leave Requests", icon: "☷", label: "Leave Requests", special: "leave" },
  ] },
  { label: "Insights", items: [{ key: "Analytics", icon: "↗", label: "Analytics", special: "analytics" }] },
];
const allItems = GROUPS.flatMap((group) => group.items);
const accountItems: Item[] = [
  { key: "Account & Security", icon: "⚙", label: "Account & Security", special: "account-security" },
  { key: "Create Admin Account", icon: "+", label: "Create Admin Account", special: "create-admin" },
];
const allSelectableItems = [...allItems, ...accountItems];

function PageFallback() {
  return <div className="modern-admin-native-page" style={{ minHeight: 220, display: "grid", placeItems: "center" }}>Loading section…</div>;
}

export function ModernAdminPortal({ user, onLogout }: { user: AdminUser; onLogout: () => void }) {
  const [active, setActive] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = useMemo(() => allSelectableItems.find((item) => item.key === active) || allItems[0], [active]);
  const choose = (item: Item) => { setActive(item.key); setMobileOpen(false); };
  const go = (label: string) => { const item = allSelectableItems.find((x) => x.key === label || x.label === label); if (item) choose(item); };
  const preload = (item: Item) => { const loader = item.special ? preloaders[item.special] : undefined; if (loader) void loader(); };
  const renderPage = () => {
    if (activeItem.special === "dashboard") return <ModernAdminDashboard user={user} onNavigate={go} />;
    if (activeItem.special === "students") return <div className="modern-admin-native-page"><AdminRecordsPage kind="students" /></div>;
    if (activeItem.special === "teachers") return <div className="modern-admin-native-page"><TeacherRecordsPage /></div>;
    if (activeItem.special === "batches") return <div className="modern-admin-native-page"><BatchesTimetablePage /></div>;
    if (activeItem.special === "tests") return <div className="modern-admin-native-page"><TestManagementPage /></div>;
    if (activeItem.special === "homework") return <div className="modern-admin-native-page"><HomeworkPage /></div>;
    if (activeItem.special === "announcements") return <div className="modern-admin-native-page"><AnnouncementsPage /></div>;
    if (activeItem.special === "report-cards") return <div className="modern-admin-native-page"><ReportCardsPage /></div>;
    if (activeItem.special === "materials") return <div className="modern-admin-special"><MaterialsDriveV2 onClose={() => choose(allItems[0])} /></div>;
    if (activeItem.special === "leave") return <div className="modern-admin-special modern-admin-leave"><LeaveRequests user={user} student={null} canReview /></div>;
    if (activeItem.special === "account-security") return <div className="modern-admin-section-page"><AdminAccountPage user={user} mode="security" onLogout={onLogout} /></div>;
    if (activeItem.special === "create-admin") return <div className="modern-admin-section-page"><AdminAccountPage user={user} mode="create" onLogout={onLogout} /></div>;
    if (["attendance","results","marks","fees","accounts","profiles","analytics"].includes(activeItem.special || "")) return <div className="modern-admin-section-page"><ModernAdminSectionPage section={activeItem.special as "attendance" | "results" | "marks" | "fees" | "accounts" | "profiles" | "analytics"} onBack={() => choose(allItems[0])} /></div>;
    return null;
  };
  return (
    <div className="modern-admin">
      <button type="button" className="modern-admin-mobile-back" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? "Close admin navigation" : "Open admin navigation"} aria-expanded={mobileOpen}>{mobileOpen ? "×" : "☰"}</button>
      <aside className={`modern-admin-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="modern-admin-brand"><div className="modern-admin-brand-mark"><LGLogo size={58} showText={false} /></div><div><strong>Learner's Guide</strong><span>Admin Portal</span></div></div>
        <nav className="modern-admin-nav" aria-label="Admin navigation">{GROUPS.map((group) => <div className="modern-admin-nav-group" key={group.label}><div className="modern-admin-nav-label">{group.label}</div>{group.items.map((item) => <button type="button" key={item.key} className={`modern-admin-nav-item ${active === item.key ? "active" : ""}`} onMouseEnter={() => preload(item)} onFocus={() => preload(item)} onClick={() => choose(item)}><span className="modern-admin-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}</div>)}</nav>
        <div className="modern-admin-account-area">
          <div className="modern-admin-account-identity"><div className="modern-admin-avatar">{(user.name || "A").trim().charAt(0).toUpperCase()}</div><div className="modern-admin-profile-copy"><strong>{user.name || "Admin"}</strong><span>Administrator</span></div><span className="modern-admin-online" title="Signed in" /></div>
          <button type="button" className={`modern-admin-account-link ${active === "Account & Security" ? "active" : ""}`} onMouseEnter={() => preload(accountItems[0])} onFocus={() => preload(accountItems[0])} onClick={() => choose(accountItems[0])}><span>⚙</span><span>Account & Security</span></button>
          <button type="button" className={`modern-admin-account-link ${active === "Create Admin Account" ? "active" : ""}`} onMouseEnter={() => preload(accountItems[1])} onFocus={() => preload(accountItems[1])} onClick={() => choose(accountItems[1])}><span>+</span><span>Create Admin Account</span></button>
          <button type="button" className="modern-admin-logout" onClick={onLogout}>↪ <span>Logout</span></button>
        </div>
      </aside>
      <main className="modern-admin-main">
        <header className="modern-admin-topbar"><div className="modern-admin-heading"><span className="modern-admin-breadcrumb">Learner's Guide <b>•</b> Admin</span><h1>{activeItem.label}</h1></div><div className="modern-admin-top-actions"><div className="modern-admin-top-admin"><div className="modern-admin-avatar small">{(user.name || "A").trim().charAt(0).toUpperCase()}</div><div><strong>{user.name || "Admin"}</strong><span>Administrator</span></div></div><button type="button" className="modern-admin-top-logout" onClick={onLogout}>Logout</button></div></header>
        <section className="modern-admin-content"><Suspense fallback={<PageFallback />}>{renderPage()}</Suspense></section>
      </main>
    </div>
  );
}
