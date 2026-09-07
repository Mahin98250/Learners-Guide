import { useMemo, useState } from "react";
import { LGLogo } from "@/lg/ui";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type Props = { user: AdminUser; onOpenLegacy: () => void; onBack: () => void; onLogout: () => void };
type Item = { label: string; icon: string; hint: string; target: string; keywords?: string };
type Group = { title: string; subtitle: string; items: Item[] };

const GROUPS: Group[] = [
  { title: "People", subtitle: "Manage learners and staff", items: [
    { label: "Students", icon: "🎓", hint: "Profiles, classes & accounts", target: "Students" },
    { label: "Teachers", icon: "👨‍🏫", hint: "Staff, subjects & accounts", target: "Teachers" },
    { label: "User Accounts", icon: "🔐", hint: "Authorized login accounts", target: "User Accounts", keywords: "accounts login security" },
    { label: "Search Profiles", icon: "🔎", hint: "Find a student or teacher", target: "Search Profiles", keywords: "search find profile" },
  ] },
  { title: "Academic", subtitle: "Classes, teaching and assessments", items: [
    { label: "Batches & Timetable", icon: "👥", hint: "Classes, subjects & schedule", target: "Batches & Timetable" },
    { label: "Homework", icon: "📝", hint: "Assigned work overview", target: "Homework" },
    { label: "Exam Schedule", icon: "📋", hint: "Upcoming exam planning", target: "Exam Schedule" },
    { label: "Student Results", icon: "🏆", hint: "Results and marks", target: "Student Results" },
    { label: "Marks Overview", icon: "📊", hint: "Academic performance", target: "Marks Overview" },
    { label: "Study Materials", icon: "📚", hint: "Learning resources & files", target: "Study Materials" },
  ] },
  { title: "Operations", subtitle: "Daily institute management", items: [
    { label: "Attendance", icon: "✅", hint: "Attendance records", target: "Attendance" },
    { label: "Fees", icon: "💰", hint: "Payments and dues", target: "Fees" },
    { label: "Announcements", icon: "📢", hint: "Institute communications", target: "Announcements" },
  ] },
];

function openTarget(target: string, fallback: () => void) {
  const normalized = target.toLowerCase();
  const nav = Array.from(document.querySelectorAll<HTMLElement>(".nav"));
  const item = nav.find((el) => (el.textContent || "").trim().toLowerCase().includes(normalized));
  if (item) item.click(); else fallback();
}

export function AdminManagementHub({ user, onOpenLegacy, onBack, onLogout }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !q || `${item.label} ${item.hint} ${item.keywords || ""}`.toLowerCase().includes(q)) })).filter((group) => group.items.length), [q]);

  return <div className="admin-management-hub"><style>{`*{box-sizing:border-box}.admin-management-hub{min-height:100vh;background:#F4F7FB;color:#0F1B3D;font-family:Poppins,system-ui,sans-serif}.amh-top{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #E2E8F0;padding:14px clamp(14px,4vw,38px);display:flex;align-items:center;gap:12px}.amh-brand{display:flex;align-items:center;gap:10px;flex:1}.amh-logo{width:40px;height:40px;border-radius:12px;background:#EEF2FF;display:grid;place-items:center}.amh-brand b{display:block}.amh-brand small{color:#64748B;font-size:10px}.amh-btn{border:0;border-radius:11px;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer}.amh-back{background:#EEF2FF;color:#4361EE}.amh-logout{background:#FFF1F2;color:#DC2626}.amh-wrap{max-width:1380px;margin:auto;padding:clamp(16px,3vw,30px)}.amh-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:20px}.amh-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.4px;font-weight:900;color:#4361EE}.amh-hero h1{font-size:clamp(24px,4vw,32px);margin:4px 0}.amh-hero p{margin:0;color:#64748B;font-size:13px}.amh-search{width:min(390px,100%);border:1px solid #D9E0EA;background:#fff;border-radius:14px;padding:12px 14px;outline:none;font:inherit}.amh-search:focus{border-color:#4361EE;box-shadow:0 0 0 3px #4361EE18}.amh-group{margin-top:22px}.amh-group-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:10px}.amh-group h2{font-size:16px;margin:0}.amh-group p{font-size:11px;color:#64748B;margin:3px 0 0}.amh-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.amh-card{border:1px solid #E2E8F0;background:#fff;border-radius:16px;padding:14px;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer;color:#0F1B3D;transition:.15s}.amh-card:hover{border-color:#AAB8F8;transform:translateY(-1px);box-shadow:0 8px 24px #0F1B3D0D}.amh-icon{width:38px;height:38px;border-radius:11px;background:#EEF2FF;display:grid;place-items:center;flex:none;font-size:18px}.amh-card b{display:block;font-size:12px}.amh-card small{display:block;color:#64748B;font-size:10px;margin-top:2px}.amh-arrow{margin-left:auto;color:#4361EE;font-weight:900}.amh-empty{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:24px;text-align:center;color:#64748B;font-size:13px}@media(max-width:1050px){.amh-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.amh-hero{align-items:stretch;flex-direction:column}.amh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.amh-search{width:100%}}@media(max-width:480px){.amh-top{padding:10px 12px}.amh-brand small{display:none}.amh-back{display:none}.amh-grid{grid-template-columns:1fr}.amh-wrap{padding:14px}.amh-card{min-height:64px}}`}</style>
    <header className="amh-top"><button className="amh-btn amh-back" onClick={onBack}>← Dashboard</button><div className="amh-brand"><div className="amh-logo"><LGLogo size={32} showText={false} /></div><div><b>Learner's Guide</b><small>Admin Management</small></div></div><button className="amh-btn amh-logout" onClick={onLogout}>Logout</button></header>
    <main className="amh-wrap"><section className="amh-hero"><div><div className="amh-eyebrow">Management center</div><h1>What do you want to manage?</h1><p>Everything is grouped by purpose so the Admin portal stays simple.</p></div><input className="amh-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search management…" aria-label="Search management" /></section>
      {groups.length ? groups.map((group) => <section className="amh-group" key={group.title}><div className="amh-group-head"><div><h2>{group.title}</h2><p>{group.subtitle}</p></div></div><div className="amh-grid">{group.items.map((item) => <button className="amh-card" key={item.label} onClick={() => openTarget(item.target, onOpenLegacy)}><span className="amh-icon" aria-hidden="true">{item.icon}</span><span><b>{item.label}</b><small>{item.hint}</small></span><span className="amh-arrow" aria-hidden="true">→</span></button>)}</div></section>) : <div className="amh-empty">No management section matches “{query}”.</div>}
    </main></div>;
}
