import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";
import PlatformOwnerLogin from "@/platform/PlatformOwnerLogin";
import { PlatformMembershipPanel } from "@/platform/PlatformMembershipPanel";

type Institute={id:string;name:string;slug:string;status:string;created_at:string};
type Domain={id:string;institute_id:string;hostname:string;domain_type:string;status:string;tls_status:string;is_primary:boolean;created_at:string};
type Audit={id:string;institute_id:string|null;action:string;entity_type:string|null;summary:string|null;created_at:string};
type Settings={id:number;product_name:string|null;legal_name:string|null;public_website_url:string|null;default_app_domain:string|null;support_email:string|null;default_timezone:string;settings:Record<string,unknown>};
type PlatformFeature={code:string;name:string;description:string;category:string;sort_order:number;depends_on:string[]};
type FeatureEntitlement={institute_id:string;feature_code:string;enabled:boolean};

const shell={minHeight:"100vh",background:"#f5f7fb",color:"#14213d",fontFamily:"Poppins,system-ui,sans-serif"};
const btn=(primary=true)=>({border:0,borderRadius:11,padding:"10px 14px",fontWeight:800,cursor:"pointer",background:primary?"#4f46e5":"#e8ecf5",color:primary?"#fff":"#24324a"});
const date=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString()};
const err401=(e:any)=>Number(e?.status)===401||/jwt|unauthorized/i.test(String(e?.message||""));

