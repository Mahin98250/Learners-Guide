import { useMemo, useState } from "react";
import { LGLogo } from "@/lg/ui";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type Props = { user: AdminUser; onOpenLegacy: (target?: string) => void; onBack: () => void; onLogout: () => void };
type Item = { label: string; icon: string; hint: string; target: string; keywords?: string; tone: string };
type Group = { title: string; subtitle: string; items: Item[] };

const GROUPS: Group[] = [
  { title: "People", subtitle: "Manage learners and staff", items: [
    { label: "Students", icon: "🎓", hint: "Profiles, classes & accounts", target: "Students", tone: "#4361EE" },
    { label: "Teachers", icon: "👨‍🏫", hint: "Staff, subjects & accounts", target: "Teachers", tone: "#7C3AED" },
    { label: "User Accounts", icon: "🔐", hint: "Authorized login accounts", target: "User Accounts", keywords: "accounts login security", tone: "#0F766E" },
    { label: "Search Profiles", icon: "🔎", hint: "Find a student or teacher", target: "Search Profiles", keywords: "search find profile", tone: "#2563EB" },
  ] },
  { title: "Academic", subtitle: "Classes, teaching and assessments", items: [
    { label: "Batches & Timetable", icon: "👥", hint: "Classes, subjects & schedule", target: "Batches & Timetable", tone: "#0891B2" },
    { label: "Homework", icon: "📝", hint: "Assigned work overview", target: "Homework", tone: "#EA580C" },
    { label: "Exam Schedule", icon: "📋", hint: "Upcoming exam planning", target: "Exam Schedule", tone: "#DB2777" },
    { label: "Student Results", icon: "🏆", hint: "Results and marks", target: "Student Results", tone: "#D97706" },
    { label: "Marks Overview", icon: "📊", hint: "Academic performance", target: "Marks Overview", tone: "#4F46E5" },
    { label: "Study Materials", icon: "📚", hint: "Learning resources & files", target: "Study Materials", tone: "#EA580C" },
  ] },
  { title: "Operations", subtitle: "Daily institute management", items: [
    { label: "Attendance", icon: "✅", hint: "Attendance records", target: "Attendance", tone: "#16A34A" },
    { label: "Fees", icon: "💰", hint: "Payments and dues", target: "Fees", tone: "#CA8A04" },
    { label: "Announcements", icon: "📢", hint: "Institute communications", target: "Announcements", tone: "#DC2626" },
  ] },
];

