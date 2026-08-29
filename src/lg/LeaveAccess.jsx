import React,{useEffect,useState}from"react";
import {supabase}from"@/lg/supabase";
import {LeaveRequests}from"@/lg/LeaveRequests";

function findBottomNav(){
 if(typeof document==="undefined")return null;
 const attendance=[...document.querySelectorAll("button,a,[role=button]")].find(el=>/attend/i.test((el.textContent||"").trim()));
 if(attendance){let el=attendance;for(let i=0;i<7&&el;i++,el=el.parentElement){const controls=el.querySelectorAll("button,a,[role=button]");const r=el.getBoundingClientRect();const s=getComputedStyle(el);if(controls.length>=5&&r.width>280&&r.top>window.innerHeight-190&&(s.display==="flex"||s.display==="grid"||s.position==="fixed"))return el}}
 const candidates=[...document.querySelectorAll("nav,[role=\"navigation\"],div,section")];
 const matches=candidates.filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.position==="fixed"&&r.bottom<=4&&r.width>280&&r.height>=50&&r.height<=150&&r.top>window.innerHeight-200});
 matches.sort((a,b)=>b.querySelectorAll("button,a,[role=button]").length-a.querySelectorAll("button,a,[role=button]").length);
 return matches[0]||null;
}
function makeNavItem(onOpen){
 const button=document.createElement("button");button.type="button";button.setAttribute("data-lg-leave-nav","true");button.setAttribute("aria-label","Open leave requests");button.innerHTML='<span style="display:block;font-size:22px;line-height:1.05">🏖️</span><span style="display:block;font-size:11px;font-weight:800;margin-top:3px">Leave</span>';
 button.style.cssText="flex:1 1 0;min-width:52px;width:auto;height:100%;border:0;background:transparent;color:#64748b;padding:7px 2px calc(7px + env(safe-area-inset-bottom,0px));font:inherit;text-align:center;cursor:pointer;touch-action:manipulation;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center";
 button.addEventListener("click",onOpen);return button;
}
function mountNavItem(onOpen){
 if(typeof document==="undefined")return()=>{};
 let button=null,observer=null;
 const mount=()=>{const nav=findBottomNav();if(!nav)return;if(nav.querySelector('[data-lg-leave-nav="true"]'))return;button=makeNavItem(onOpen);nav.appendChild(button)};
 mount();observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener("resize",mount,{passive:true});
 return()=>{observer?.disconnect();window.removeEventListener("resize",mount);if(button){button.removeEventListener("click",onOpen);button.remove()}};
}
export function LeaveAccess({user,student,canReview=false}){
 const[open,setOpen]=useState(false),[resolvedStudent,setResolvedStudent]=useState(student||null);
 useEffect(()=>{let live=true;(async()=>{if(student||canReview||!user)return;try{if(user.role==="student"&&user.ref){const{data}=await supabase.from("students").select("id,name,sid,cls,sec").eq("id",user.ref).maybeSingle();if(live&&data)setResolvedStudent(data);return}if(user.role==="parent"){const{data:links}=await supabase.from("parent_student_links").select("student_id,status").eq("parent_auth_id",user.id).eq("status","active").limit(20);const ids=[...new Set((links||[]).map(x=>String(x.student_id)).filter(Boolean))];if(!ids.length)return;const{data:students}=await supabase.from("students").select("id,name,sid,cls,sec").in("id",ids).order("name");if(live)setResolvedStudent(students?.[0]||null)}}catch{}})();return()=>{live=false}},[student,canReview,user?.id,user?.ref,user?.role]);
 useEffect(()=>{if(!user||canReview)return mountNavItem(()=>setOpen(true))},[user,canReview]);
 if(!user)return null;
 return <>{canReview&&<button type="button" onClick={()=>setOpen(true)} aria-label="Open leave requests" style={{position:"fixed",right:16,bottom:"calc(76px + env(safe-area-inset-bottom,0px))",zIndex:1200,border:"1px solid rgba(255,255,255,.28)",borderRadius:999,padding:"11px 15px",background:"rgba(24,32,68,.94)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",color:"#fff",fontWeight:900,boxShadow:"0 10px 28px rgba(15,23,42,.22)",cursor:"pointer"}}>🏖️ Leave Requests</button>}{open&&<div role="dialog" aria-modal="true" onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:1300,background:"rgba(15,23,42,.52)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div onClick={e=>e.stopPropagation()} style={{width:"min(720px,100%)",maxHeight:"90vh",overflowY:"auto",background:"#f8fafc",borderRadius:22,padding:18,boxShadow:"0 24px 70px rgba(15,23,42,.28)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12}}><div><div style={{fontSize:11,fontWeight:800,color:"#635bdf",letterSpacing:1,textTransform:"uppercase"}}>Attendance & Leave</div><h2 style={{margin:"3px 0 0",fontSize:22,color:"#182044"}}>{canReview?"Leave Requests":"Leave"}</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close leave" style={{border:0,borderRadius:10,padding:"8px 11px",background:"#e9edf5",cursor:"pointer",fontSize:16}}>✕</button></div><LeaveRequests user={user} student={resolvedStudent} canReview={canReview}/></div></div>}</>;
}