export default function PlatformOwnerPortal(){
 const [authenticated,setAuthenticated]=useState<boolean|null>(null),[allowed,setAllowed]=useState<boolean|null>(null),[roles,setRoles]=useState<string[]>([]);
 const [institutes,setInstitutes]=useState<Institute[]>([]),[domains,setDomains]=useState<Domain[]>([]),[audit,setAudit]=useState<Audit[]>([]),[settings,setSettings]=useState<Settings|null>(null);
 const [features,setFeatures]=useState<PlatformFeature[]>([]),[entitlements,setEntitlements]=useState<FeatureEntitlement[]>([]),[featureInstitute,setFeatureInstitute]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[working,setWorking]=useState("");
 const [search,setSearch]=useState(""),[statusFilter,setStatusFilter]=useState("all"),[auditFilter,setAuditFilter]=useState("all");
 const [createOpen,setCreateOpen]=useState(false),[domainOpen,setDomainOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false);
 const [name,setName]=useState(""),[slug,setSlug]=useState(""),[domainInstitute,setDomainInstitute]=useState(""),[hostname,setHostname]=useState(""),[token,setToken]=useState("");
 const featureMap=useMemo(()=>new Map(entitlements.filter(x=>x.institute_id===featureInstitute).map(x=>[x.feature_code,x.enabled])),[entitlements,featureInstitute]);
 const [product,setProduct]=useState(""),[legal,setLegal]=useState(""),[website,setWebsite]=useState(""),[appDomain,setAppDomain]=useState(""),[support,setSupport]=useState(""),[timezone,setTimezone]=useState("Asia/Kolkata");

 const instituteMap=useMemo(()=>new Map(institutes.map(x=>[x.id,x.name])),[institutes]);
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return institutes.filter(x=>(statusFilter==="all"||x.status===statusFilter)&&(!q||[x.name,x.slug,x.status].some(v=>String(v).toLowerCase().includes(q))))},[institutes,search,statusFilter]);
 const filteredAudit=useMemo(()=>audit.filter(x=>auditFilter==="all"||x.action.startsWith(auditFilter)),[audit,auditFilter]);

 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);setError("");
  try{
   const session=await supabase.auth.getSession();if(session.error||!session.data.session){setAuthenticated(false);setAllowed(false);return}
   setAuthenticated(true);
   const rr=await supabase.rpc("current_platform_roles");if(rr.error){if(err401(rr.error)){await supabase.auth.signOut({scope:"local"});setAuthenticated(false);setAllowed(false);return}throw rr.error}
   const rs=(rr.data||[]).map((x:any)=>String(x.role||"")).filter(Boolean);setRoles(rs);setAllowed(rs.length>0);if(!rs.length)return;
   const [i,d,a,s,f,e]=await Promise.all([
    supabase.from("institutes").select("id,name,slug,status,created_at").order("created_at",{ascending:false}),
    supabase.from("institute_domains").select("id,institute_id,hostname,domain_type,status,tls_status,is_primary,created_at").order("created_at",{ascending:false}),
    supabase.from("audit_logs").select("id,institute_id,action,entity_type,summary,created_at").eq("scope","platform").order("created_at",{ascending:false}).limit(100),
    supabase.from("platform_settings").select("id,product_name,legal_name,public_website_url,default_app_domain,support_email,default_timezone,settings").eq("id",1).maybeSingle(),
    supabase.from("platform_features").select("code,name,description,category,sort_order,depends_on").eq("status","active").order("sort_order"),
    supabase.from("institute_feature_entitlements").select("institute_id,feature_code,enabled")
   ]);
   const failures=[i.error,d.error,a.error,s.error,f.error,e.error].filter(Boolean);if(failures.some(err401)){await supabase.auth.signOut({scope:"local"});setAuthenticated(false);setAllowed(false);return}
   if(i.error)throw i.error;if(d.error)throw d.error;if(a.error)throw a.error;if(s.error)throw s.error;
   setInstitutes((i.data||[]) as Institute[]);setDomains((d.data||[]) as Domain[]);setAudit((a.data||[]) as Audit[]);setSettings((s.data||null) as Settings|null);setFeatures((f.data||[]) as PlatformFeature[]);setEntitlements((e.data||[]) as FeatureEntitlement[]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load the platform control center.");}
  finally{setLoading(false)}
 },[]);

 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange(e=>{if(e==="SIGNED_OUT"){setAuthenticated(false);setAllowed(false);setRoles([])}});void load();const t=window.setInterval(()=>void load(true),30000);return()=>{data.subscription.unsubscribe();window.clearInterval(t)}},[load]);
 const authed=(r:string[])=>{setRoles(r);setAuthenticated(true);setAllowed(true);void load()};
 const signOut=async()=>{await supabase.auth.signOut({scope:"local"}).catch(()=>{});setAuthenticated(false);setAllowed(false);setRoles([])};

 const createInstitute=async()=>{setWorking("create");setError("");setNotice("");try{const r=await supabase.rpc("create_institute",{p_name:name.trim(),p_slug:slug.trim().toLowerCase(),p_timezone:timezone,p_locale:"en-IN"});if(r.error)throw r.error;if(!r.data)throw new Error("Institute creation returned no ID.");setName("");setSlug("");setCreateOpen(false);setNotice("Institute created and default tenant records were seeded.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to create institute.")}finally{setWorking("")}};
 const changeStatus=async(i:Institute,s:string)=>{if(i.status===s)return;setWorking("status:"+i.id);setError("");setNotice("");try{const r=await supabase.rpc("platform_set_institute_status",{p_institute_id:i.id,p_status:s});if(r.error)throw r.error;setNotice(`${i.name} is now ${s}.`);await load()}catch(e){setError(e instanceof Error?e.message:"Unable to change institute status.")}finally{setWorking("")}};
 const registerDomain=async()=>{setWorking("domain");setError("");setNotice("");setToken("");try{if(!domainInstitute||!hostname.trim())throw new Error("Institute and hostname are required.");const r=await supabase.rpc("register_institute_domain",{p_institute_id:domainInstitute,p_hostname:hostname.trim().toLowerCase(),p_domain_type:"custom"});if(r.error)throw r.error;const row=Array.isArray(r.data)?r.data[0]:r.data;setToken(String(row?.verification_token||""));setHostname("");setNotice("Domain registered. Add the TXT verification record, then verify it through your DNS workflow.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to register domain.")}finally{setWorking("")}};
 const primary=async(d:Domain)=>{setWorking("domain:"+d.id);setError("");try{const r=await supabase.rpc("platform_set_primary_domain",{p_domain_id:d.id});if(r.error)throw r.error;setNotice(`${d.hostname} is now the primary domain.`);await load()}catch(e){setError(e instanceof Error?e.message:"Only verified domains can be primary.")}finally{setWorking("")}};
 const disableDomain=async(d:Domain)=>{if(!window.confirm(`Disable ${d.hostname}?`))return;setWorking("domain:"+d.id);setError("");try{const r=await supabase.rpc("platform_disable_domain",{p_domain_id:d.id});if(r.error)throw r.error;setNotice(`${d.hostname} disabled.`);await load()}catch(e){setError(e instanceof Error?e.message:"Unable to disable domain.")}finally{setWorking("")}};
 const openSettings=()=>{setProduct(settings?.product_name||"Mahin");setLegal(settings?.legal_name||"");setWebsite(settings?.public_website_url||"");setAppDomain(settings?.default_app_domain||"");setSupport(settings?.support_email||"");setTimezone(settings?.default_timezone||"Asia/Kolkata");setSettingsOpen(true)};
 const saveSettings=async()=>{setWorking("settings");setError("");setNotice("");try{const r=await supabase.rpc("platform_update_settings",{p_product_name:product.trim(),p_legal_name:legal.trim(),p_public_website_url:website.trim(),p_default_app_domain:appDomain.trim().toLowerCase(),p_support_email:support.trim().toLowerCase(),p_default_timezone:timezone.trim(),p_settings:settings?.settings||{}});if(r.error)throw r.error;setSettings(r.data as Settings);setSettingsOpen(false);setNotice("Platform settings saved to Supabase.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to save platform settings.")}finally{setWorking("")}};

 if(authenticated===false)return <PlatformOwnerLogin onAuthenticated={authed}/>;
 if(allowed===false)return <main style={{...shell,display:"grid",placeItems:"center",padding:24}}><section style={{background:"#fff",padding:30,borderRadius:24,maxWidth:560}}><b>PLATFORM CONTROL CENTER</b><h1>Platform access required</h1><p>Active platform membership is required for this surface.</p></section></main>;
 if(loading)return <main style={{...shell,display:"grid",placeItems:"center"}}>Loading platform control center…</main>;

 const setFeature=async(feature:PlatformFeature,enabled:boolean)=>{if(!featureInstitute)return;setWorking("feature:"+feature.code);setError("");setNotice("");try{const r=await supabase.rpc("platform_set_feature_enabled",{p_institute_id:featureInstitute,p_feature_code:feature.code,p_enabled:enabled});if(r.error)throw r.error;setEntitlements(prev=>[...prev.filter(x=>!(x.institute_id===featureInstitute&&x.feature_code===feature.code)),r.data as FeatureEntitlement]);setNotice(`${feature.name} ${enabled?"enabled":"disabled"}.`);}catch(e){setError(e instanceof Error?e.message:"Unable to update feature entitlement.");}finally{setWorking("");}};

 const active=institutes.filter(x=>x.status==="active").length,trial=institutes.filter(x=>x.status==="trial").length,suspended=institutes.filter(x=>x.status==="suspended").length,archived=institutes.filter(x=>x.status==="archived").length;
 const verified=domains.filter(x=>x.status==="verified").length,pending=domains.filter(x=>x.status==="pending").length,primaryDomains=domains.filter(x=>x.is_primary).length;

 return <main style={shell}>
  <header style={{padding:"25px clamp(16px,4vw,42px) 20px",background:"linear-gradient(135deg,#17124d,#3224a6)",color:"#fff"}}>
   <div style={{maxWidth:1280,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap"}}>
    <div><div style={{fontSize:11,fontWeight:900,letterSpacing:1.6,opacity:.72}}>PLATFORM OWNER · CONTROL PLANE</div><h1 style={{margin:"5px 0",fontSize:"clamp(28px,4vw,40px)"}}>Control Center</h1><div style={{opacity:.75}}>Tenants, domains, access, configuration, audit and operational health.</div></div>
    <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:12,opacity:.8}}>{roles.join(" · ")}</span><button onClick={()=>void signOut()} style={{...btn(false),background:"rgba(255,255,255,.14)",color:"#fff"}}>Sign out</button></div>
   </div>
  </header>
  <div style={{maxWidth:1280,margin:"0 auto",padding:"22px clamp(16px,4vw,42px) 60px"}}>
   {error&&<div role="alert" style={{marginBottom:12,padding:12,borderRadius:12,background:"#fff1f2",color:"#b42318",border:"1px solid #fecdd3"}}>{error}</div>}
   {notice&&<div style={{marginBottom:12,padding:12,borderRadius:12,background:"#ecfdf3",color:"#027a48",border:"1px solid #bbf7d0"}}>{notice}</div>}
   <section style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:10,marginBottom:16}}>
    {[["Institutes",institutes.length],["Active",active],["Trial",trial],["Suspended",suspended],["Archived",archived],["Verified domains",verified],["Pending domains",pending]].map(([l,v])=><div key={String(l)} style={{background:"#fff",border:"1px solid #e7ebf2",borderRadius:16,padding:15}}><div style={{fontSize:11,color:"#64748b",fontWeight:800}}>{l}</div><div style={{fontSize:26,fontWeight:900,marginTop:3}}>{v}</div></div>)}
   </section>

   <section style={{background:"#fff",border:"1px solid #e7ebf2",borderRadius:20,overflow:"hidden",marginBottom:16}}>
    <div style={{padding:16,display:"flex",gap:9,alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #eef1f6"}}>
     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search institute, slug or status…" style={{flex:"1 1 280px",padding:11,borderRadius:10,border:"1px solid #d8dee9"}}/>
     <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:11,borderRadius:10,border:"1px solid #d8dee9"}}><option value="all">All statuses</option><option value="trial">Trial</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select>
     <button style={btn(false)} onClick={()=>void load()}>↻ Sync now</button><button style={btn(true)} onClick={()=>setCreateOpen(true)}>+ Create institute</button>
    </div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{textAlign:"left",background:"#f8fafc",color:"#64748b"}}>{["Institute","Slug","Status","Created","Operations"].map(x=><th key={x} style={{padding:12}}>{x}</th>)}</tr></thead>
    <tbody>{filtered.map(i=><tr key={i.id} style={{borderTop:"1px solid #eef1f6"}}><td style={{padding:12,fontWeight:900}}>{i.name}</td><td style={{padding:12,color:"#64748b"}}>{i.slug}</td><td style={{padding:12}}><select value={i.status} disabled={working==="status:"+i.id} onChange={e=>void changeStatus(i,e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:"1px solid #d8dee9"}}><option value="trial">trial</option><option value="active">active</option><option value="suspended">suspended</option><option value="archived">archived</option></select></td><td style={{padding:12,color:"#64748b"}}>{date(i.created_at)}</td><td style={{padding:12}}><button style={btn(false)} onClick={()=>{setDomainInstitute(i.id);setDomainOpen(true)}}>+ Domain</button></td></tr>)}</tbody></table></div>
    {!filtered.length&&<div style={{padding:26,color:"#64748b"}}>No institutes match this filter.</div>}
   </section>

   <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.25fr) minmax(340px,.75fr)",gap:16,alignItems:"start"}}>
    <div style={{background:"#fff",border:"1px solid #e7ebf2",borderRadius:20,overflow:"hidden"}}>
     <div style={{padding:18,borderBottom:"1px solid #eef1f6",display:"flex",justifyContent:"space-between",gap:10}}><div><div style={{fontSize:11,fontWeight:900,color:"#0f766e",letterSpacing:1}}>DOMAINS · {verified} VERIFIED · {primaryDomains} PRIMARY</div><h2 style={{margin:"4px 0"}}>Portal routing</h2></div><button style={btn(false)} onClick={()=>void load()}>Refresh</button></div>
     {domains.map(d=><div key={d.id} style={{padding:14,borderBottom:"1px solid #eef1f6"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><b>{d.hostname}</b><div style={{fontSize:11,color:"#64748b",marginTop:3}}>{instituteMap.get(d.institute_id)||"Unknown"} · {d.domain_type} · {d.status} · TLS {d.tls_status}</div></div><div style={{display:"flex",gap:7,alignItems:"center"}}>{d.is_primary&&<span style={{fontSize:10,fontWeight:900,color:"#4f46e5"}}>PRIMARY</span>}{d.status==="verified"&&!d.is_primary&&<button disabled={working==="domain:"+d.id} style={btn(false)} onClick={()=>void primary(d)}>Make primary</button>}{d.status!=="disabled"&&<button disabled={working==="domain:"+d.id} style={{...btn(false),background:"#fff1f2",color:"#b42318"}} onClick={()=>void disableDomain(d)}>Disable</button>}</div></div></div>)}
     {!domains.length&&<div style={{padding:25,color:"#64748b"}}>No domains registered.</div>}
    </div>
    <div style={{background:"#fff",border:"1px solid #e7ebf2",borderRadius:20,overflow:"hidden"}}>
     <div style={{padding:18,borderBottom:"1px solid #eef1f6"}}><div style={{fontSize:11,fontWeight:900,color:"#7c3aed",letterSpacing:1}}>PLATFORM SETTINGS</div><h2 style={{margin:"4px 0"}}>Configuration</h2></div>
     <div style={{padding:18,display:"grid",gap:9,fontSize:13}}><div><b>Product:</b> {settings?.product_name||"Not configured"}</div><div><b>Legal:</b> {settings?.legal_name||"Not configured"}</div><div><b>Website:</b> {settings?.public_website_url||"Not configured"}</div><div><b>App domain:</b> {settings?.default_app_domain||"Not configured"}</div><div><b>Support:</b> {settings?.support_email||"Not configured"}</div><div><b>Timezone:</b> {settings?.default_timezone||"Asia/Kolkata"}</div><button style={{...btn(true),marginTop:5}} onClick={openSettings}>Edit platform settings</button></div>
    </div>
   </section>

   <section style={{background:"#fff",border:"1px solid #e7ebf2",borderRadius:20,overflow:"hidden",marginTop:16}}>
    <div style={{padding:18,borderBottom:"1px solid #eef1f6",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><div style={{fontSize:11,fontWeight:900,color:"#2563eb",letterSpacing:1}}>FEATURE ENTITLEMENTS</div><h2 style={{margin:"4px 0"}}>Institute modules</h2><p style={{margin:0,color:"#64748b",fontSize:12}}>Control which platform modules are enabled for each institute. Existing tenants start fully enabled.</p></div><select value={featureInstitute} onChange={e=>setFeatureInstitute(e.target.value)} style={{padding:10,borderRadius:10,border:"1px solid #d8dee9",minWidth:220}}><option value="">Choose institute</option>{institutes.filter(i=>i.status!=="archived").map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
    {featureInstitute&&<div style={{padding:18,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>{features.map(f=>{const enabled=featureMap.get(f.code)!==false;return <div key={f.code} style={{border:"1px solid #e7ebf2",borderRadius:15,padding:14,background:enabled?"#fbfdff":"#f8fafc"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start"}}><div><div style={{fontWeight:900}}>{f.name}</div><div style={{fontSize:10,fontWeight:800,color:"#64748b",marginTop:3}}>{f.category.toUpperCase()} · {f.code}</div></div><button type="button" disabled={working==="feature:"+f.code} onClick={()=>void setFeature(f,!enabled)} style={{border:0,borderRadius:999,padding:"7px 10px",fontWeight:900,cursor:"pointer",background:enabled?"#dcfce7":"#e2e8f0",color:enabled?"#166534":"#475569"}}>{working==="feature:"+f.code?"…":enabled?"ON":"OFF"}</button></div><p style={{fontSize:12,lineHeight:1.45,color:"#64748b",margin:"10px 0 0"}}>{f.description}</p>{f.depends_on.length>0&&<div style={{fontSize:10,color:"#94a3b8",marginTop:8}}>Depends on: {f.depends_on.join(", ")}</div>}</div>})}</div>}
    {!featureInstitute&&<div style={{padding:26,color:"#64748b"}}>Choose an institute to manage its feature entitlements.</div>}
   </section>

   <PlatformMembershipPanel institutes={institutes.map(({id,name,slug})=>({id,name,slug}))}/>

   <section style={{background:"#fff",border:"1px solid #e7ebf2",borderRadius:20,overflow:"hidden",marginTop:16}}>
    <div style={{padding:18,borderBottom:"1px solid #eef1f6",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div><div style={{fontSize:11,fontWeight:900,color:"#475569",letterSpacing:1}}>AUDIT TRAIL</div><h2 style={{margin:"4px 0"}}>Recent platform activity</h2></div><select value={auditFilter} onChange={e=>setAuditFilter(e.target.value)} style={{padding:9,borderRadius:9,border:"1px solid #d8dee9"}}><option value="all">All activity</option><option value="institute.">Institutes</option><option value="domain.">Domains</option><option value="membership.">Memberships</option><option value="platform.">Platform</option></select></div>
    {filteredAudit.slice(0,100).map(a=><div key={a.id} style={{padding:12,borderBottom:"1px solid #eef1f6",display:"grid",gridTemplateColumns:"155px 210px 1fr",gap:12}}><div style={{fontSize:11,color:"#64748b"}}>{date(a.created_at)}</div><div style={{fontSize:12,fontWeight:900}}>{a.action}</div><div style={{fontSize:12,color:"#475569"}}>{instituteMap.get(a.institute_id||"")||a.summary||"Platform event"}</div></div>)}
    {!filteredAudit.length&&<div style={{padding:25,color:"#64748b"}}>No matching platform activity.</div>}
   </section>
  </div>

  {createOpen&&<div role="dialog" aria-modal="true" onClick={()=>setCreateOpen(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",display:"grid",placeItems:"center",padding:18,zIndex:1000}}><div onClick={e=>e.stopPropagation()} style={{width:"min(520px,100%)",background:"#fff",borderRadius:22,padding:22}}><h2 style={{marginTop:0}}>Create institute</h2><p style={{color:"#64748b",fontSize:13}}>Creates the tenant, settings and default roles in one protected database operation.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Institute name" style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:10,border:"1px solid #d8dee9",marginBottom:10}}/><input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="example-academy" style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:10,border:"1px solid #d8dee9"}}/><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:15}}><button style={btn(false)} onClick={()=>setCreateOpen(false)}>Cancel</button><button style={btn(true)} disabled={!name.trim()||!slug.trim()||working==="create"} onClick={()=>void createInstitute()}>{working==="create"?"Creating…":"Create"}</button></div></div></div>}

  {domainOpen&&<div role="dialog" aria-modal="true" onClick={()=>setDomainOpen(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",display:"grid",placeItems:"center",padding:18,zIndex:1000}}><div onClick={e=>e.stopPropagation()} style={{width:"min(560px,100%)",background:"#fff",borderRadius:22,padding:22}}><h2 style={{marginTop:0}}>Register custom domain</h2><select value={domainInstitute} onChange={e=>setDomainInstitute(e.target.value)} style={{width:"100%",padding:12,borderRadius:10,border:"1px solid #d8dee9",marginBottom:10}}><option value="">Choose institute</option>{institutes.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder="portal.example.org" style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:10,border:"1px solid #d8dee9"}}/>{token&&<div style={{marginTop:12,padding:12,borderRadius:10,background:"#f8fafc",fontSize:12}}><b>DNS TXT verification token</b><div style={{fontFamily:"monospace",wordBreak:"break-all",marginTop:5}}>{token}</div></div>}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:15}}><button style={btn(false)} onClick={()=>setDomainOpen(false)}>Close</button><button style={btn(true)} disabled={!domainInstitute||!hostname.trim()||working==="domain"} onClick={()=>void registerDomain()}>{working==="domain"?"Registering…":"Register domain"}</button></div></div></div>}

  {settingsOpen&&<div role="dialog" aria-modal="true" onClick={()=>setSettingsOpen(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",display:"grid",placeItems:"center",padding:18,zIndex:1000}}><div onClick={e=>e.stopPropagation()} style={{width:"min(620px,100%)",background:"#fff",borderRadius:22,padding:22}}><h2 style={{marginTop:0}}>Platform settings</h2><p style={{color:"#64748b",fontSize:13}}>Saved through a protected platform RPC and recorded in the audit trail.</p>{[["Product name",product,setProduct],["Legal name",legal,setLegal],["Public website",website,setWebsite],["Default app domain",appDomain,setAppDomain],["Support email",support,setSupport]].map(([label,value,setter]:any)=><label key={label} style={{display:"block",fontSize:12,fontWeight:800,marginBottom:9}}>{label}<input value={value} onChange={e=>setter(e.target.value)} style={{width:"100%",boxSizing:"border-box",marginTop:5,padding:11,borderRadius:10,border:"1px solid #d8dee9"}}/></label>)}<label style={{display:"block",fontSize:12,fontWeight:800}}>Timezone<select value={timezone} onChange={e=>setTimezone(e.target.value)} style={{width:"100%",boxSizing:"border-box",marginTop:5,padding:11,borderRadius:10,border:"1px solid #d8dee9"}}><option>Asia/Kolkata</option><option>UTC</option><option>Asia/Dubai</option><option>Asia/Singapore</option></select></label><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:15}}><button style={btn(false)} onClick={()=>setSettingsOpen(false)}>Cancel</button><button style={btn(true)} disabled={working==="settings"} onClick={()=>void saveSettings()}>{working==="settings"?"Saving…":"Save settings"}</button></div></div></div>}
 </main>
}
