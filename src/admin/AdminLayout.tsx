import type { ReactNode } from "react";
import { C } from "@/lg/data";
import { LGLogo } from "@/lg/ui";
import ChangePassword from "@/lg/ChangePassword";

export type AdminPageKey="dashboard"|"students"|"teachers"|"batches"|"attendance"|"homework"|"examschedule"|"materials"|"announcements"|"accounts"|"search";
type Props={activePage:AdminPageKey;onNavigate:(page:AdminPageKey)=>void;onLogout:()=>void;title:string;subtitle?:string;children:ReactNode};

const NAV:Array<{key:AdminPageKey;icon:string;label:string}>=[
{key:"dashboard",icon:"🏠",label:"Dashboard"},{key:"students",icon:"🎓",label:"Students"},{key:"teachers",icon:"👨‍🏫",label:"Teachers"},{key:"batches",icon:"👥",label:"Batches"},{key:"attendance",icon:"✅",label:"Attendance"},{key:"homework",icon:"📝",label:"Homework"},{key:"examschedule",icon:"📋",label:"Exams"},{key:"materials",icon:"📚",label:"Materials"},{key:"announcements",icon:"📢",label:"News"},{key:"accounts",icon:"🔐",label:"Accounts"},{key:"search",icon:"🔍",label:"Search"}];

const ADMIN_CSS=`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');*{box-sizing:border-box}body{font-family:Poppins,sans-serif;background:${C.bg}}.admin-nav-btn{transition:.2s;cursor:pointer}.admin-nav-btn:hover{transform:translateX(3px)}@media(max-width:768px){.admin-sidebar{display:none}.admin-bottom-nav{display:flex!important}.admin-main{padding-bottom:76px!important}.admin-topbar{padding:14px 16px!important}}@media(min-width:769px){.admin-bottom-nav{display:none!important}}`;

function Sidebar({activePage,onNavigate,onLogout}:Pick<Props,"activePage"|"onNavigate"|"onLogout">){return <aside className="admin-sidebar" style={{width:230,minHeight:"100vh",background:C.sidebar,padding:"12px",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0}}><div style={{padding:"12px 8px",color:"white",fontWeight:800}}>🎓 Learner's Guide</div><nav style={{flex:1,overflowY:"auto"}}>{NAV.map(item=><button className="admin-nav-btn" key={item.key} onClick={()=>onNavigate(item.key)} style={{width:"100%",border:0,borderRadius:12,padding:"11px",margin:"3px 0",textAlign:"left",background:activePage===item.key?C.accent:"transparent",color:"white"}}>{item.icon} {item.label}</button>)}</nav><ChangePassword compact/><button onClick={onLogout} style={{marginTop:10,padding:10,borderRadius:12}}>🚪 Logout</button></aside>}

function BottomNav({activePage,onNavigate}:{activePage:AdminPageKey;onNavigate:(p:AdminPageKey)=>void}){return <nav className="admin-bottom-nav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,height:68;background:"white",zIndex:20,borderTop:`1px solid ${C.border}`,justifyContent:"space-around",alignItems:"center"}}>{NAV.slice(0,5).map(i=><button key={i.key} onClick={()=>onNavigate(i.key)} style={{border:0,background:"none",fontSize:11,color:activePage===i.key?C.accent:C.text}}>{i.icon}<br/>{i.label}</button>)}</nav>}

function TopBar({title,subtitle}:{title:string;subtitle?:string}){return <header className="admin-topbar" style={{padding:"20px 28px",background:"white",borderBottom:`1px solid ${C.border}`}}><div style={{fontWeight:800,fontSize:20}}>{title}</div>{subtitle&&<div style={{fontSize:13,color:C.sub}}>{subtitle}</div>}</header>}

export default function AdminLayout({activePage,onNavigate,onLogout,title,subtitle,children}:Props){return <div style={{display:"flex",minHeight:"100vh",background:C.bg}}><style>{ADMIN_CSS}</style><Sidebar activePage={activePage} onNavigate={onNavigate} onLogout={onLogout}/><div style={{flex:1,minWidth:0}}><TopBar title={title} subtitle={subtitle}/><main className="admin-main">{children}</main></div><BottomNav activePage={activePage} onNavigate={onNavigate}/></div>}
