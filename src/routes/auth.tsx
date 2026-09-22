import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoginScreen } from "@/lg/LoginScreen";
import { resolveInstituteForCurrentHostname, type InstituteTenant } from "@/lg/tenant";
import { supabase } from "@/lg/supabase";

const title = "Sign in — Mahin";
const description = "Sign in with credentials provided by your institute administrator.";

type AuthSearch = { role: "teacher" | "student" | "parent"; mode?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    role: ["teacher", "student", "parent"].includes(String(search["role"])) ? (String(search["role"]) as AuthSearch["role"]) : "student",
    mode: String(search["mode"] || ""),
  }),
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { role, mode } = Route.useSearch();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<InstituteTenant | null>(null);

  useEffect(() => {
    let mounted = true;
    void resolveInstituteForCurrentHostname()
      .then((resolved) => { if (mounted) setTenant(resolved); })
      .catch((error) => console.warn("Unable to resolve institute domain:", error));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = tenant?.display_name ? `Sign in — ${tenant.display_name}` : title;
  }, [tenant?.display_name]);

  if (mode === "admin-invite") return <AdminInvitationSetup />;

  const openRecovery = () => {
    const query = new URLSearchParams({ role });
    window.location.assign(`/reset-password?${query.toString()}`);
  };

  return (
    <LoginScreen
      role={role}
      tenant={tenant}
      onBack={() => navigate({ to: "/" })}
      onLogin={() => navigate({ to: "/app" })}
      onForgotPassword={openRecovery}
    />
  );
}

function AdminInvitationSetup(){const navigate=useNavigate();const [email,setEmail]=useState(""),[ready,setReady]=useState(false),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false),[accepted,setAccepted]=useState(false);useEffect(()=>{void (async()=>{const {data,error}=await supabase.auth.getSession();if(error||!data.session){setError("This invitation is no longer active. Please open the latest invitation email.");return}setEmail(data.session.user.email||"");setReady(true)})()},[]);const complete=async()=>{setError("");if(password.length<8){setError("Use at least 8 characters.");return}if(password!==confirm){setError("Passwords do not match.");return}setSaving(true);try{const {error:updateError}=await supabase.auth.updateUser({password});if(updateError)throw updateError;const {error:acceptError}=await supabase.rpc("platform_accept_admin_invitation");if(acceptError)throw acceptError;setAccepted(true);window.setTimeout(()=>window.location.assign("/admin"),700)}catch(e){setError(e instanceof Error?e.message:"Unable to complete invitation.")}finally{setSaving(false)}};return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:20,fontFamily:"Poppins,system-ui,sans-serif",background:"linear-gradient(135deg,#f5f7fb,#eef2ff)"}}><section style={{width:"min(460px,100%)",background:"rgba(255,255,255,.94)",border:"1px solid #e2e8f0",borderRadius:24,padding:28,boxShadow:"0 20px 70px rgba(30,41,59,.12)"}}>{accepted?<><div style={{fontSize:42}}>✓</div><h1>Admin access activated</h1><p style={{color:"#64748b"}}>Your institute administrator workspace is ready. Opening the Admin Panel…</p></>:<><div style={{fontSize:11,fontWeight:900,letterSpacing:1.5,color:"#4f46e5"}}>MAHIN · ADMIN ONBOARDING</div><h1 style={{margin:"8px 0"}}>Complete your invitation</h1><p style={{color:"#64748b"}}>{ready?"Invitation for "+email:"Checking your secure invitation…"}</p><label style={{display:"block",fontSize:12,fontWeight:800,marginTop:18}}>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} disabled={!ready} style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:10,border:"1px solid #d8dee9",marginTop:6}}/></label><label style={{display:"block",fontSize:12,fontWeight:800,marginTop:12}}>Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={!ready} style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:10,border:"1px solid #d8dee9",marginTop:6}}/></label>{error&&<div role="alert" style={{marginTop:12,padding:11,borderRadius:10,background:"#fff1f2",color:"#b42318"}}>{error}</div>}<button type="button" disabled={!ready||saving} onClick={()=>void complete()} style={{width:"100%",border:0,borderRadius:11,padding:13,marginTop:18,background:"#4f46e5",color:"#fff",fontWeight:900}}>{saving?"Activating…":"Activate Admin Access"}</button></>}</section></main>}