export function AdminManagementHub({ user, onOpenLegacy, onBack, onLogout }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !q || `${item.label} ${item.hint} ${item.keywords || ""}`.toLowerCase().includes(q)) })).filter((group) => group.items.length), [q]);

  return <div className="admin-management-hub">
    <style>{`
      *{box-sizing:border-box}.admin-management-hub{min-height:100vh;background:radial-gradient(circle at 0 0,#E8EEFF 0,transparent 27%),radial-gradient(circle at 100% 10%,#EDE4FF 0,transparent 24%),#F4F7FB;color:#0F1B3D;font-family:Poppins,system-ui,sans-serif;padding-bottom:28px}
      .amh-top{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.76);border-bottom:1px solid rgba(255,255,255,.9);padding:12px clamp(14px,4vw,38px);display:flex;align-items:center;gap:12px;backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);box-shadow:0 8px 30px rgba(15,27,61,.05)}
      .amh-brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0}.amh-logo{width:40px;height:40px;border-radius:13px;background:linear-gradient(145deg,#EEF2FF,#E5DEFF);display:grid;place-items:center;box-shadow:inset 0 1px 0 #fff}.amh-brand b{display:block;font-size:14px}.amh-brand small{color:#64748B;font-size:10px}.amh-btn{border:0;border-radius:12px;padding:10px 14px;font:inherit;font-weight:850;cursor:pointer;min-height:44px}.amh-back{background:#EEF2FF;color:#4361EE}.amh-logout{background:#FFF1F2;color:#DC2626}
      .amh-wrap{max-width:1380px;margin:auto;padding:clamp(16px,3vw,32px)}.amh-hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:20px;padding:24px;border-radius:25px;background:rgba(255,255,255,.78);border:1px solid rgba(255,255,255,.95);box-shadow:0 16px 45px rgba(67,97,238,.08)}.amh-hero:after{content:"";position:absolute;width:160px;height:160px;right:-70px;top:-80px;border-radius:50%;background:#A5B4FC30}.amh-eyebrow{position:relative;z-index:1;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:950;color:#4361EE}.amh-hero h1{position:relative;z-index:1;font-size:clamp(25px,4vw,34px);margin:5px 0;letter-spacing:-.6px}.amh-hero p{position:relative;z-index:1;margin:0;color:#64748B;font-size:13px}.amh-search{width:min(400px,100%);border:1px solid #D9E0EA;background:rgba(255,255,255,.9);border-radius:14px;padding:12px 14px;outline:none;font:inherit;min-height:46px}.amh-search:focus{border-color:#4361EE;box-shadow:0 0 0 4px #4361EE15}
      .amh-group{margin-top:20px}.amh-group-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:9px}.amh-group h2{font-size:16px;margin:0}.amh-group p{font-size:11px;color:#64748B;margin:3px 0 0}.amh-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.amh-card{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.95);background:rgba(255,255,255,.88);border-radius:17px;padding:14px;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer;color:#0F1B3D;min-height:76px;box-shadow:0 8px 24px rgba(15,27,61,.045);transition:transform .16s,border-color .16s,box-shadow .16s}.amh-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--card-tone)}.amh-card:hover{transform:translateY(-2px);border-color:#B9C4F8;box-shadow:0 12px 28px rgba(15,27,61,.09)}.amh-card:active{transform:scale(.985)}.amh-icon{width:41px;height:41px;border-radius:13px;background:color-mix(in srgb,var(--card-tone) 10%,#fff);display:grid;place-items:center;flex:none;font-size:19px}.amh-copy{min-width:0}.amh-card b{display:block;font-size:12px}.amh-card small{display:block;color:#64748B;font-size:10px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amh-arrow{margin-left:auto;color:var(--card-tone);font-weight:950;font-size:18px}.amh-empty{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:24px;text-align:center;color:#64748B;font-size:13px}
      @media(max-width:1050px){.amh-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.amh-hero{align-items:stretch;flex-direction:column;padding:19px}.amh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.amh-search{width:100%}}
      @media(max-width:520px){.amh-top{padding:10px 12px 10px 62px;min-height:64px}.amh-back{display:none}.amh-brand small{display:none}.amh-brand b{font-size:13px}.amh-wrap{padding:10px}.amh-hero{padding:17px;border-radius:20px;margin-bottom:14px}.amh-hero h1{font-size:25px}.amh-hero p{font-size:12px}.amh-grid{grid-template-columns:1fr;gap:8px}.amh-card{min-height:67px;padding:12px;border-radius:15px}.amh-icon{width:39px;height:39px}.amh-card b{font-size:12px}.amh-card small{font-size:9px}.amh-group{margin-top:17px}}
    `}</style>
    <button type="button" className="admin-mobile-back" onClick={onBack} aria-label="Back to dashboard" title="Back to dashboard">←</button>
    <header className="amh-top"><div className="amh-brand"><div className="amh-logo"><LGLogo size={32} showText={false} /></div><div><b>Mahin</b><small>Admin Management</small></div></div><button type="button" className="amh-btn amh-back" onClick={onBack}>← Dashboard</button><button type="button" className="amh-btn amh-logout" onClick={onLogout}>Logout</button></header>
    <main className="amh-wrap"><section className="amh-hero"><div><div className="amh-eyebrow">Management center</div><h1>What do you want to manage?</h1><p>Fast, focused tools for people, academics and daily operations.</p></div><input className="amh-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search management…" aria-label="Search management" /></section>
      {groups.length ? groups.map((group) => <section className="amh-group" key={group.title}><div className="amh-group-head"><div><h2>{group.title}</h2><p>{group.subtitle}</p></div></div><div className="amh-grid">{group.items.map((item) => <button type="button" className="amh-card" key={item.label} style={{ "--card-tone": item.tone } as React.CSSProperties} onClick={() => onOpenLegacy(item.target)}><span className="amh-icon" aria-hidden="true">{item.icon}</span><span className="amh-copy"><b>{item.label}</b><small>{item.hint}</small></span><span className="amh-arrow" aria-hidden="true">→</span></button>)}</div></section>) : <div className="amh-empty">No management section matches “{query}”.</div>}
    </main>
  </div>;
}
