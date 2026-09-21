import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import { useInstituteWorkspace } from "@/lg/tenant-context";
import { LGLogo } from "@/lg/ui";

type AdminUser = { id: string; name: string; phone: string; role: string; ref: string | null };
type Props = { user: AdminUser; onOpenManagement: (target?: string) => void; onLogout: () => void };
type Metric = { label: string; value: number; icon: string; note: string; tone: string };

const A = { bg: "#F4F7FB", ink: "#0F1B3D", sub: "#64748B", border: "#E2E8F0", accent: "#4361EE", green: "#16A34A", red: "#DC2626" };

const countRows = async (table: string, instituteId: string) => {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("institute_id", instituteId);
  if (error) throw error;
  return count || 0;
};

function Action({ icon, title, text, tone, onClick }: { icon: string; title: string; text: string; tone: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="advanced-admin-action" style={{ "--action-tone": tone } as React.CSSProperties}>
    <span className="advanced-admin-action-icon" aria-hidden="true">{icon}</span>
    <span className="advanced-admin-action-copy"><b>{title}</b><small>{text}</small></span>
    <span className="advanced-admin-action-arrow" aria-hidden="true">→</span>
  </button>;
}

export function AdvancedAdminHome({ user, onOpenManagement, onLogout }: Props) {
  const { instituteId } = useInstituteWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [upcomingTests, setUpcomingTests] = useState(0);
  const [pendingFees, setPendingFees] = useState(0);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = async () => {
    setLoading(true);
    setError("");
    const problems: string[] = [];
    if (!instituteId) {
      setError("An active institute workspace must be selected.");
      setLoading(false);
      return;
    }
    const safeCount = async (table: string, label: string) => { try { return await countRows(table, instituteId); } catch { problems.push(label); return 0; } };
    try {
      const [students, teachers, batches, homework, tests] = await Promise.all([
        safeCount("students", "students"), safeCount("teachers", "teachers"), safeCount("batches", "batches"),
        safeCount("homework", "homework"), safeCount("tests", "tests"),
      ]);
      setMetrics([
        { label: "Students", value: students, icon: "🎓", note: "Learner base", tone: "#4361EE" },
        { label: "Teachers", value: teachers, icon: "👨‍🏫", note: "Teaching staff", tone: "#7C3AED" },
        { label: "Batches", value: batches, icon: "👥", note: "Classes & groups", tone: "#0891B2" },
        { label: "Homework", value: homework, icon: "📝", note: "Assigned work", tone: "#EA580C" },
        { label: "Tests", value: tests, icon: "📋", note: "Assessments", tone: "#DB2777" },
        { label: "Attendance", value: 0, icon: "✅", note: "Overall rate %", tone: "#16A34A" },
      ]);

      const [attendance, fees, testsUpcoming, announcements] = await Promise.all([
        supabase.from("attendance").select("status").eq("institute_id", instituteId),
        supabase.from("fees").select("status,amount").eq("institute_id", instituteId),
        supabase.from("tests").select("id").eq("institute_id", instituteId).gte("test_date", today).order("test_date", { ascending: true }),
        supabase.from("announcements").select("id,title,date,target").eq("institute_id", instituteId).order("date", { ascending: false }).limit(4),
      ]);
      if (attendance.error) problems.push("attendance");
      if (fees.error) problems.push("fees");
      if (testsUpcoming.error) problems.push("upcoming tests");
      if (announcements.error) problems.push("announcements");

      const att = attendance.data || [];
      const present = att.filter((r) => String(r.status || "").toLowerCase() === "present").length;
      const rate = att.length ? Math.round((present / att.length) * 100) : 0;
      setMetrics((current) => current.map((m) => m.label === "Attendance" ? { ...m, value: rate } : m));
      const pending = (fees.data || []).filter((r) => String(r.status || "").toLowerCase() !== "paid").reduce((sum, r) => sum + Number(r.amount || 0), 0);
      setUpcomingTests(testsUpcoming.data?.length || 0);
      setPendingFees(pending);
      setRecentAnnouncements(announcements.data || []);
      if (problems.length) setError(`Some overview data could not be loaded: ${problems.join(", ")}. The management controls are still available.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Some overview data could not be loaded. The management controls are still available.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [instituteId]);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else onLogout();
  };

  return <div className="advanced-admin-home">
    <style>{`
      *{box-sizing:border-box}.advanced-admin-home{min-height:100vh;background:radial-gradient(circle at 8% 0%,#E7EDFF 0,transparent 28%),radial-gradient(circle at 100% 18%,#E9E0FF 0,transparent 24%),${A.bg};color:${A.ink};font-family:Poppins,system-ui,sans-serif;padding-bottom:32px}
      .advanced-admin-top{padding:14px clamp(16px,4vw,42px);background:rgba(255,255,255,.72);border-bottom:1px solid rgba(255,255,255,.8);display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100;backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);box-shadow:0 8px 30px rgba(15,27,61,.05)}
      .advanced-admin-brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0}.advanced-admin-logo{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#EEF2FF,#E5DEFF);display:grid;place-items:center;padding:4px;box-shadow:inset 0 1px 0 #fff,0 7px 18px #4361EE18}.advanced-admin-brand b{font-size:14px}.advanced-admin-brand small{display:block;color:${A.sub};font-size:10px;margin-top:1px}
      .advanced-admin-btn{border:0;border-radius:13px;padding:11px 15px;font:inherit;font-weight:850;cursor:pointer;min-height:44px;transition:transform .15s,box-shadow .15s}.advanced-admin-btn:active{transform:scale(.98)}.advanced-admin-secondary{background:#EEF2FF;color:${A.accent}}.advanced-admin-logout{background:#FFF1F2;color:${A.red}
      }.advanced-admin-wrap{max-width:1420px;margin:auto;padding:clamp(16px,3vw,34px)}
      .advanced-admin-hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:18px;padding:24px;border-radius:26px;background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(242,246,255,.78));border:1px solid rgba(255,255,255,.9);box-shadow:0 18px 55px rgba(67,97,238,.09)}.advanced-admin-hero:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;right:-70px;top:-90px;background:#A5B4FC33;filter:blur(2px)}
      .advanced-admin-eyebrow{font-size:11px;font-weight:950;letter-spacing:1.5px;text-transform:uppercase;color:${A.accent}}.advanced-admin-hero h1{position:relative;z-index:1;margin:5px 0;font-size:clamp(25px,4vw,38px);letter-spacing:-.8px}.advanced-admin-hero p{position:relative;z-index:1;margin:0;color:${A.sub};font-size:13px}.advanced-admin-hero-actions{position:relative;z-index:2;display:flex;gap:8px;flex:none}
      .advanced-admin-back{position:fixed;top:max(12px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));z-index:2000;width:46px;height:46px;padding:0;border-radius:16px;border:1px solid rgba(255,255,255,.65);background:rgba(255,255,255,.42);color:${A.ink};display:grid;place-items:center;font-size:23px;font-weight:950;line-height:1;cursor:pointer;box-shadow:0 12px 30px rgba(15,27,61,.15),inset 0 1px 0 rgba(255,255,255,.8);backdrop-filter:blur(18px) saturate(170%);-webkit-backdrop-filter:blur(18px) saturate(170%);touch-action:manipulation}.advanced-admin-back:active{transform:scale(.95)}
      .advanced-admin-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.advanced-admin-metric{position:relative;overflow:hidden;background:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.95);border-radius:19px;padding:15px;min-width:0;box-shadow:0 10px 30px rgba(15,27,61,.05)}.advanced-admin-metric:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--metric-tone)}.advanced-admin-metric-icon{width:37px;height:37px;border-radius:12px;background:#EEF2FF;display:grid;place-items:center;font-size:19px}.advanced-admin-metric-value{font-size:26px;font-weight:950;margin-top:9px;letter-spacing:-.4px}.advanced-admin-metric-label{font-weight:850;font-size:12px}.advanced-admin-metric-note{font-size:10px;color:${A.sub};margin-top:3px}
      .advanced-admin-main{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(290px,1fr);gap:14px;margin-top:14px}.advanced-admin-card{background:rgba(255,255,255,.86);border:1px solid rgba(255,255,255,.95);border-radius:23px;padding:20px;box-shadow:0 12px 35px rgba(15,27,61,.055);backdrop-filter:blur(8px)}.advanced-admin-card h2{font-size:17px;margin:0 0 5px}.advanced-admin-card p{font-size:12px;color:${A.sub};margin:0 0 15px}
      .advanced-admin-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.advanced-admin-action{position:relative;overflow:hidden;border:1px solid #E5EAF3;background:linear-gradient(135deg,#fff,#F9FAFF);border-radius:16px;padding:12px;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;color:${A.ink};min-height:68px;transition:transform .16s,border-color .16s,box-shadow .16s}.advanced-admin-action:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--action-tone)}.advanced-admin-action:hover{transform:translateY(-2px);border-color:#B9C4F8;box-shadow:0 10px 24px #0F1B3D0C}.advanced-admin-action:active{transform:scale(.985)}.advanced-admin-action-icon{width:39px;height:39px;border-radius:12px;background:color-mix(in srgb,var(--action-tone) 10%,#fff);display:grid;place-items:center;flex:none;font-size:19px}.advanced-admin-action-copy{min-width:0}.advanced-admin-action b{display:block;font-size:12px}.advanced-admin-action small{display:block;color:${A.sub};font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.advanced-admin-action-arrow{margin-left:auto;color:var(--action-tone);font-weight:950;font-size:18px}
      .advanced-admin-health{display:grid;gap:7px}.advanced-admin-health-row{display:flex;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid #E9EDF4;font-size:12px}.advanced-admin-health-row:last-child{border-bottom:0}.advanced-admin-status{font-weight:900}.advanced-admin-list{display:grid;gap:8px}.advanced-admin-ann{padding:12px;border-radius:13px;background:#F8FAFF;border:1px solid #EDF1F8}.advanced-admin-ann b{font-size:12px}.advanced-admin-ann small{display:block;color:${A.sub};font-size:10px;margin-top:3px}.advanced-admin-error{display:flex;align-items:center;gap:10px;background:#FFF7ED;color:#9A3412;border:1px solid #FED7AA;padding:11px 13px;border-radius:14px;margin-bottom:14px;font-size:11px}.advanced-admin-error strong{font-size:16px}
      @media(max-width:1100px){.advanced-admin-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:800px){.advanced-admin-main{grid-template-columns:1fr}.advanced-admin-hero{align-items:flex-start;flex-direction:column}.advanced-admin-hero-actions{width:100%}.advanced-admin-hero-actions .advanced-admin-btn{flex:1}.advanced-admin-actions{grid-template-columns:1fr 1fr}}
      @media(max-width:520px){.advanced-admin-home{padding-bottom:18px}.advanced-admin-top{padding:10px 12px 10px 62px;min-height:64px}.advanced-admin-top .advanced-admin-secondary{display:none}.advanced-admin-brand b{font-size:13px}.advanced-admin-wrap{padding:10px}.advanced-admin-hero{padding:18px;border-radius:21px;margin-bottom:12px}.advanced-admin-hero h1{font-size:25px;letter-spacing:-.5px}.advanced-admin-hero p{font-size:12px}.advanced-admin-hero-actions{gap:7px}.advanced-admin-hero-actions .advanced-admin-btn{padding:9px 10px}.advanced-admin-grid{grid-template-columns:1fr 1fr;gap:8px}.advanced-admin-metric{padding:12px;border-radius:16px}.advanced-admin-metric-value{font-size:22px}.advanced-admin-metric-note{font-size:9px}.advanced-admin-main{gap:10px;margin-top:10px}.advanced-admin-card{padding:14px;border-radius:19px}.advanced-admin-card h2{font-size:16px}.advanced-admin-actions{grid-template-columns:1fr;gap:8px}.advanced-admin-action{min-height:64px;padding:11px}.advanced-admin-back{width:44px;height:44px;top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left))}}
    `}</style>
    <button type="button" className="advanced-admin-back" onClick={goBack} aria-label="Go back" title="Go back">←</button>
    <header className="advanced-admin-top"><div className="advanced-admin-brand"><div className="advanced-admin-logo"><LGLogo size={34} showText={false} /></div><div><b>Learner's Guide</b><small>Admin Control Center</small></div></div><button type="button" className="advanced-admin-btn advanced-admin-secondary" onClick={() => onOpenManagement()}>Management</button><button type="button" className="advanced-admin-btn advanced-admin-logout" onClick={onLogout}>Logout</button></header>
    <main className="advanced-admin-wrap">
      <section className="advanced-admin-hero"><div><div className="advanced-admin-eyebrow">Administrator command center</div><h1>Good day, {user.name || "Admin"} 👋</h1><p>Run the institute from one clean, touch-first workspace.</p></div><div className="advanced-admin-hero-actions"><button type="button" className="advanced-admin-btn advanced-admin-secondary" onClick={() => void load()} disabled={loading}>{loading ? "Syncing…" : "↻ Refresh"}</button><button type="button" className="advanced-admin-btn advanced-admin-secondary" onClick={() => onOpenManagement()}>Open all</button></div></section>
      {error && <div className="advanced-admin-error"><strong>!</strong><span>{error}</span></div>}
      <section className="advanced-admin-grid">{metrics.map((m) => <div className="advanced-admin-metric" key={m.label} style={{ "--metric-tone": m.tone } as React.CSSProperties}><div className="advanced-admin-metric-icon">{m.icon}</div><div className="advanced-admin-metric-value">{m.label === "Attendance" ? `${m.value}%` : m.value}</div><div className="advanced-admin-metric-label">{m.label}</div><div className="advanced-admin-metric-note">{m.note}</div></div>)}</section>
      <section className="advanced-admin-main"><div className="advanced-admin-card"><h2>Quick actions ⚡</h2><p>Big, obvious controls designed for one-hand mobile use.</p><div className="advanced-admin-actions"><Action icon="🎓" title="Students" text="Profiles & accounts" tone="#4361EE" onClick={() => onOpenManagement("Students")} /><Action icon="👨‍🏫" title="Teachers" text="Staff & subjects" tone="#7C3AED" onClick={() => onOpenManagement("Teachers")} /><Action icon="👥" title="Batches" text="Classes & timetable" tone="#0891B2" onClick={() => onOpenManagement("Batches & Timetable")} /><Action icon="📋" title="Tests & Results" text="Assessments" tone="#DB2777" onClick={() => onOpenManagement("Student Results")} /><Action icon="✅" title="Attendance" text="Daily records" tone="#16A34A" onClick={() => onOpenManagement("Attendance")} /><Action icon="💰" title="Fees" text="Payments & dues" tone="#CA8A04" onClick={() => onOpenManagement("Fees")} /><Action icon="📚" title="Study Materials" text="Library & files" tone="#EA580C" onClick={() => onOpenManagement("Study Materials")} /><Action icon="📈" title="Analytics" text="People & reports" tone="#2563EB" onClick={() => onOpenManagement("People & Analytics")} /></div></div>
        <div className="advanced-admin-card"><h2>System pulse 🛡️</h2><p>Useful live indicators without overwhelming the screen.</p><div className="advanced-admin-health"><div className="advanced-admin-health-row"><span>Database access</span><span className="advanced-admin-status" style={{ color: error ? A.red : A.green }}>{error ? "Partial" : "Healthy"}</span></div><div className="advanced-admin-health-row"><span>Upcoming tests</span><b>{upcomingTests}</b></div><div className="advanced-admin-health-row"><span>Fees outstanding</span><b>₹{pendingFees.toLocaleString("en-IN")}</b></div><div className="advanced-admin-health-row"><span>Admin access</span><span className="advanced-admin-status" style={{ color: A.green }}>Authorized</span></div></div></div></section>
      <section className="advanced-admin-card" style={{ marginTop: 14 }}><h2>Latest announcements 📢</h2><p>Recent institute communication.</p><div className="advanced-admin-list">{recentAnnouncements.length ? recentAnnouncements.map((a) => <div className="advanced-admin-ann" key={a.id}><b>{a.title || "Announcement"}</b><small>{a.date || "—"} · {a.target || "all"}</small></div>) : <div style={{ color: A.sub, fontSize: 12 }}>No announcements yet.</div>}</div></section>
    </main>
  </div>;
}
